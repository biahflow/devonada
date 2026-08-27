from domain.dinheiro import formatar_brl

"""
O ponto do M7: a capacidade real virando restrição do módulo de dívida.

Sem estes testes o módulo de caixa é um app de orçamento a mais.
"""


def _caixa(client, auth, renda=1000000, essenciais=400000):
    client.post(
        "/v1/caixa/fontes",
        json={"nome": "Contrato PJ", "tipo": "pj_hora", "valorTipicoInformado": renda},
        headers=auth,
    )
    client.post(
        "/v1/caixa/gastos",
        json={
            "descricao": "Custo de vida",
            "categoria": "moradia",
            "essencial": True,
            "fixo": True,
            "valorMensal": essenciais,
        },
        headers=auth,
    )


def _divida(client, auth, **kwargs):
    corpo = {
        "credor": "Banco Teste",
        "valorCobrado": 1200000,
        "dataOrigem": "2025-01-10",
        "tipo": "consumo",
        "taxaJurosMensal": 200,
        "totalParcelas": 12,
        "primeiroVencimento": "2026-09-10",
    }
    corpo.update(kwargs)
    return client.post("/v1/dividas", json=corpo, headers=auth)


def _simular(client, auth, aporte):
    return client.post(
        "/v1/dividas/simulacoes",
        json={"aporteExtraMensal": aporte, "estrategias": ["avalanche"]},
        headers=auth,
    )


class TestValidacaoDeAporte:
    def test_o_caixa_recusa_o_aporte_que_o_piso_legal_aceitava(
        self, client, auth, renda_legada
    ):
        """
        O buraco que o M7 fecha, em um teste.

        Renda R$ 10.000 e custo de vida real R$ 9.000. Pelo piso legal
        (R$ 600,00), a margem seria quase R$ 9.400 e um aporte de R$ 5.000
        passaria. Pelo custo de vida real, sobram R$ 1.000 — e o aporte é
        recusado, que é a resposta honesta.

        A renda da primeira perna vem da COLUNA LEGADA de propósito. Informá-la
        por `PUT /v1/perfil` hoje criaria uma fonte, e a segunda perna somaria
        duas rendas de R$ 10.000 — o teste passaria a comparar outra coisa.
        """
        renda_legada(1000000)
        _divida(client, auth)

        # Sem caixa preenchido: o fallback do piso legal aceita.
        assert _simular(client, auth, 500000).status_code == 200

        _caixa(client, auth, renda=1000000, essenciais=900000)
        r = _simular(client, auth, 500000)
        assert r.status_code == 422
        assert r.json()["campo"] == "aporteExtraMensal"

    def test_a_mensagem_de_recusa_nao_carrega_valor(self, client, auth):
        # Guardrail 5: renda é o dado mais sensível do produto e não vaza em
        # corpo de erro. O número certo já está na tela de caixa.
        _caixa(client, auth, renda=1000000, essenciais=900000)
        _divida(client, auth)
        mensagem = _simular(client, auth, 500000).json()["message"]
        assert "R$" not in mensagem
        assert "10.000" not in mensagem

    def test_aporte_dentro_da_capacidade_passa(self, client, auth):
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth)
        # Capacidade R$ 6.000 menos R$ 1.000 de parcela = R$ 5.000 de aporte.
        assert _simular(client, auth, 490000).status_code == 200

    def test_sem_caixa_preenchido_a_ferramenta_continua_disponivel(self, client, auth):
        # Limitação declarada: recusar tudo de quem não preencheu o caixa
        # tiraria a ferramenta de quem ainda não chegou nele.
        _divida(client, auth)
        assert _simular(client, auth, 500000).status_code == 200


class TestPrazoDeRepactuacao:
    def test_plano_curto_nao_sinaliza(self, client, auth):
        _divida(client, auth, totalParcelas=12)
        corpo = _simular(client, auth, 0).json()
        assert corpo["simulacoes"][0]["acimaDoPrazoDeRepactuacao"] is False

    def test_plano_acima_de_cinco_anos_sinaliza(self, client, auth):
        # CDC art. 104-A: o plano apresentado em repactuação tem prazo máximo de
        # 5 anos. É informação, não impedimento — a simulação devolve 200.
        _divida(client, auth, valorCobrado=6000000, totalParcelas=84, taxaJurosMensal=100)
        r = _simular(client, auth, 0)
        assert r.status_code == 200
        simulacao = r.json()["simulacoes"][0]
        assert simulacao["mesesAteQuitacao"] > 60
        assert simulacao["acimaDoPrazoDeRepactuacao"] is True


