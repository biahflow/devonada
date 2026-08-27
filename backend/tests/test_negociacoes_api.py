from datetime import date, timedelta

import orm
from routers.conta import tabelas_do_tenant

HOJE = date.today()


def _nova_divida(client, auth, **over) -> dict:
    base = {
        "credor": "Banco Teste S/A",
        "valorCobrado": 150000,
        "dataOrigem": "2021-06-01",
        "tipo": "juros_abusivos",
    }
    base.update(over)
    return client.post("/v1/dividas", json=base, headers=auth).json()["divida"]


def _outro_tenant(client) -> dict[str, str]:
    sessao = client.post(
        "/v1/auth/registro",
        json={"email": "vizinha@exemplo.com", "senha": "senha-da-vizinha"},
    ).json()["sessao"]
    return {"Authorization": f"Bearer {sessao['acesso']}"}


class TestRegistroELeitura:
    def test_grava_e_le_de_volta_com_canal_e_desfecho(self, client, auth):
        """T3-AC1: o resultado é gravado com canal e desfecho, e devolvido por rota de leitura."""
        d = _nova_divida(client, auth)

        r = client.post(
            f"/v1/dividas/{d['id']}/negociacoes",
            json={
                "canal": "telefone",
                "desfecho": "contraproposta",
                "valorProposto": 90000,
                "valorObtido": 110000,
                "observacao": "Ofereceram parcelar em 10x",
            },
            headers=auth,
        )
        assert r.status_code == 201, r.text
        criado = r.json()["resultado"]
        assert criado["canal"] == "telefone"
        assert criado["desfecho"] == "contraproposta"

        lidos = client.get(f"/v1/dividas/{d['id']}/negociacoes", headers=auth).json()["resultados"]
        assert len(lidos) == 1
        assert lidos[0]["id"] == criado["id"]
        assert lidos[0]["canal"] == "telefone"
        assert lidos[0]["valorProposto"] == 90000
        assert lidos[0]["valorObtido"] == 110000

    def test_leitura_do_tenant_junta_varias_dividas(self, client, auth):
        """GET /v1/negociacoes é o que constrói o benchmark do próprio tenant."""
        d1 = _nova_divida(client, auth, credor="Banco A")
        d2 = _nova_divida(client, auth, credor="Banco B")
        client.post(
            f"/v1/dividas/{d1['id']}/negociacoes",
            json={"canal": "chat", "desfecho": "recusa"},
            headers=auth,
        )
        client.post(
            f"/v1/dividas/{d2['id']}/negociacoes",
            json={"canal": "email", "desfecho": "sem_resposta"},
            headers=auth,
        )

        do_tenant = client.get("/v1/negociacoes", headers=auth).json()["resultados"]
        assert len(do_tenant) == 2
        canais = {x["canal"] for x in do_tenant}
        assert canais == {"chat", "email"}


class TestOsQuatroDesfechos:
    def test_os_quatro_sao_aceitos_inclusive_os_tres_sem_acordo(self, client, auth):
        """T3-AC2: recusa, contraproposta e silêncio são metade da informação do benchmark."""
        d = _nova_divida(client, auth)
        for desfecho in ("acordo", "recusa", "contraproposta", "sem_resposta"):
            r = client.post(
                f"/v1/dividas/{d['id']}/negociacoes",
                json={"canal": "telefone", "desfecho": desfecho},
                headers=auth,
            )
            assert r.status_code == 201, f"{desfecho}: {r.text}"

        lidos = client.get(f"/v1/dividas/{d['id']}/negociacoes", headers=auth).json()["resultados"]
        assert {x["desfecho"] for x in lidos} == {
            "acordo",
            "recusa",
            "contraproposta",
            "sem_resposta",
        }

    def test_recusa_nao_exige_valor_de_acordo(self, client, auth):
        """T3-AC2: registrar recusa não pode exigir preencher valor."""
        d = _nova_divida(client, auth)
        r = client.post(
            f"/v1/dividas/{d['id']}/negociacoes",
            json={"canal": "chat", "desfecho": "recusa"},
            headers=auth,
        )
        assert r.status_code == 201, r.text
        criado = r.json()["resultado"]
        assert criado["valorProposto"] is None
        assert criado["valorObtido"] is None


