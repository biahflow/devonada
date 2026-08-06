from datetime import date, timedelta

HOJE = date.today()
ROTA = "/v1/dividas/simulacoes"


def _nova(**over):
    base = {
        "credor": "Banco Teste S/A",
        "valorCobrado": 150000,
        "dataOrigem": "2021-06-01",
        "tipo": "juros_abusivos",
    }
    base.update(over)
    return base


def _criar(client, auth, **over):
    return client.post("/v1/dividas", json=_nova(**over), headers=auth).json()["divida"]


def _com_carne(client, auth, parcelas=10, **over):
    return _criar(
        client,
        auth,
        totalParcelas=parcelas,
        primeiroVencimento=str(HOJE + timedelta(days=10)),
        **over,
    )


def _simular(client, auth, aporte=0, estrategias=None, ids=None):
    return client.post(
        ROTA,
        json={
            "aporteExtraMensal": aporte,
            "estrategias": estrategias or ["avalanche", "bola_de_neve"],
            "dividasIds": ids,
        },
        headers=auth,
    )


class TestAuth:
    def test_sem_token_devolve_401(self, client):
        r = client.post(ROTA, json={"aporteExtraMensal": 0, "estrategias": ["avalanche"]})
        assert r.status_code == 401

    def test_divida_de_outro_tenant_devolve_404(self, client, auth):
        # 404 e não 403: um 403 confirmaria que o id existe.
        r = _simular(client, auth, ids=["id-que-nao-e-meu"])
        assert r.status_code == 404
        assert "message" in r.json()


class TestSimulacao:
    def test_devolve_as_duas_estrategias_e_a_comparacao(self, client, auth):
        _com_carne(client, auth, taxaJurosMensal=250)
        _com_carne(client, auth, credor="Loja X", valorCobrado=40000, taxaJurosMensal=900)

        r = _simular(client, auth, aporte=20000)
        assert r.status_code == 200
        corpo = r.json()
        assert [s["estrategia"] for s in corpo["simulacoes"]] == ["avalanche", "bola_de_neve"]
        assert corpo["comparacao"]["melhorEstrategia"] in ("avalanche", "bola_de_neve")
        assert corpo["comparacao"]["diferencaJuros"] >= 0

    def test_uma_estrategia_so_nao_tem_comparacao(self, client, auth):
        _com_carne(client, auth, taxaJurosMensal=250)
        corpo = _simular(client, auth, estrategias=["avalanche"]).json()
        assert len(corpo["simulacoes"]) == 1
        assert corpo["comparacao"] is None

    def test_data_liberdade_e_ordem_de_pagamento_vem_prontas(self, client, auth):
        _com_carne(client, auth, parcelas=4, taxaJurosMensal=100)
        corpo = _simular(client, auth, estrategias=["avalanche"]).json()
        simulacao = corpo["simulacoes"][0]

        assert simulacao["mesesAteQuitacao"] > 0
        assert len(simulacao["dataLiberdade"]) == 7  # YYYY-MM
        assert simulacao["ordemPagamento"][0]["posicao"] == 1
        assert simulacao["ordemPagamento"][0]["credor"] == "Banco Teste S/A"
        assert len(simulacao["evolucaoSaldo"]) == simulacao["mesesAteQuitacao"]

    def test_saldo_vem_das_parcelas_pendentes_nao_do_valor_cobrado(self, client, auth):
        d = _com_carne(client, auth, parcelas=10, taxaJurosMensal=None)
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        client.post(
            f"/v1/parcelas/{parcelas[0]['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": parcelas[0]["valor"]},
            headers=auth,
        )

        corpo = _simular(client, auth, estrategias=["avalanche"]).json()
        # Sem juros, o total pago é exatamente o que resta em aberto — a parcela
        # já quitada não pode voltar a ser cobrada na simulação.
        assert corpo["simulacoes"][0]["totalPago"] == 150000 - parcelas[0]["valor"]

    def test_divida_quitada_fica_fora(self, client, auth):
        d = _criar(client, auth)
        client.post(
            f"/v1/dividas/{d['id']}/quitacao",
            json={"dataQuitacao": str(HOJE), "valorPago": 150000},
            headers=auth,
        )
        corpo = _simular(client, auth).json()
        assert corpo["simulacoes"] == []

    def test_sem_divida_ativa_devolve_lista_vazia(self, client, auth):
        corpo = _simular(client, auth).json()
        assert corpo["simulacoes"] == []
        assert corpo["comparacao"] is None
        assert corpo["dividasSemTaxa"] == []

    def test_filtra_pelas_dividas_escolhidas(self, client, auth):
        a = _com_carne(client, auth, taxaJurosMensal=250)
        _com_carne(client, auth, credor="Loja X", taxaJurosMensal=900)

        corpo = _simular(client, auth, estrategias=["avalanche"], ids=[a["id"]]).json()
        ordem = corpo["simulacoes"][0]["ordemPagamento"]
        assert [q["dividaId"] for q in ordem] == [a["id"]]

    def test_nao_escreve_nada_no_banco(self, client, auth):
        _com_carne(client, auth, taxaJurosMensal=250)
        antes = client.get("/v1/dividas", headers=auth).json()["dividas"]
        _simular(client, auth, aporte=10000)
        assert client.get("/v1/dividas", headers=auth).json()["dividas"] == antes


