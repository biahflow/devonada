import pytest

"""
Endpoints do módulo de caixa. A aritmética já é coberta por test_caixa.py; aqui
o que se prova é persistência, isolamento por tenant, o snapshot append-only e a
tradução para o contrato.
"""


def _fonte(client, auth, **kwargs):
    corpo = {"nome": "Contrato PJ", "tipo": "pj_hora", "valorTipicoInformado": 1000000}
    corpo.update(kwargs)
    return client.post("/v1/caixa/fontes", json=corpo, headers=auth)


def _gasto(client, auth, **kwargs):
    corpo = {
        "descricao": "Aluguel",
        "categoria": "moradia",
        "essencial": True,
        "fixo": True,
        "valorMensal": 250000,
    }
    corpo.update(kwargs)
    return client.post("/v1/caixa/gastos", json=corpo, headers=auth)


def _provisao(client, auth, **kwargs):
    corpo = {"descricao": "IPVA do carro", "valorAnual": 180000, "mesVencimento": 1}
    corpo.update(kwargs)
    return client.post("/v1/caixa/provisoes", json=corpo, headers=auth)


class TestCaixaVazio:
    def test_sem_nada_cadastrado_a_cascata_vem_zerada_e_marcada_como_vazia(self, client, auth):
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["preenchimento"] == "vazio"
        assert caixa["rendaBrutaTipica"] == 0
        assert caixa["capacidadeHoje"] == 0

    def test_exige_token(self, client):
        assert client.get("/v1/caixa").status_code == 401


class TestNivel0:
    def test_renda_mais_essenciais_ja_produzem_capacidade(self, client, auth):
        # O atalho de 20 segundos: dois campos e o número aparece.
        _fonte(client, auth)
        _gasto(client, auth, valorMensal=400000)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["rendaBrutaTipica"] == 1000000
        assert caixa["essenciais"] == 400000
        assert caixa["capacidadeHoje"] == 600000
        assert caixa["origemRenda"] == "informada"

    def test_o_piso_legal_viaja_com_a_data_de_vigencia(self, client, auth):
        _fonte(client, auth)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["minimoExistencial"] == 60000
        assert caixa["minimoExistencialVigenteEm"] == "2023-06-19"


class TestFontesDeRenda:
    def test_cria_lista_edita_e_exclui(self, client, auth):
        criada = _fonte(client, auth).json()["fonte"]
        assert criada["nome"] == "Contrato PJ"

        assert len(client.get("/v1/caixa/fontes", headers=auth).json()["fontes"]) == 1

        r = client.patch(
            f"/v1/caixa/fontes/{criada['id']}",
            json={"valorTipicoInformado": 1200000},
            headers=auth,
        )
        assert r.json()["fonte"]["valorTipicoInformado"] == 1200000

        assert client.delete(f"/v1/caixa/fontes/{criada['id']}", headers=auth).status_code == 204
        assert client.get("/v1/caixa/fontes", headers=auth).json()["fontes"] == []

    def test_fonte_inativa_sai_da_conta_mas_continua_na_lista(self, client, auth):
        # `ativo` é a chave de liga/desliga: preserva o histórico sem poluir o
        # número. É o que dispensa redigitar gasto e renda todo mês.
        criada = _fonte(client, auth).json()["fonte"]
        client.patch(f"/v1/caixa/fontes/{criada['id']}", json={"ativo": False}, headers=auth)

        assert client.get("/v1/caixa", headers=auth).json()["caixa"]["rendaBrutaTipica"] == 0
        assert len(client.get("/v1/caixa/fontes", headers=auth).json()["fontes"]) == 1

    def test_id_inexistente_devolve_404_e_nao_403(self, client, auth):
        r = client.patch("/v1/caixa/fontes/nao-existe", json={"ativo": False}, headers=auth)
        assert r.status_code == 404
        # 403 confirmaria que o id existe em outro tenant.
        assert "message" in r.json()