class TestScriptDeNegociacao:
    def _com_contrato_lido(self, client, auth, sessao):
        """
        Dívida com encargos lidos, que é o que produz achado.

        Reusa os helpers do M6: `_campos` preenche o schema inteiro, e um campo
        faltando faria a extração ser rejeitada na leitura.
        """
        import orm
        from config import get_settings
        from tests.test_revisao_api import _campo, _campos

        e = orm.Extracao(
            tenant_id=get_settings().tenant_id,
            status="concluida",
            campos_json=_campos(
                credor=_campo("Banco Teste", "Banco Teste S/A"),
                valorCobrado=_campo(1200000, "R$ 12.000,00"),
                # Multa de 5% contra o teto de 2% do CDC, art. 52, § 1º.
                multaMoratoriaMensal=_campo(500, "multa por atraso de 5%"),
            ),
        )
        sessao.add(e)
        sessao.commit()

        # Parcela vencida: a multa só é contestável sobre atraso que existiu.
        d = _divida(client, auth, primeiroVencimento="2026-01-10", extracaoId=e.id).json()["divida"]
        return d["id"]

    @staticmethod
    def _texto_do_script(client, auth, divida_id) -> str:
        # O script virou blocos tipados (M12): junta o texto de todos para as
        # asserções de conteúdo. O canal default (email) leva a oferta como
        # bloco separado, então a frase e o valor continuam presentes.
        script = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"][
            "script"
        ]
        assert script is not None
        return "\n".join(b["texto"] for b in script["blocos"])

    def test_sem_caixa_o_script_nao_promete_valor(self, client, auth, sessao):
        divida_id = self._com_contrato_lido(client, auth, sessao)
        texto = self._texto_do_script(client, auth, divida_id)
        assert "consigo comprometer" not in texto.lower()

    def test_com_caixa_o_script_faz_uma_oferta_ancorada(self, client, auth, sessao):
        # É o que muda a conversa com o credor: "quero desconto" é pedido,
        # "consigo pagar R$ X por mês" é oferta.
        divida_id = self._com_contrato_lido(client, auth, sessao)
        _caixa(client, auth, renda=1000000, essenciais=400000)

        texto = self._texto_do_script(client, auth, divida_id)
        assert "consigo comprometer" in texto.lower()
        # Capacidade de hoje (R$ 6.000), e não a máxima: a oferta tem de caber
        # na vida que a pessoa leva hoje. A parcela DESTA dívida não é
        # descontada — o acordo substitui a prestação dela.
        assert formatar_brl(600000) in texto

    def test_a_oferta_desconta_as_parcelas_das_OUTRAS_dividas(self, client, auth, sessao):
        # Oferecer a capacidade cheia a um credor quando existem dois é prometer
        # o mesmo dinheiro duas vezes.
        divida_id = self._com_contrato_lido(client, auth, sessao)
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth, credor="Outro Banco", valorCobrado=1200000, totalParcelas=12)

        texto = self._texto_do_script(client, auth, divida_id)
        # R$ 6.000 de capacidade menos R$ 1.000 da parcela do outro credor.
        assert formatar_brl(500000) in texto

    def test_capacidade_negativa_nao_vira_oferta(self, client, auth, sessao):
        # Prometer o que não se tem é pior que não propor valor nenhum.
        divida_id = self._com_contrato_lido(client, auth, sessao)
        _caixa(client, auth, renda=300000, essenciais=900000)

        texto = self._texto_do_script(client, auth, divida_id)
        assert "consigo comprometer" not in texto.lower()

    def test_o_valor_recitado_pelo_script_sai_do_mesmo_motor_que_o_simulador_le(
        self, client, auth, sessao
    ):
        """
        PF-3 (regressão): o valor que o script recita sai do MESMO motor que o
        simulador lê — `capacidade_atual`. Com uma dívida só, a oferta é a
        `capacidade_hoje` daquela leitura (nenhuma outra parcela a descontar).

        A premissa "F-011 e F-012 não têm interseção" vale por ARQUIVO, não por
        efeito: quando o F-011 entregar o compromisso percentual, a
        `capacidade_hoje` cai, e a oferta recitada cai junto — sem tocar arquivo
        desta feature. Se um dia o script passar a recitar um número que não é o
        da capacidade que o resto do app usa, é aqui que aparece.
        """
        from config import get_settings
        from leitura import capacidade_atual
        from routers.revisao import _capacidade_para_oferta

        divida_id = self._com_contrato_lido(client, auth, sessao)
        _caixa(client, auth, renda=1000000, essenciais=400000)

        tenant = get_settings().tenant_id
        oferta = _capacidade_para_oferta(sessao, tenant, divida_id)
        caixa = capacidade_atual(sessao, tenant, get_settings())
        assert caixa is not None
        # Uma dívida só: a oferta é a capacidade de hoje que o simulador também lê.
        assert oferta == caixa.capacidade_hoje

        # E é EXATAMENTE esse número que o script recita — não outro.
        texto = self._texto_do_script(client, auth, divida_id)
        assert formatar_brl(oferta) in texto