class TestDividaSemTaxa:
    def test_e_nomeada_na_resposta(self, client, auth):
        sem = _com_carne(client, auth, credor="Sem taxa")
        _com_carne(client, auth, credor="Com taxa", taxaJurosMensal=500)

        corpo = _simular(client, auth, estrategias=["avalanche"]).json()
        assert corpo["dividasSemTaxa"] == [{"dividaId": sem["id"], "credor": "Sem taxa"}]

    def test_nao_recebe_juros_projetados(self, client, auth):
        _com_carne(client, auth, parcelas=5)
        corpo = _simular(client, auth, estrategias=["avalanche"]).json()
        assert corpo["simulacoes"][0]["totalJurosPagos"] == 0

    def test_vai_para_o_fim_da_fila_da_avalanche(self, client, auth):
        sem = _com_carne(client, auth, credor="Sem taxa", valorCobrado=20000, parcelas=2)
        com = _com_carne(client, auth, credor="Com taxa", valorCobrado=20000, parcelas=2,
                         taxaJurosMensal=300)

        ordem = _simular(client, auth, estrategias=["avalanche"]).json()["simulacoes"][0][
            "ordemPagamento"
        ]
        assert [q["dividaId"] for q in ordem] == [com["id"], sem["id"]]


class TestEconomia:
    def test_economia_vs_minimo_aparece_com_aporte(self, client, auth):
        _com_carne(client, auth, parcelas=12, taxaJurosMensal=400)
        corpo = _simular(client, auth, aporte=5000, estrategias=["avalanche"]).json()
        assert corpo["simulacoes"][0]["economiaVsMinimo"] > 0

    def test_sem_aporte_a_economia_e_zero_e_nao_nula(self, client, auth):
        _com_carne(client, auth, parcelas=12, taxaJurosMensal=400)
        corpo = _simular(client, auth, aporte=0, estrategias=["avalanche"]).json()
        assert corpo["simulacoes"][0]["economiaVsMinimo"] == 0


class TestRecusas:
    def test_aporte_que_invade_o_minimo_existencial_devolve_422(self, client, auth):
        client.put("/v1/perfil", json={"rendaMensal": 200000}, headers=auth)
        _com_carne(client, auth, parcelas=12, taxaJurosMensal=200)

        r = _simular(client, auth, aporte=500000)
        assert r.status_code == 422
        corpo = r.json()
        assert corpo["campo"] == "aporteExtraMensal"
        # A mensagem é exibida direto ao usuário: pt-BR, sem valor e sem credor.
        assert "mínimo para viver" in corpo["message"]
        assert "R$" not in corpo["message"]

    def test_sem_renda_informada_a_simulacao_segue(self, client, auth):
        # Limitação declarada: sem renda não há o que comparar, e travar a
        # ferramenta tiraria justamente de quem mais precisa dela.
        _com_carne(client, auth, parcelas=12, taxaJurosMensal=200)
        assert _simular(client, auth, aporte=500000).status_code == 200

    def test_plano_que_nao_quita_devolve_422(self, client, auth):
        # Dívida sem cronograma (parcela mínima zero) e com juros altos: sem
        # aporte, nada é pago e o saldo só cresce.
        _criar(client, auth, taxaJurosMensal=1000)
        r = _simular(client, auth, aporte=0, estrategias=["avalanche"])
        assert r.status_code == 422
        assert r.json()["campo"] == "aporteExtraMensal"
        assert "não chega a quitar" in r.json()["message"]

    def test_aporte_negativo_e_rejeitado(self, client, auth):
        assert _simular(client, auth, aporte=-100).status_code == 422

    def test_estrategia_desconhecida_e_rejeitada(self, client, auth):
        r = _simular(client, auth, estrategias=["aleatoria"])
        assert r.status_code == 422
