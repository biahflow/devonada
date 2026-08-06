from datetime import date, timedelta

HOJE = date.today()


def _nova(**over):
    base = {
        "credor": "Banco Teste S/A",
        "valorCobrado": 150000,
        "dataOrigem": "2021-06-01",
        "tipo": "juros_abusivos",
    }
    base.update(over)
    return base


def _com_carne(client, auth, **over):
    corpo = _nova(totalParcelas=7, primeiroVencimento=str(HOJE + timedelta(days=10)), **over)
    return client.post("/v1/dividas", json=corpo, headers=auth).json()["divida"]


class TestGeracaoNoCadastro:
    def test_sem_parcelas_nao_gera_carne(self, client, auth):
        d = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        assert client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"] == []

    def test_gera_o_carne_completo(self, client, auth):
        d = _com_carne(client, auth)
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert len(parcelas) == 7
        assert [p["numero"] for p in parcelas] == [1, 2, 3, 4, 5, 6, 7]

    def test_soma_das_parcelas_bate_com_a_divida(self, client, auth):
        d = _com_carne(client, auth)
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert sum(p["valor"] for p in parcelas) == 150000

    def test_so_numero_de_parcelas_e_rejeitado(self, client, auth):
        r = client.post("/v1/dividas", json=_nova(totalParcelas=7), headers=auth)
        assert r.status_code == 422
        assert r.json()["campo"] == "primeiroVencimento"

    def test_so_data_e_rejeitada(self, client, auth):
        r = client.post("/v1/dividas", json=_nova(primeiroVencimento="2026-09-10"), headers=auth)
        assert r.status_code == 422
        assert r.json()["campo"] == "totalParcelas"

    def test_parcelas_de_outra_divida_nao_vazam(self, client, auth):
        a = _com_carne(client, auth)
        b = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        assert len(client.get(f"/v1/dividas/{a['id']}/parcelas", headers=auth).json()["parcelas"]) == 7
        assert client.get(f"/v1/dividas/{b['id']}/parcelas", headers=auth).json()["parcelas"] == []


class TestPagamento:
    def test_marca_como_paga(self, client, auth):
        d = _com_carne(client, auth)
        p = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"][0]
        r = client.post(
            f"/v1/parcelas/{p['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
            headers=auth,
        )
        assert r.status_code == 200
        assert r.json()["parcela"]["situacao"] == "paga"

    def test_pagar_duas_vezes_devolve_409(self, client, auth):
        d = _com_carne(client, auth)
        p = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"][0]
        corpo = {"pagoEm": str(HOJE), "valorPago": p["valor"]}
        client.post(f"/v1/parcelas/{p['id']}/pagamento", json=corpo, headers=auth)
        r = client.post(f"/v1/parcelas/{p['id']}/pagamento", json=corpo, headers=auth)
        assert r.status_code == 409

    def test_parcela_inexistente_devolve_404(self, client, auth):
        r = client.post(
            "/v1/parcelas/00000000-0000-0000-0000-000000000999/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": 1000},
            headers=auth,
        )
        assert r.status_code == 404

    def test_pagar_a_ultima_quita_a_divida(self, client, auth):
        # O usuário não deveria precisar marcar duas coisas para dizer o mesmo.
        d = client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=2, primeiroVencimento=str(HOJE + timedelta(days=10))),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]

        for p in parcelas[:-1]:
            client.post(
                f"/v1/parcelas/{p['id']}/pagamento",
                json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
                headers=auth,
            )
        assert client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]["situacao"] == "ativa"

        ultima = parcelas[-1]
        client.post(
            f"/v1/parcelas/{ultima['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": ultima["valor"]},
            headers=auth,
        )
        assert (
            client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]["situacao"]
            == "quitada"
        )

    def test_parcela_vencida_aparece_como_atrasada(self, client, auth):
        d = client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=2, primeiroVencimento=str(HOJE - timedelta(days=40))),
            headers=auth,
        ).json()["divida"]
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        assert parcelas[0]["situacao"] == "atrasada"


