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

    def test_sem_caixa_o_script_nao_promete_valor(self, client, auth, sessao):
        divida_id = self._com_contrato_lido(client, auth, sessao)
        script = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"][
            "script"
        ]
        assert script is not None
        assert "consigo comprometer" not in script.lower()

    def test_com_caixa_o_script_faz_uma_oferta_ancorada(self, client, auth, sessao):
        # É o que muda a conversa com o credor: "quero desconto" é pedido,
        # "consigo pagar R$ X por mês" é oferta.
        divida_id = self._com_contrato_lido(client, auth, sessao)
        _caixa(client, auth, renda=1000000, essenciais=400000)

        script = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"][
            "script"
        ]
        assert "consigo comprometer" in script.lower()
        # Capacidade de hoje (R$ 6.000), e não a máxima: a oferta tem de caber
        # na vida que a pessoa leva hoje. A parcela DESTA dívida não é
        # descontada — o acordo substitui a prestação dela.
        assert formatar_brl(600000) in script

    def test_a_oferta_desconta_as_parcelas_das_OUTRAS_dividas(self, client, auth, sessao):
        # Oferecer a capacidade cheia a um credor quando existem dois é prometer
        # o mesmo dinheiro duas vezes.
        divida_id = self._com_contrato_lido(client, auth, sessao)
        _caixa(client, auth, renda=1000000, essenciais=400000)
        _divida(client, auth, credor="Outro Banco", valorCobrado=1200000, totalParcelas=12)

        script = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"][
            "script"
        ]
        # R$ 6.000 de capacidade menos R$ 1.000 da parcela do outro credor.
        assert formatar_brl(500000) in script

    def test_capacidade_negativa_nao_vira_oferta(self, client, auth, sessao):
        # Prometer o que não se tem é pior que não propor valor nenhum.
        divida_id = self._com_contrato_lido(client, auth, sessao)
        _caixa(client, auth, renda=300000, essenciais=900000)

        script = client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth).json()["revisao"][
            "script"
        ]
        assert "consigo comprometer" not in script.lower()


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