class TestFormatarBRL:
    def test_formata_em_pt_br(self):
        assert formatar_brl(123456) == "R$ 1.234,56"
        assert formatar_brl(0) == "R$ 0,00"
        assert formatar_brl(5) == "R$ 0,05"
        assert formatar_brl(100000000) == "R$ 1.000.000,00"

    def test_negativo_leva_o_sinal_antes_do_simbolo(self):
        assert formatar_brl(-50000) == "-R$ 500,00"


class TestRespiroNoSimulador:
    """
    O ponto do M11: o respiro entra ANTES do corte, e o teto do simulador cai
    junto — sem `routers/simulacoes.py` ter sido tocado.

    A cascata é uma só (`domain/caixa.py`) e o simulador lê o `aporte_maximo`
    dela por `leitura.capacidade_atual`. Se a queda precisasse de uma linha no
    simulador, o respiro seria a sobra que some quando aperta.
    """

    def _declarar(self, client, auth, valor, ativo=True):
        return client.put(
            "/v1/caixa/respiro",
            json={"valorMensal": valor, "ativo": ativo},
            headers=auth,
        )

    def test_o_teto_do_aporte_cai_para_quem_declarou_respiro(self, client, auth):
        # Renda R$ 10.000, essenciais R$ 4.000: capacidade R$ 6.000, menos a
        # parcela de R$ 1.000, dá R$ 5.000 de aporte. Um respiro de R$ 1.000
        # derruba o teto para R$ 4.000, e o aporte de R$ 4.900 deixa de caber.
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth)
        assert _simular(client, auth, 490000).status_code == 200

        assert self._declarar(client, auth, 100000).status_code == 200

        recusado = _simular(client, auth, 490000)
        assert recusado.status_code == 422
        assert recusado.json()["campo"] == "aporteExtraMensal"
        # Guardrail 5: a recusa não carrega valor.
        assert "R$" not in recusado.json()["message"]

    def test_o_respiro_desativado_devolve_o_teto(self, client, auth):
        # Desativar tira a linha da cascata sem apagar nada.
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth)
        self._declarar(client, auth, 100000)
        assert _simular(client, auth, 490000).status_code == 422

        self._declarar(client, auth, 100000, ativo=False)
        assert _simular(client, auth, 490000).status_code == 200

    def test_o_preco_em_meses_e_a_diferenca_das_duas_mesmas_simulacoes(
        self, client, auth
    ):
        """
        `custoEmMeses` NÃO É ESTIMATIVA NOVA.

        As duas simulações são feitas aqui pela rota pública do simulador,
        ANTES de declarar o respiro — enquanto os dois aportes ainda cabem no
        teto. O preço devolvido pelo `PUT` tem de ser exatamente a diferença
        entre elas: se um dia alguém escrever uma fórmula própria para o preço,
        é aqui que a suíte quebra.
        """
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth, valorCobrado=6000000, totalParcelas=60)

        # Aporte de R$ 5.000 é o teto de hoje; R$ 4.000 é o que sobraria com um
        # respiro de R$ 1.000.
        sem_respiro = _simular(client, auth, 500000).json()["simulacoes"][0]
        com_respiro = _simular(client, auth, 400000).json()["simulacoes"][0]
        prazo_a_mais = (
            com_respiro["mesesAteQuitacao"] - sem_respiro["mesesAteQuitacao"]
        )
        assert prazo_a_mais > 0

        preco = self._declarar(client, auth, 100000).json()["custoEmMeses"]
        assert preco == prazo_a_mais

    def test_sem_divida_o_preco_nao_e_afirmado(self, client, auth):
        # A tela grava sem preço em vez de exibir palpite.
        _caixa(client, auth, renda=1000000, essenciais=400000)
        assert self._declarar(client, auth, 100000).json()["custoEmMeses"] is None