class TestRecebimentos:
    def test_com_historico_a_renda_passa_a_vir_do_pior_mes(self, client, auth):
        fonte = _fonte(client, auth, valorTipicoInformado=1200000).json()["fonte"]
        for mes, valor in (("2026-05", 1150000), ("2026-06", 980000), ("2026-07", 1310000)):
            client.post(
                f"/v1/caixa/fontes/{fonte['id']}/recebimentos",
                json={"mes": mes, "valor": valor},
                headers=auth,
            )

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["rendaBrutaTipica"] == 980000
        assert caixa["origemRenda"] == "pior_mes_registrado"

    def test_reenviar_o_mesmo_mes_sobrescreve_em_vez_de_duplicar(self, client, auth):
        # Corrigir valor digitado errado é o caso comum. Duas linhas do mesmo
        # mês fariam o pior mês ser calculado sobre um dado fantasma.
        fonte = _fonte(client, auth).json()["fonte"]
        rota = f"/v1/caixa/fontes/{fonte['id']}/recebimentos"
        client.post(rota, json={"mes": "2026-07", "valor": 100000}, headers=auth)
        client.post(rota, json={"mes": "2026-07", "valor": 900000}, headers=auth)
        client.post(rota, json={"mes": "2026-06", "valor": 950000}, headers=auth)
        client.post(rota, json={"mes": "2026-05", "valor": 960000}, headers=auth)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        # Se o 100.000 tivesse sobrevivido, o pior mês seria ele.
        assert caixa["rendaBrutaTipica"] == 900000

    def test_mes_em_formato_invalido_e_rejeitado(self, client, auth):
        fonte = _fonte(client, auth).json()["fonte"]
        r = client.post(
            f"/v1/caixa/fontes/{fonte['id']}/recebimentos",
            json={"mes": "julho", "valor": 100000},
            headers=auth,
        )
        assert r.status_code == 422

    def test_recebimento_em_fonte_inexistente_devolve_404(self, client, auth):
        r = client.post(
            "/v1/caixa/fontes/nao-existe/recebimentos",
            json={"mes": "2026-07", "valor": 100000},
            headers=auth,
        )
        assert r.status_code == 404


class TestGastos:
    def test_essencial_e_nao_essencial_separam_as_duas_capacidades(self, client, auth):
        _fonte(client, auth)
        _gasto(client, auth, valorMensal=400000, essencial=True)
        _gasto(client, auth, descricao="Streaming", categoria="outros", valorMensal=9000, essencial=False)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["essenciais"] == 400000
        assert caixa["naoEssenciais"] == 9000
        assert caixa["capacidadeHoje"] == 591000
        assert caixa["capacidadeMaxima"] == 600000

    def test_categoria_desconhecida_e_rejeitada(self, client, auth):
        assert _gasto(client, auth, categoria="futebol").status_code == 422

    def test_edicao_e_exclusao(self, client, auth):
        g = _gasto(client, auth).json()["gasto"]
        r = client.patch(
            f"/v1/caixa/gastos/{g['id']}", json={"valorMensal": 300000}, headers=auth
        )
        assert r.json()["gasto"]["valorMensal"] == 300000
        assert client.delete(f"/v1/caixa/gastos/{g['id']}", headers=auth).status_code == 204
        assert client.get("/v1/caixa/gastos", headers=auth).json()["gastos"] == []


class TestProvisoes:
    def test_aporte_e_meses_restantes_sao_derivados_no_servidor(self, client, auth, monkeypatch):
        import routers.caixa as router_caixa

        class Agosto(router_caixa.date):
            @classmethod
            def today(cls):
                return router_caixa.date(2026, 8, 7)

        monkeypatch.setattr(router_caixa, "date", Agosto)

        p = _provisao(client, auth).json()["provisao"]
        # Agosto para janeiro: 5 meses, não 12. R$ 1.800 / 5 = R$ 360.
        assert p["mesesRestantes"] == 5
        assert p["aporteMensal"] == 36000

    def test_provisao_derruba_a_capacidade(self, client, auth):
        _fonte(client, auth)
        _provisao(client, auth)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["provisaoMensal"] > 0
        assert caixa["capacidadeHoje"] == 1000000 - caixa["provisaoMensal"]

    def test_mes_de_vencimento_fora_do_intervalo_e_rejeitado(self, client, auth):
        assert _provisao(client, auth, mesVencimento=13).status_code == 422
        assert _provisao(client, auth, mesVencimento=0).status_code == 422


