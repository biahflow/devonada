import json
from datetime import datetime, timedelta, timezone

from assinatura import ESCRITA, LIVRES
from main import app
from tests.conftest import recibo_de_memoria

"""
A trava de escrita e as duas rotas de cobrança (M9, ADR 0013).
"""

NOVA_DIVIDA = {
    "credor": "Banco Teste S/A",
    "valorCobrado": 150000,
    "dataOrigem": "2021-06-01",
    "tipo": "juros_abusivos",
}

NOVO_GASTO = {
    "descricao": "Aluguel",
    "categoria": "moradia",
    "essencial": True,
    "fixo": True,
    "valorMensal": 250000,
}


class TestTravaDeEscrita:
    def test_dentro_do_teste_a_escrita_passa(self, client, auth):
        r = client.post(
            "/v1/dividas",
            json=NOVA_DIVIDA,
            headers=auth,
        )
        assert r.status_code == 201, r.text

    def test_passado_o_teste_a_escrita_devolve_402(self, client, auth, assinatura_vencida):
        assinatura_vencida()
        r = client.post(
            "/v1/dividas",
            json=NOVA_DIVIDA,
            headers=auth,
        )
        assert r.status_code == 402
        assert "período de teste" in r.json()["message"]

    def test_a_leitura_continua_livre_depois_do_teste(self, client, auth, assinatura_vencida):
        """
        A decisão de produto inteira em um teste: quem parou de pagar continua
        vendo as próprias dívidas. Trancar alguém endividado para fora da lista
        das dívidas dele é o oposto do que este produto existe para fazer.
        """
        criada = client.post(
            "/v1/dividas",
            json=NOVA_DIVIDA,
            headers=auth,
        )
        divida_id = criada.json()["divida"]["id"]

        assinatura_vencida()

        assert client.get("/v1/dividas", headers=auth).status_code == 200
        assert client.get(f"/v1/dividas/{divida_id}", headers=auth).status_code == 200
        assert client.get("/v1/dividas/resumo", headers=auth).status_code == 200
        assert client.get("/v1/caixa", headers=auth).status_code == 200
        assert client.get("/v1/chat/messages", headers=auth).status_code == 200

    def test_excluir_a_conta_nunca_e_bloqueado(self, client, auth, assinatura_vencida):
        """
        Apple, diretriz 5.1.1(v), e art. 18 do LGPD. Reter o dado de quem pediu
        para apagá-lo por causa de assinatura vencida reprovaria na revisão — e
        seria errado antes disso.
        """
        assinatura_vencida()
        r = client.request(
            "DELETE", "/v1/conta", json={"senha": "senha-de-teste"}, headers=auth
        )
        assert r.status_code == 204

    def test_entrar_nunca_e_bloqueado(self, client, auth, assinatura_vencida):
        assinatura_vencida()
        r = client.post(
            "/v1/auth/login",
            json={"email": "teste@exemplo.com", "senha": "senha-de-teste"},
        )
        assert r.status_code == 200

    def test_a_simulacao_entra_na_trava_mesmo_sem_gravar_nada(
        self, client, auth, assinatura_vencida
    ):
        """
        `POST /v1/dividas/simulacoes` não persiste — é cálculo puro. Ela entra na
        trava assim mesmo, porque a regra é o MÉTODO e não a persistência, e
        porque o simulador é o argumento de valor do produto. Se um dia isso
        precisar mudar, muda `LIVRES` e este teste quebra junto, que é o ponto.
        """
        assinatura_vencida()
        r = client.post("/v1/dividas/simulacoes", json={"aporteExtraMensal": 0}, headers=auth)
        assert r.status_code == 402

    def test_sem_token_a_trava_responde_401_e_nao_402(self, client):
        """
        Quem não está logado não é quem não pagou. Um 402 aqui contaria que
        existe conta por trás daquele caminho, e mandaria a tela de login para
        a de assinatura.
        """
        r = client.post("/v1/dividas", json=NOVA_DIVIDA)
        assert r.status_code == 401