class TestRespiroNosTresConsumidores:
    """
    O TESTE CRUZADO DO M11 (T8).

    Gêmeo do teste de M7.2 que ligou fonte de renda a painel preenchido — e que
    faltava justamente quando um defeito atravessou quatro gates verdes.

    `TestRespiroNoSimulador` (T2) já prova que um aporte que passava deixa de
    passar. O que ele NÃO prova é o outro lado nem os outros dois consumidores:

    1. o teto não desabou, ele desceu EXATAMENTE o valor declarado — um teto que
       cai demais recusaria plano sustentável e passaria por este gate igual;
    2. simulador, painel e card `plano_sugerido` do chat leem o mesmo
       `aporte_maximo` por `leitura.capacidade_atual`. Os três mudam de número
       neste milestone sem que nenhum dos três arquivos tenha sido tocado, e é
       essa ação a distância que precisa de teste — ela não aparece em diff.
    """

    RESPIRO = 100000

    def _declarar(self, client, auth, valor):
        r = client.put(
            "/v1/caixa/respiro",
            json={"valorMensal": valor, "ativo": True},
            headers=auth,
        )
        assert r.status_code == 200
        return r

    def _aporte_maximo(self, client, auth):
        return client.get("/v1/caixa", headers=auth).json()["caixa"]["aporteMaximo"]

    def _margem_do_painel(self, client, auth):
        r = client.get("/v1/dividas/resumo", headers=auth)
        return r.json()["resumo"]["margemDisponivel"]

    def _card_de_plano(self, client, auth):
        r = client.post(
            "/v1/chat/messages",
            json={"content": "quero um plano para quitar"},
            headers=auth,
        )
        cards = r.json()["message"]["cards"]
        return next(c for c in cards if c["kind"] == "plano_sugerido")

    def test_o_teto_do_simulador_desce_exatamente_o_respiro_declarado(self, client, auth):
        """
        Os DOIS lados, com e sem respiro, e nos dois o limite exato.

        O teto é lido de `GET /v1/caixa` em vez de escrito à mão: assim o teste
        prova o ACOPLAMENTO entre a cascata e o simulador, e não uma aritmética
        decorada que passaria a mentir junto com ela.
        """
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth)

        teto_sem = self._aporte_maximo(client, auth)
        assert _simular(client, auth, teto_sem).status_code == 200
        assert _simular(client, auth, teto_sem + 1).status_code == 422

        self._declarar(client, auth, self.RESPIRO)

        teto_com = self._aporte_maximo(client, auth)
        # Desceu o respiro inteiro, nem um centavo a mais.
        assert teto_com == teto_sem - self.RESPIRO
        assert _simular(client, auth, teto_com).status_code == 200
        assert _simular(client, auth, teto_com + 1).status_code == 422
        # E o aporte que passava antes é o que agora não cabe.
        assert _simular(client, auth, teto_sem).status_code == 422

    def test_o_painel_nao_anuncia_a_sobra_que_o_simulador_recusa(self, client, auth):
        """
        `margemDisponivel` do painel é o mesmo `aporte_maximo` do simulador.

        Se um dia o respiro entrar num e não no outro, o painel volta a prometer
        uma sobra que o simulador recusa — o defeito que o M7 fechou, voltando
        pela porta do M11.
        """
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth)

        margem_sem = self._margem_do_painel(client, auth)
        assert margem_sem == self._aporte_maximo(client, auth)

        self._declarar(client, auth, self.RESPIRO)

        margem_com = self._margem_do_painel(client, auth)
        assert margem_com == margem_sem - self.RESPIRO
        assert margem_com == self._aporte_maximo(client, auth)
        assert _simular(client, auth, margem_com).status_code == 200
        assert _simular(client, auth, margem_sem).status_code == 422

    def test_o_card_de_plano_do_chat_planeja_com_o_respiro_ja_descontado(self, client, auth):
        """
        Uma pergunta, um número — agora com respiro no meio.

        O card usa a capacidade real como aporte default (M7). Com respiro
        declarado, ele passa a propor um plano que a pessoa consegue sustentar
        sem parar de viver, e continua batendo com o simulador.
        """
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth)

        card_sem = self._card_de_plano(client, auth)
        assert card_sem["aporteExtraMensal"] == self._aporte_maximo(client, auth)

        self._declarar(client, auth, self.RESPIRO)

        card_com = self._card_de_plano(client, auth)
        assert card_com["aporteExtraMensal"] == card_sem["aporteExtraMensal"] - self.RESPIRO

        simulado = _simular(client, auth, card_com["aporteExtraMensal"]).json()["simulacoes"][0]
        assert card_com["mesesAteQuitacao"] == simulado["mesesAteQuitacao"]
        assert card_com["dataLiberdade"] == simulado["dataLiberdade"]

    def test_quem_nao_declarou_respiro_tem_os_tres_numeros_de_antes(self, client, auth):
        """
        A regressão do outro lado: sem declaração não há respiro, e nenhum dos
        três consumidores muda de número. É o que impede a linha nova de vazar
        para quem não pediu por ela.
        """
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        # `None`, nunca `0`: não declarar é diferente de declarar zero.
        assert caixa["respiro"] is None
        assert caixa["aporteMaximo"] == caixa["capacidadeMaxima"] - caixa["comprometidoDividas"]
        assert self._margem_do_painel(client, auth) == caixa["aporteMaximo"]
        assert self._card_de_plano(client, auth)["aporteExtraMensal"] == caixa["aporteMaximo"]