class TestRenegociacaoId:
    def test_acordo_aceita_renegociacao_id(self, client, auth):
        """T3-AC3: desfecho acordo aceita renegociacaoId."""
        d = _nova_divida(client, auth)
        r = client.post(
            f"/v1/dividas/{d['id']}/negociacoes",
            json={
                "canal": "email",
                "desfecho": "acordo",
                "valorObtido": 90000,
                "renegociacaoId": "alguma-renegociacao-id",
            },
            headers=auth,
        )
        assert r.status_code == 201, r.text
        assert r.json()["resultado"]["renegociacaoId"] == "alguma-renegociacao-id"

    def test_desfecho_sem_acordo_nao_aceita_renegociacao_id(self, client, auth):
        """T3-AC3: os demais desfechos deixam renegociacaoId nulo — informar é 422."""
        d = _nova_divida(client, auth)
        r = client.post(
            f"/v1/dividas/{d['id']}/negociacoes",
            json={
                "canal": "telefone",
                "desfecho": "recusa",
                "renegociacaoId": "nao-devia-existir",
            },
            headers=auth,
        )
        assert r.status_code == 422, r.text

    def test_desfecho_sem_acordo_grava_renegociacao_id_nulo(self, client, auth):
        d = _nova_divida(client, auth)
        r = client.post(
            f"/v1/dividas/{d['id']}/negociacoes",
            json={"canal": "chat", "desfecho": "sem_resposta"},
            headers=auth,
        )
        assert r.status_code == 201
        assert r.json()["resultado"]["renegociacaoId"] is None


class TestTenant:
    def test_registrar_em_divida_de_outro_tenant_devolve_404(self, client, auth):
        """T3-AC6: recurso de outro tenant devolve 404, nunca 403."""
        outra = _outro_tenant(client)
        d_da_outra = _nova_divida(client, outra, credor="Banco da Outra")

        r = client.post(
            f"/v1/dividas/{d_da_outra['id']}/negociacoes",
            json={"canal": "telefone", "desfecho": "recusa"},
            headers=auth,
        )
        assert r.status_code == 404

    def test_ler_divida_de_outro_tenant_devolve_404(self, client, auth):
        outra = _outro_tenant(client)
        d_da_outra = _nova_divida(client, outra, credor="Banco da Outra")

        r = client.get(f"/v1/dividas/{d_da_outra['id']}/negociacoes", headers=auth)
        assert r.status_code == 404

    def test_benchmark_nao_vaza_entre_tenants(self, client, auth):
        d = _nova_divida(client, auth)
        client.post(
            f"/v1/dividas/{d['id']}/negociacoes",
            json={"canal": "telefone", "desfecho": "acordo", "valorObtido": 90000},
            headers=auth,
        )

        outra = _outro_tenant(client)
        assert client.get("/v1/negociacoes", headers=outra).json()["resultados"] == []


class TestNaoDisparaMarco:
    def test_registrar_resultado_nao_dispara_primeira_negociacao(self, client, auth):
        """
        T3-AC5: o marco é do ACORDO, em `parcelas.renegociar`. Registrar um
        resultado — mesmo com desfecho acordo — não pode disparar marco, ou ele
        seria atingível sem que nada tenha sido acordado no contrato.
        """
        d = _nova_divida(client, auth)
        client.post(
            f"/v1/dividas/{d['id']}/negociacoes",
            json={"canal": "email", "desfecho": "acordo", "valorObtido": 90000},
            headers=auth,
        )

        marcos = client.get("/v1/marcos", headers=auth).json()["marcos"]
        primeira = next(m for m in marcos if m["tipo"] == "primeira_negociacao")
        assert primeira["atingidoEm"] is None

    def test_renegociacao_de_verdade_continua_disparando_o_marco(self, client, auth):
        """A regressão do M11 segue verde: o acordo em parcelas.renegociar dispara o marco."""
        d = _nova_divida(
            client, auth, totalParcelas=7, primeiroVencimento=str(HOJE + timedelta(days=10))
        )
        client.post(
            f"/v1/dividas/{d['id']}/renegociacao",
            json={
                "novoValor": 90000,
                "novoTotalParcelas": 3,
                "primeiroVencimento": str(HOJE + timedelta(days=30)),
            },
            headers=auth,
        )
        marcos = client.get("/v1/marcos", headers=auth).json()["marcos"]
        primeira = next(m for m in marcos if m["tipo"] == "primeira_negociacao")
        assert primeira["atingidoEm"] == HOJE.isoformat()


class TestEntraNaVarreduraDeExclusao:
    def test_resultado_negociacao_entra_sozinha_em_tabelas_do_tenant(self):
        """
        T3-AC4: a tabela nova tem `tenant_id` e aparece na varredura derivada do
        metadata, sem ninguém ter editado `routers/conta.py`. É a aposta do
        `tenant_id` cobrando de novo, como cobrou as quatro tabelas do M11.
        """
        varridas = {t.name for t in tabelas_do_tenant()}
        assert "resultado_negociacao" in varridas

    def test_exclusao_de_conta_apaga_o_resultado(self, client, auth, sessao):
        from config import get_settings
        from tests.conftest import CONTA_SENHA

        d = _nova_divida(client, auth)
        client.post(
            f"/v1/dividas/{d['id']}/negociacoes",
            json={"canal": "telefone", "desfecho": "recusa"},
            headers=auth,
        )
        tenant = get_settings().tenant_id
        assert sessao.query(orm.ResultadoNegociacao).filter_by(tenant_id=tenant).count() == 1

        client.request("DELETE", "/v1/conta", json={"senha": CONTA_SENHA}, headers=auth)
        assert sessao.query(orm.ResultadoNegociacao).filter_by(tenant_id=tenant).count() == 0