class TestVarreduraDeRotas:
    def test_toda_rota_de_escrita_esta_travada_ou_declarada_livre(self):
        """
        Gêmeo do teste que varre as tabelas na exclusão de conta.

        A trava é derivada do método, então este teste não confere se alguém
        lembrou de aplicá-la — ela é global. O que ele confere é a OUTRA metade:
        que ninguém ampliou `LIVRES` sem perceber o que estava liberando. Rota
        de escrita nova em `/v1/auth`, `/v1/assinatura` ou `/v1/conta` nasceria
        gratuita em silêncio.

        Ele falha listando o caminho, para a decisão ser consciente.
        """
        livres = {
            f"{metodo} {caminho}"
            for caminho, ops in app.openapi()["paths"].items()
            for metodo in (m.upper() for m in ops)
            if metodo in ESCRITA and any(caminho.startswith(p) for p in LIVRES)
        }

        esperadas = {
            "POST /v1/auth/registro",
            "POST /v1/auth/login",
            # Entrar pela Apple ou pelo Google é ENTRAR, e entrar não pode
            # custar assinatura: uma trava aqui seria o mesmo deadlock do
            # login, só que pelo outro botão. Ver ADR 0023.
            "POST /v1/auth/social",
            "POST /v1/auth/refresh",
            "POST /v1/auth/logout",
            "POST /v1/auth/senha/recuperacao",
            "POST /v1/auth/senha/redefinicao",
            "POST /v1/assinatura/compra",
            "DELETE /v1/conta",
        }

        assert livres == esperadas, (
            "Uma rota de escrita passou a ser gratuita sem decisão explícita. "
            f"Entraram: {sorted(livres - esperadas)}. Saíram: {sorted(esperadas - livres)}."
        )

    def test_nenhuma_rota_grava_por_get(self):
        """
        A premissa que faz a trava por método ser suficiente. Se um dia alguém
        escrever um `GET .../ativar`, a trava para de valer e este teste é o
        único lugar onde isso aparece.
        """
        suspeitos = [
            caminho
            for caminho, ops in app.openapi()["paths"].items()
            if "get" in ops
            and any(
                v in caminho
                for v in ("criar", "ativar", "desativar", "quitacao", "pagamento", "excluir")
            )
        ]
        assert suspeitos == [], f"GET com cara de escrita: {suspeitos}"


class TestSituacao:
    def test_conta_nova_responde_em_teste(self, client, auth):
        r = client.get("/v1/assinatura", headers=auth)
        assert r.status_code == 200
        corpo = r.json()
        assert corpo["status"] == "em_teste"
        assert corpo["podeEscrever"] is True
        assert corpo["diasRestantes"] == 7
        # Quem está no teste não tem produto: não comprou nada.
        assert corpo["produtoId"] is None

    def test_a_rota_de_situacao_nao_devolve_preco(self, client, auth):
        """
        O preço vem da loja pelo SDK, já localizado. Servi-lo daqui mentiria
        para quem está em outro país e envelheceria na primeira promoção.
        """
        corpo = client.get("/v1/assinatura", headers=auth).json()
        assert not any("preco" in c.lower() or "price" in c.lower() for c in corpo)

    def test_conta_velha_responde_expirada(self, client, auth, assinatura_vencida):
        assinatura_vencida()
        corpo = client.get("/v1/assinatura", headers=auth).json()
        assert corpo["status"] == "expirada"
        assert corpo["podeEscrever"] is False
        assert corpo["diasRestantes"] == 0


