import orm
from config import get_settings
from routers.conta import TABELAS_POR_USUARIO, tabelas_do_tenant
from tests.conftest import CONTA_EMAIL, CONTA_SENHA


def _semear_tudo(client, auth):
    """Deixa dado do usuário em quantas tabelas a API alcançar."""
    divida = client.post(
        "/v1/dividas",
        json={
            "credor": "Banco Teste S/A",
            "valorCobrado": 150000,
            "dataOrigem": "2021-06-01",
            "tipo": "consumo",
            "totalParcelas": 12,
            "primeiroVencimento": "2026-09-01",
        },
        headers=auth,
    ).json()["divida"]

    client.put(
        "/v1/perfil",
        json={"rendaMensal": 500000, "dependentes": 1, "horaLembrete": "09:00"},
        headers=auth,
    )
    client.post(
        "/v1/caixa/gastos",
        json={"nome": "Aluguel", "valorMensal": 150000, "essencial": True, "fixo": True},
        headers=auth,
    )
    client.get("/v1/dividas/resumo", headers=auth)
    return divida


class TestExclusaoDeConta:
    def test_apaga_a_conta_e_o_acesso_deixa_de_funcionar(self, client, auth):
        _semear_tudo(client, auth)

        r = client.request("DELETE", "/v1/conta", json={"senha": CONTA_SENHA}, headers=auth)
        assert r.status_code == 204

        assert (
            client.post(
                "/v1/auth/login", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA}
            ).status_code
            == 401
        )

    def test_nao_sobra_linha_em_tabela_nenhuma(self, client, auth, sessao):
        _semear_tudo(client, auth)
        tenant = get_settings().tenant_id

        # Sem isto o teste passaria de graça, provando que zero continua zero.
        # O número é baixo de propósito: subir a barra transformaria a adição de
        # uma tabela nova em falha deste teste, e não é isso que ele vigia.
        com_dado = [
            t.name
            for t in tabelas_do_tenant()
            if sessao.execute(t.select().where(t.c.tenant_id == tenant)).all()
        ]
        assert len(com_dado) >= 5, f"o cenário semeou pouco: {com_dado}"

        client.request("DELETE", "/v1/conta", json={"senha": CONTA_SENHA}, headers=auth)

        for tabela in tabelas_do_tenant():
            sobrou = sessao.execute(tabela.select().where(tabela.c.tenant_id == tenant)).all()
            assert sobrou == [], f"sobrou dado em {tabela.name}"

    def test_apaga_o_codigo_de_recuperacao(self, client, auth, sessao):
        """Ele é chaveado por usuário e não cai na varredura por tenant."""
        client.post("/v1/auth/senha/recuperacao", json={"email": CONTA_EMAIL})
        assert sessao.query(orm.CodigoRecuperacao).count() == 1

        client.request("DELETE", "/v1/conta", json={"senha": CONTA_SENHA}, headers=auth)
        assert sessao.query(orm.CodigoRecuperacao).count() == 0

    def test_derruba_as_sessoes_abertas(self, client, auth):
        refresh = client.post(
            "/v1/auth/login", json={"email": CONTA_EMAIL, "senha": CONTA_SENHA}
        ).json()["sessao"]["refresh"]

        client.request("DELETE", "/v1/conta", json={"senha": CONTA_SENHA}, headers=auth)

        assert client.post("/v1/auth/refresh", json={"refresh": refresh}).status_code == 401

    def test_a_senha_errada_nao_apaga_nada(self, client, auth, sessao):
        _semear_tudo(client, auth)

        r = client.request("DELETE", "/v1/conta", json={"senha": "nao-e-a-senha"}, headers=auth)
        assert r.status_code == 401
        assert sessao.query(orm.Divida).count() == 1

    def test_exige_autenticacao(self, client):
        assert client.request("DELETE", "/v1/conta", json={"senha": CONTA_SENHA}).status_code == 401

    def test_nao_toca_nos_dados_de_outra_conta(self, client, auth, sessao):
        _semear_tudo(client, auth)

        outra = client.post(
            "/v1/auth/registro", json={"email": "outra@exemplo.com", "senha": "senha-da-outra"}
        ).json()["sessao"]
        cabecalho = {"Authorization": f"Bearer {outra['acesso']}"}
        client.post(
            "/v1/dividas",
            json={
                "credor": "Banco da Outra",
                "valorCobrado": 100,
                "dataOrigem": "2021-06-01",
                "tipo": "consumo",
            },
            headers=cabecalho,
        )

        client.request("DELETE", "/v1/conta", json={"senha": CONTA_SENHA}, headers=auth)

        restantes = client.get("/v1/dividas", headers=cabecalho).json()["dividas"]
        assert [d["credor"] for d in restantes] == ["Banco da Outra"]


class TestNenhumaTabelaFicaDeFora:
    """
    O gate que impede o esquecimento.

    Sem ele, a próxima migration cria uma tabela, ninguém lembra desta rota, e o
    dado do usuário excluído fica no banco — um buraco que só aparece numa
    auditoria de loja, meses depois.
    """

    def test_toda_tabela_e_apagada_por_tenant_ou_esta_declarada(self):
        varridas = {t.name for t in tabelas_do_tenant()}
        conhecidas = varridas | TABELAS_POR_USUARIO

        esquecidas = set(orm.Base.metadata.tables) - conhecidas

        assert not esquecidas, (
            f"Tabelas sem exclusão de conta: {sorted(esquecidas)}. "
            "Dê a elas uma coluna `tenant_id` ou declare-as em "
            "routers.conta.TABELAS_POR_USUARIO, apagando-as na rota."
        )

    def test_as_declaradas_por_usuario_existem_de_verdade(self):
        """Nome errado na lista a tornaria uma isenção silenciosa."""
        assert TABELAS_POR_USUARIO <= set(orm.Base.metadata.tables)

    def test_a_conta_e_a_sessao_entram_na_varredura(self):
        varridas = {t.name for t in tabelas_do_tenant()}
        assert {"usuario", "sessao"} <= varridas


class TestPaginaPublicaDeExclusao:
    def test_responde_sem_autenticacao(self, client):
        r = client.get("/exclusao")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]

    def test_diz_como_excluir_e_o_que_e_apagado(self, client):
        corpo = client.get("/exclusao").text.lower()
        assert "excluir minha conta" in corpo
        assert "dívidas" in corpo
        assert "@" in corpo  # contato para quem perdeu o acesso