class TestRenegociacao:
    def test_preserva_as_parcelas_pagas_e_gera_novas(self, client, auth):
        d = _com_carne(client, auth)
        antes = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        client.post(
            f"/v1/parcelas/{antes[0]['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": antes[0]["valor"]},
            headers=auth,
        )

        r = client.post(
            f"/v1/dividas/{d['id']}/renegociacao",
            json={
                "novoValor": 90000,
                "novoTotalParcelas": 3,
                "primeiroVencimento": str(HOJE + timedelta(days=30)),
                "observacao": "Acordo por telefone",
            },
            headers=auth,
        )
        assert r.status_code == 200
        assert r.json()["divida"]["situacao"] == "renegociada"

        depois = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        # A paga continua; as pendentes viraram 3 novas.
        pagas = [p for p in depois if p["situacao"] == "paga"]
        novas = [p for p in depois if p["situacao"] != "paga"]
        assert len(pagas) == 1
        assert len(novas) == 3
        assert sum(p["valor"] for p in novas) == 90000

    def test_atualiza_o_valor_da_divida(self, client, auth):
        d = _com_carne(client, auth)
        client.post(
            f"/v1/dividas/{d['id']}/renegociacao",
            json={
                "novoValor": 90000,
                "novoTotalParcelas": 3,
                "primeiroVencimento": str(HOJE + timedelta(days=30)),
            },
            headers=auth,
        )
        assert (
            client.get(f"/v1/dividas/{d['id']}", headers=auth).json()["divida"]["valorCobrado"]
            == 90000
        )


class TestLembretes:
    def test_sem_parcelas_nao_ha_lembrete(self, client, auth):
        assert client.get("/v1/lembretes", headers=auth).json()["lembretes"] == []

    def test_parcela_dentro_da_janela_gera_lembrete(self, client, auth):
        client.post(
            "/v1/dividas",
            json=_nova(credor="Nubank", totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=2))),
            headers=auth,
        )
        lembretes = client.get("/v1/lembretes", headers=auth).json()["lembretes"]
        assert len(lembretes) == 1
        assert "Nubank" in lembretes[0]["titulo"]
        assert "vence em 2 dias" in lembretes[0]["titulo"]

    def test_parcela_fora_da_janela_nao_gera(self, client, auth):
        client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=60))),
            headers=auth,
        )
        assert client.get("/v1/lembretes", headers=auth).json()["lembretes"] == []

    def test_parcela_paga_nao_gera_lembrete(self, client, auth):
        d = client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=2))),
            headers=auth,
        ).json()["divida"]
        p = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"][0]
        client.post(
            f"/v1/parcelas/{p['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": p["valor"]},
            headers=auth,
        )
        assert client.get("/v1/lembretes", headers=auth).json()["lembretes"] == []

    def test_texto_vem_pronto_com_moeda_formatada(self, client, auth):
        client.post(
            "/v1/dividas",
            json=_nova(valorCobrado=45000, totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=1))),
            headers=auth,
        )
        lembrete = client.get("/v1/lembretes", headers=auth).json()["lembretes"][0]
        assert "R$ 450,00" in lembrete["corpo"]
        assert "vence amanhã" in lembrete["titulo"]

    def test_tom_neutro_sem_linguagem_de_cobranca(self, client, auth):
        client.post(
            "/v1/dividas",
            json=_nova(totalParcelas=1, primeiroVencimento=str(HOJE + timedelta(days=1))),
            headers=auth,
        )
        lembrete = client.get("/v1/lembretes", headers=auth).json()["lembretes"][0]
        texto = (lembrete["titulo"] + lembrete["corpo"]).lower()
        for proibido in ("atenção", "urgente", "atraso", "!", "pendência", "regularize"):
            assert proibido not in texto

    def test_devolve_a_hora_configurada(self, client, auth):
        client.put("/v1/perfil", json={"horaLembrete": "20:30"}, headers=auth)
        assert client.get("/v1/lembretes", headers=auth).json()["horaLembrete"] == "20:30"


class TestResumoComParcelas:
    def test_proximos_vencimentos_deixa_de_ser_vazio(self, client, auth):
        _com_carne(client, auth)
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert len(resumo["proximosVencimentos"]) > 0
        assert resumo["proximosVencimentos"][0]["credor"] == "Banco Teste S/A"

    def test_comprometimento_usa_parcelas_reais(self, client, auth):
        client.put("/v1/perfil", json={"rendaMensal": 500000}, headers=auth)
        primeiro = HOJE.replace(day=1)
        client.post(
            "/v1/dividas",
            json=_nova(valorCobrado=100000, totalParcelas=10, primeiroVencimento=str(primeiro)),
            headers=auth,
        )
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        # Uma parcela de R$ 100,00 sobre renda de R$ 5.000,00 = 2%.
        assert resumo["comprometimentoRenda"] == 200