class TestCompra:
    def test_compra_valida_destrava_a_escrita(self, client, auth, assinatura_vencida):
        assinatura_vencida()
        assert client.post("/v1/caixa/gastos", json={}, headers=auth).status_code == 402

        r = client.post(
            "/v1/assinatura/compra",
            json={"plataforma": "ios", "recibo": recibo_de_memoria()},
            headers=auth,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "ativa"
        assert r.json()["produtoId"] == "devonada.assinatura.mensal"

        # E agora a mesma escrita passa — o 402 sai do caminho sem novo login.
        r = client.post(
            "/v1/caixa/gastos",
            json=NOVO_GASTO,
            headers=auth,
        )
        assert r.status_code == 201, r.text

    def test_restaurar_o_mesmo_recibo_nao_duplica(self, client, auth, sessao):
        """
        O botão "Restaurar compras" que a Apple exige manda o mesmo recibo para
        a mesma rota. A unicidade é do BANCO, não da rota: dois toques
        simultâneos passam pelo mesmo SELECT sem achar nada.
        """
        import orm

        recibo = recibo_de_memoria(transacao="txn-restauracao")
        for _ in range(3):
            r = client.post(
                "/v1/assinatura/compra",
                json={"plataforma": "ios", "recibo": recibo},
                headers=auth,
            )
            assert r.status_code == 200, r.text

        assert sessao.query(orm.Assinatura).count() == 1

    def test_renovacao_atualiza_a_linha_em_vez_de_criar_outra(self, client, auth, sessao):
        import orm

        client.post(
            "/v1/assinatura/compra",
            json={"plataforma": "ios", "recibo": recibo_de_memoria(dias=30)},
            headers=auth,
        )
        r = client.post(
            "/v1/assinatura/compra",
            json={"plataforma": "ios", "recibo": recibo_de_memoria(dias=60)},
            headers=auth,
        )
        assert r.status_code == 200

        assert sessao.query(orm.Assinatura).count() == 1
        assert r.json()["diasRestantes"] == 60

    def test_recibo_ilegivel_devolve_422_com_frase_de_leigo(self, client, auth):
        r = client.post(
            "/v1/assinatura/compra",
            json={"plataforma": "ios", "recibo": "nao-e-json"},
            headers=auth,
        )
        assert r.status_code == 422
        mensagem = r.json()["message"]
        assert "conferir sua compra" in mensagem
        # Sem jargão de loja nem código de status na cara do usuário.
        assert "JSON" not in mensagem and "500" not in mensagem

    def test_compra_de_terceiro_com_a_mesma_transacao_leva_409(self, client, auth):
        """
        Mesma Apple ID em duas contas do nosso app. Recusar a segunda é o
        comportamento certo — e a frase diz o que houve sem acusar ninguém.
        """
        recibo = recibo_de_memoria(transacao="txn-compartilhada")
        assert (
            client.post(
                "/v1/assinatura/compra",
                json={"plataforma": "ios", "recibo": recibo},
                headers=auth,
            ).status_code
            == 200
        )

        outra = client.post(
            "/v1/auth/registro", json={"email": "outra@exemplo.com", "senha": "senha-de-teste"}
        )
        cabecalho = {"Authorization": f"Bearer {outra.json()['sessao']['acesso']}"}

        r = client.post(
            "/v1/assinatura/compra",
            json={"plataforma": "ios", "recibo": recibo},
            headers=cabecalho,
        )
        assert r.status_code == 409
        assert "outra conta" in r.json()["message"]

    def test_a_assinatura_some_com_a_conta(self, client, auth, sessao):
        """
        Não é teste desta rota, é a prova de que `tenant_id` foi suficiente: a
        varredura de `conta.tabelas_do_tenant()` é derivada do metadata, então
        `assinatura` entrou na exclusão sem uma linha a mais.
        """
        import orm

        client.post(
            "/v1/assinatura/compra",
            json={"plataforma": "ios", "recibo": recibo_de_memoria()},
            headers=auth,
        )
        assert sessao.query(orm.Assinatura).count() == 1

        client.request("DELETE", "/v1/conta", json={"senha": "senha-de-teste"}, headers=auth)
        sessao.expire_all()
        assert sessao.query(orm.Assinatura).count() == 0


class TestReconferencia:
    def test_registro_vencido_e_reconferido_na_loja(self, client, auth, sessao):
        """
        O que substitui webhook: a renovação acontece no servidor da loja sem
        nos avisar, e sem reconferir o usuário que pagou em dia veria
        "expirada" — e alguns tocariam em comprar de novo, pagando duas vezes.

        O adaptador de memória guarda o próprio JSON em `chave_consulta`, então
        reescrevê-lo com data futura é exatamente o que a loja faria ao renovar.
        """
        import orm

        client.post(
            "/v1/assinatura/compra",
            json={"plataforma": "ios", "recibo": recibo_de_memoria(dias=30)},
            headers=auth,
        )

        linha = sessao.query(orm.Assinatura).one()
        linha.expira_em = datetime.now(timezone.utc) - timedelta(days=1)
        linha.chave_consulta = json.dumps(
            {
                **json.loads(linha.chave_consulta),
                "expiraEm": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            }
        )
        sessao.commit()

        corpo = client.get("/v1/assinatura", headers=auth).json()
        assert corpo["status"] == "ativa"
        assert corpo["diasRestantes"] == 30

    def test_loja_fora_do_ar_devolve_o_que_esta_gravado(
        self, client, auth, sessao, assinatura_vencida
    ):
        """
        Tirar acesso de quem pagou porque a Apple teve instabilidade é o erro
        caro; responder com o registro local é o barato.

        A conta é envelhecida porque senão o TESTE de 7 dias responderia por ela
        e o cenário provaria outra coisa: o piso do teste, não o comportamento
        do registro local quando a loja não responde.
        """
        import orm

        assinatura_vencida()
        client.post(
            "/v1/assinatura/compra",
            json={"plataforma": "ios", "recibo": recibo_de_memoria(dias=30)},
            headers=auth,
        )

        linha = sessao.query(orm.Assinatura).one()
        linha.expira_em = datetime.now(timezone.utc) - timedelta(days=1)
        linha.chave_consulta = "recibo-que-a-loja-nao-le"
        sessao.commit()

        r = client.get("/v1/assinatura", headers=auth)
        assert r.status_code == 200
        assert r.json()["status"] == "expirada"