class TestMetas:
    def test_sem_perfil_as_metas_vem_ausentes_e_nao_zeradas(self, client, auth):
        metas = client.get("/v1/caixa/metas", headers=auth).json()["metas"]
        assert metas["impostoBps"] is None
        assert metas["rendimentoEsperadoBps"] is None

    def test_imposto_informado_sai_do_bruto(self, client, auth):
        _fonte(client, auth)
        client.put("/v1/caixa/metas", json={"impostoBps": 600}, headers=auth)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["impostoReservado"] == 60000
        assert caixa["rendaLiquida"] == 940000

    def test_sem_imposto_informado_nada_e_reservado(self, client, auth):
        # ADR 0009: alíquota varia por enquadramento e não se estima.
        _fonte(client, auth)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["impostoReservado"] == 0

    def test_potes_saem_da_capacidade(self, client, auth):
        _fonte(client, auth)
        client.put(
            "/v1/caixa/metas",
            json={"reservaAporte": 50000, "aposentadoriaAporte": 30000},
            headers=auth,
        )
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["aporteReserva"] == 50000
        assert caixa["aporteAposentadoria"] == 30000
        assert caixa["capacidadeHoje"] == 920000

    def test_null_grava_ausencia_para_o_usuario_desfazer_uma_meta(self, client, auth):
        client.put("/v1/caixa/metas", json={"impostoBps": 600}, headers=auth)
        r = client.put("/v1/caixa/metas", json={"impostoBps": None}, headers=auth)
        assert r.json()["metas"]["impostoBps"] is None

    def test_percentual_acima_de_cem_por_cento_e_rejeitado(self, client, auth):
        r = client.put("/v1/caixa/metas", json={"impostoBps": 20000}, headers=auth)
        assert r.status_code == 422


class TestSnapshot:
    def test_toda_mutacao_grava_uma_linha_nova(self, client, auth):
        _fonte(client, auth)
        _gasto(client, auth)
        snapshots = client.get("/v1/caixa/historico", headers=auth).json()["snapshots"]
        assert len(snapshots) == 2

    def test_o_historico_e_append_only_e_preserva_o_valor_antigo(self, client, auth):
        # A pergunta que isto responde: "com base em qual renda eu propus aquele
        # acordo em março?". Um UPDATE apagaria justamente a resposta.
        fonte = _fonte(client, auth, valorTipicoInformado=1000000).json()["fonte"]
        client.patch(
            f"/v1/caixa/fontes/{fonte['id']}",
            json={"valorTipicoInformado": 2000000},
            headers=auth,
        )
        snapshots = client.get("/v1/caixa/historico", headers=auth).json()["snapshots"]
        assert len(snapshots) == 2
        rendas = {s["rendaBrutaTipica"] for s in snapshots}
        assert rendas == {1000000, 2000000}

    def test_leitura_da_cascata_nao_grava_snapshot(self, client, auth):
        _fonte(client, auth)
        for _ in range(3):
            client.get("/v1/caixa", headers=auth)
        assert len(client.get("/v1/caixa/historico", headers=auth).json()["snapshots"]) == 1


class TestSinaisNoContrato:
    def test_nao_fecha_quando_as_parcelas_passam_da_capacidade_maxima(self, client, auth):
        _fonte(client, auth, valorTipicoInformado=300000)
        _gasto(client, auth, valorMensal=200000)
        client.post(
            "/v1/dividas",
            json={
                "credor": "Banco Teste",
                # R$ 18.000 em 12x = R$ 1.500/mês contra R$ 1.000 de capacidade
                # máxima. Com R$ 12.000 a parcela empataria com a capacidade, e
                # empate ainda fecha.
                "valorCobrado": 1800000,
                "dataOrigem": "2025-01-10",
                "tipo": "consumo",
                "totalParcelas": 12,
                "primeiroVencimento": "2026-09-10",
            },
            headers=auth,
        )
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["comprometidoDividas"] > 0
        assert caixa["naoFecha"] is True

    def test_o_campo_nunca_se_chama_superendividado(self, client, auth):
        # A definição legal (CDC art. 54-A, § 1º) exige boa-fé e dívida de
        # consumo, e nenhum dos dois é apurável por software. O contrato não
        # pode sugerir um diagnóstico que o produto não tem como fazer.
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert "superendividado" not in str(caixa).lower()
        assert "naoFecha" in caixa

    def test_sem_piso_configurado_o_sinal_vem_ausente(self, client, auth):
        from config import Settings, get_settings
        from main import app

        app.dependency_overrides[get_settings] = lambda: Settings(minimo_existencial_centavos=0)
        try:
            _fonte(client, auth)
            caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
            assert caixa["minimoExistencial"] is None
            assert caixa["abaixoDoPiso"] is None
        finally:
            del app.dependency_overrides[get_settings]


class TestIsolamentoPorTenant:
    @pytest.fixture
    def outro_auth(self):
        return {"Authorization": "Bearer token-de-teste"}

    def test_gasto_de_outro_tenant_nao_aparece(self, client, auth, sessao):
        import orm

        sessao.add(
            orm.Gasto(
                tenant_id="outro-tenant",
                descricao="Aluguel alheio",
                categoria="moradia",
                essencial=True,
                fixo=True,
                valor_mensal=999999,
            )
        )
        sessao.commit()

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["essenciais"] == 0
        assert client.get("/v1/caixa/gastos", headers=auth).json()["gastos"] == []
