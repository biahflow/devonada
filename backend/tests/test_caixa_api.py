import pytest

import orm
from config import get_settings

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


class TestPropostaDeFechamento:
    """
    O `GET /v1/caixa/fechamento` PROPÕE e não grava. É o que separa
    pré-preencher de replicar em silêncio (guardrail 8.1).
    """

    def test_entram_so_o_recebimento_variavel_e_o_gasto_variavel(self, client, auth):
        # Fixo não entra: registro permanente já vale sem redigitar, e é a forma
        # do modelo que resolve a recorrência.
        _fonte(client, auth, nome="Contrato PJ", variavel=True)
        _fonte(client, auth, nome="Aposentadoria", tipo="beneficio", variavel=False)
        _gasto(client, auth, descricao="Aluguel", fixo=True)
        _gasto(client, auth, descricao="Mercado", fixo=False, essencial=True)

        itens = client.get("/v1/caixa/fechamento", headers=auth).json()["proposta"]["itens"]
        descricoes = {i["descricao"] for i in itens}
        assert descricoes == {"Contrato PJ", "Mercado"}

    def test_sem_mes_anterior_o_campo_vem_VAZIO_e_nao_zero(self, client, auth):
        # Zero afirmaria que a pessoa não recebeu nada, que é diferente de não
        # sabermos quanto ela recebeu.
        _fonte(client, auth, variavel=True)

        item = client.get("/v1/caixa/fechamento?mes=2026-08", headers=auth).json()[
            "proposta"
        ]["itens"][0]
        assert item["valorSugerido"] is None
        assert item["origem"] == "sem_referencia"

    def test_com_mes_anterior_sugere_e_diz_de_onde_veio(self, client, auth):
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]
        client.post(
            f"/v1/caixa/fontes/{fonte['id']}/recebimentos",
            json={"mes": "2026-07", "valor": 880000},
            headers=auth,
        )

        item = client.get("/v1/caixa/fechamento?mes=2026-08", headers=auth).json()[
            "proposta"
        ]["itens"][0]
        assert item["valorSugerido"] == 880000
        assert item["origem"] == "mes_anterior"
        assert item["mesDeReferencia"] == "2026-07"

    def test_refazendo_o_fechamento_mostra_o_que_ja_foi_gravado(self, client, auth):
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]
        client.post(
            f"/v1/caixa/fontes/{fonte['id']}/recebimentos",
            json={"mes": "2026-07", "valor": 880000},
            headers=auth,
        )
        client.post(
            f"/v1/caixa/fontes/{fonte['id']}/recebimentos",
            json={"mes": "2026-08", "valor": 910000},
            headers=auth,
        )

        item = client.get("/v1/caixa/fechamento?mes=2026-08", headers=auth).json()[
            "proposta"
        ]["itens"][0]
        assert item["valorSugerido"] == 910000
        assert item["origem"] == "valor_atual"

    def test_propor_nao_grava_nada(self, client, auth):
        _fonte(client, auth, variavel=True)
        antes = len(client.get("/v1/caixa/historico", headers=auth).json()["snapshots"])

        client.get("/v1/caixa/fechamento", headers=auth)

        depois = len(client.get("/v1/caixa/historico", headers=auth).json()["snapshots"])
        assert depois == antes


class TestConfirmacaoDeFechamento:
    def test_grava_o_confirmado_e_devolve_a_cascata_nova(self, client, auth):
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]
        gasto = _gasto(client, auth, descricao="Mercado", fixo=False).json()["gasto"]

        resposta = client.post(
            "/v1/caixa/fechamento",
            json={
                "mes": "2026-08",
                "itens": [
                    {"tipo": "recebimento", "id": fonte["id"], "valor": 900000},
                    {"tipo": "gasto", "id": gasto["id"], "valor": 120000},
                ],
            },
            headers=auth,
        )
        assert resposta.status_code == 200

        caixa = resposta.json()["caixa"]
        assert caixa["ultimoFechamentoMes"] == "2026-08"
        assert client.get("/v1/caixa/gastos", headers=auth).json()["gastos"][0][
            "valorMensal"
        ] == 120000

    def test_item_OMITIDO_nao_e_gravado_e_nao_vira_zero(self, client, auth):
        # A garantia central da tela: quem não confirmou uma linha não afirmou
        # que ela é zero. Sem este teste, a regra é só uma intenção no comentário.
        _fonte(client, auth, variavel=True)
        gasto = _gasto(client, auth, descricao="Mercado", fixo=False, valorMensal=150000).json()[
            "gasto"
        ]

        client.post(
            "/v1/caixa/fechamento", json={"mes": "2026-08", "itens": []}, headers=auth
        )

        assert client.get("/v1/caixa/gastos", headers=auth).json()["gastos"][0][
            "valorMensal"
        ] == 150000
        assert gasto["valorMensal"] == 150000

    def test_um_snapshot_por_fechamento_e_nao_um_por_item(self, client, auth):
        # Oito itens gravando oito fotos idênticas sujariam o histórico que
        # existe para responder "com base em qual renda eu propus aquele acordo?".
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]
        g1 = _gasto(client, auth, descricao="Mercado", fixo=False).json()["gasto"]
        g2 = _gasto(client, auth, descricao="Lazer", fixo=False, essencial=False).json()["gasto"]

        antes = len(client.get("/v1/caixa/historico", headers=auth).json()["snapshots"])
        client.post(
            "/v1/caixa/fechamento",
            json={
                "mes": "2026-08",
                "itens": [
                    {"tipo": "recebimento", "id": fonte["id"], "valor": 900000},
                    {"tipo": "gasto", "id": g1["id"], "valor": 120000},
                    {"tipo": "gasto", "id": g2["id"], "valor": 30000},
                ],
            },
            headers=auth,
        )
        depois = len(client.get("/v1/caixa/historico", headers=auth).json()["snapshots"])
        assert depois - antes == 1

    def test_refechar_o_mesmo_mes_nao_duplica(self, client, auth):
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]
        corpo = {
            "mes": "2026-08",
            "itens": [{"tipo": "recebimento", "id": fonte["id"], "valor": 900000}],
        }
        client.post("/v1/caixa/fechamento", json=corpo, headers=auth)
        corpo["itens"][0]["valor"] = 950000
        resposta = client.post("/v1/caixa/fechamento", json=corpo, headers=auth)

        assert resposta.status_code == 200
        assert resposta.json()["caixa"]["ultimoFechamentoMes"] == "2026-08"

    def test_mes_fora_do_formato_e_recusado(self, client, auth):
        assert (
            client.post(
                "/v1/caixa/fechamento", json={"mes": "agosto", "itens": []}, headers=auth
            ).status_code
            == 422
        )

    def test_fonte_de_outro_tenant_devolve_404(self, client, auth):
        assert (
            client.post(
                "/v1/caixa/fechamento",
                json={
                    "mes": "2026-08",
                    "itens": [{"tipo": "recebimento", "id": "nao-existe", "valor": 1}],
                },
                headers=auth,
            ).status_code
            == 404
        )


class TestDefasagem:
    def test_quem_nunca_fechou_nao_esta_atrasado(self, client, auth):
        # None, não False: "ainda não fechou" e "está em dia" são afirmações
        # diferentes, e a tela precisa poder distinguir as duas.
        _fonte(client, auth)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["ultimoFechamentoMes"] is None
        assert caixa["mesesDesdeFechamento"] is None
        assert caixa["caixaDefasado"] is None

    def test_fechado_no_mes_corrente_fica_em_dia(self, client, auth):
        from datetime import date

        hoje = date.today()
        _fonte(client, auth)
        client.post(
            "/v1/caixa/fechamento",
            json={"mes": f"{hoje.year}-{hoje.month:02d}", "itens": []},
            headers=auth,
        )

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["mesesDesdeFechamento"] == 0
        assert caixa["caixaDefasado"] is False

    def test_fechamento_antigo_marca_defasagem(self, client, auth):
        _fonte(client, auth)
        client.post(
            "/v1/caixa/fechamento", json={"mes": "2020-01", "itens": []}, headers=auth
        )

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["caixaDefasado"] is True
        assert caixa["mesesDesdeFechamento"] >= 24


def _respiro_declarado(sessao, valor=15000, ativo=True, saldo=0):
    """
    Semeia a linha de respiro direto na tabela.

    `PUT /v1/caixa/respiro` é de T2 e ainda não existe. Semear é o único jeito
    honesto de exercitar a coluna do snapshot hoje — um teste que fingisse
    passar pela rota passaria pelo motivo errado, como o `renda_legada` já
    ensinou.
    """
    sessao.add(
        orm.Respiro(
            tenant_id=get_settings().tenant_id,
            valor_mensal=valor,
            ativo=ativo,
            saldo_acumulado=saldo,
        )
    )
    sessao.commit()


def _compromisso_declarado(sessao, bps=1000):
    """
    Semeia o percentual direto no `perfil`, pelo mesmo motivo de
    `_respiro_declarado`: a rota que o declara é de T3 e ainda não existe.

    `get-or-create` porque o `perfil` é uma linha por tenant e outros helpers
    podem já tê-la criado — duas linhas dariam duas respostas para a mesma
    pergunta.
    """
    tenant = get_settings().tenant_id
    perfil = sessao.query(orm.Perfil).filter(orm.Perfil.tenant_id == tenant).first()
    if perfil is None:
        perfil = orm.Perfil(tenant_id=tenant)
        sessao.add(perfil)
    perfil.compromisso_percentual_bps = bps
    sessao.commit()
    return perfil


class TestCompromissoPercentualNoSnapshot:
    """
    A gêmea de `TestRespiroNoSnapshot`, e pela mesma razão.

    A partir da F-011 o compromisso percentual também entra na cascata antes da
    `capacidade_maxima`. Sem esta coluna a foto voltaria a mostrar uma
    capacidade derrubada sem a linha que a derrubou — que é exatamente o buraco
    que a coluna do respiro fechou no M11.
    """

    def test_o_fechamento_do_mes_grava_o_compromisso_vigente(self, client, auth, sessao):
        _compromisso_declarado(sessao, bps=1000)
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]

        assert _fechar_o_mes(client, auth, fonte["id"]).status_code == 200

        gravados = sessao.query(orm.CaixaSnapshot).all()
        assert gravados
        # 10% da renda LÍQUIDA típica, e é a cascata quem faz essa conta — aqui
        # se prova só que o número dela chegou à foto, e não zerado.
        assert all(s.compromisso_percentual is not None for s in gravados)
        assert all(s.compromisso_percentual > 0 for s in gravados)

    def test_sem_percentual_declarado_a_coluna_fica_NULL_e_nao_zero(self, client, auth, sessao):
        # `0` afirmaria percentual declarado como zero, que é escolha legítima e
        # diferente de não ter escolhido. `NULL` é a verdade.
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]

        assert _fechar_o_mes(client, auth, fonte["id"]).status_code == 200

        gravados = sessao.query(orm.CaixaSnapshot).all()
        assert gravados
        assert {s.compromisso_percentual for s in gravados} == {None}

    def test_percentual_declarado_como_zero_grava_zero_e_nao_NULL(self, client, auth, sessao):
        # O outro lado da distinção: quem declarou 0% escolheu, e a foto tem de
        # registrar a escolha em vez de fingir que ela não aconteceu.
        _compromisso_declarado(sessao, bps=0)
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]

        assert _fechar_o_mes(client, auth, fonte["id"]).status_code == 200

        gravados = sessao.query(orm.CaixaSnapshot).all()
        assert gravados
        assert {s.compromisso_percentual for s in gravados} == {0}


def _fechar_o_mes(client, auth, fonte_id, valor=900000, mes="2026-08"):
    return client.post(
        "/v1/caixa/fechamento",
        json={"mes": mes, "itens": [{"tipo": "recebimento", "id": fonte_id, "valor": valor}]},
        headers=auth,
    )


class TestRespiroNoSnapshot:
    """
    A foto precisa explicar a própria `capacidade_maxima` seis meses depois.

    Sem a coluna, o histórico mostraria uma capacidade menor sem a linha que a
    derrubou — e a pergunta que a tabela existe para responder ("com base em
    qual renda eu propus aquele acordo?") ficaria sem metade da resposta.
    """

    def test_o_fechamento_do_mes_grava_o_respiro_vigente(self, client, auth, sessao):
        _respiro_declarado(sessao, valor=15000)
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]

        assert _fechar_o_mes(client, auth, fonte["id"]).status_code == 200

        gravados = sessao.query(orm.CaixaSnapshot).all()
        assert gravados
        assert {s.respiro for s in gravados} == {15000}

    def test_sem_respiro_declarado_a_coluna_fica_NULL_e_nao_zero(self, client, auth, sessao):
        # `0` afirmaria respiro declarado como zero, que é escolha legítima e
        # diferente de não ter escolhido. `NULL` é a verdade.
        fonte = _fonte(client, auth, variavel=True).json()["fonte"]

        assert _fechar_o_mes(client, auth, fonte["id"]).status_code == 200

        gravados = sessao.query(orm.CaixaSnapshot).all()
        assert gravados
        assert {s.respiro for s in gravados} == {None}


class TestRespiroNaCascataDaAPI:
    """
    O respiro persistido chegando à cascata pelo caminho de verdade.

    A aritmética já é de `test_caixa.py`; o que se prova aqui é que
    `leitura.montar_entrada_caixa` lê a tabela e que a queda aparece no número
    que a tela mostra — inclusive para os três consumidores que ninguém tocou.
    """

    def test_a_capacidade_maxima_da_api_ja_vem_com_o_respiro_descontado(
        self, client, auth, sessao
    ):
        _respiro_declarado(sessao, valor=15000)
        _fonte(client, auth, valorTipicoInformado=1000000)
        _gasto(client, auth, valorMensal=400000)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["capacidadeMaxima"] == 585000
        assert caixa["capacidadeHoje"] == 585000

    def test_sem_linha_de_respiro_a_capacidade_e_a_de_sempre(self, client, auth):
        # A regressão que protege quem nunca declarou: mesma entrada, mesmo
        # número de antes do M11.
        _fonte(client, auth, valorTipicoInformado=1000000)
        _gasto(client, auth, valorMensal=400000)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["capacidadeMaxima"] == 600000

    def test_o_respiro_desativado_nao_derruba_a_capacidade(self, client, auth, sessao):
        _respiro_declarado(sessao, valor=15000, ativo=False)
        _fonte(client, auth, valorTipicoInformado=1000000)
        _gasto(client, auth, valorMensal=400000)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["capacidadeMaxima"] == 600000

    def test_o_usado_soma_so_os_usos_do_mes_corrente(self, client, auth, sessao):
        # O sorvete do mês passado não come a fatia deste mês. Sem rota de uso
        # (T2), a leitura é exercitada direto — é onde a janela mensal mora.
        from datetime import date, timedelta

        from leitura import montar_entrada_caixa

        tenant = get_settings().tenant_id
        _respiro_declarado(sessao, valor=15000)
        hoje = date.today()
        sessao.add_all(
            [
                orm.RespiroUso(tenant_id=tenant, valor=5000, data=hoje),
                orm.RespiroUso(tenant_id=tenant, valor=3000, data=hoje),
                orm.RespiroUso(
                    tenant_id=tenant, valor=9900, data=hoje.replace(day=1) - timedelta(days=1)
                ),
            ]
        )
        sessao.commit()

        entrada = montar_entrada_caixa(sessao, tenant, get_settings())
        assert entrada.respiro_usado_no_mes == 8000
        assert entrada.respiro == 15000
        assert entrada.respiro_saldo_acumulado == 0

    def test_sem_linha_de_respiro_os_quatro_campos_da_entrada_sao_ausentes(
        self, client, auth, sessao
    ):
        from leitura import montar_entrada_caixa

        entrada = montar_entrada_caixa(sessao, get_settings().tenant_id, get_settings())
        assert entrada.respiro is None
        assert entrada.respiro_ativo is None
        assert entrada.respiro_usado_no_mes is None
        assert entrada.respiro_saldo_acumulado is None


# --- Respiro pela API (M11, T2) ----------------------------------------------


def _declarar_respiro(client, auth, **kwargs):
    corpo = {"valorMensal": 15000, "ativo": True}
    corpo.update(kwargs)
    return client.put("/v1/caixa/respiro", json=corpo, headers=auth)


def _usar_respiro(client, auth, valor=8000, **kwargs):
    corpo = {"valor": valor}
    corpo.update(kwargs)
    return client.post("/v1/caixa/respiro/uso", json=corpo, headers=auth)


def _destinar_respiro(client, auth, valor):
    return client.post(
        "/v1/caixa/respiro/destinacao", json={"valor": valor}, headers=auth
    )


def _linha_de_respiro(sessao):
    """Relê a linha do banco. Sempre por consulta nova: o objeto antigo não
    enxerga o que a rota gravou pela outra sessão."""
    sessao.expire_all()
    return sessao.query(orm.Respiro).one()


def _mes_relativo(meses_atras: int) -> str:
    """`AAAA-MM` de N meses atrás, atravessando o ano."""
    from datetime import date

    hoje = date.today()
    total = (hoje.year * 12 + hoje.month - 1) - meses_atras
    return f"{total // 12}-{total % 12 + 1:02d}"


def _carimbar(sessao, ultimo_mes_apurado=None, saldo=None):
    linha = sessao.query(orm.Respiro).one()
    if ultimo_mes_apurado is not None:
        linha.ultimo_mes_apurado = ultimo_mes_apurado
    if saldo is not None:
        linha.saldo_acumulado = saldo
    sessao.commit()


class TestRespiroNoContratoDoCaixa:
    """
    Os cinco campos em `GET /v1/caixa`, com as ausências certas.

    A distinção que este bloco protege: `null` é "nunca declarou" e `0` é
    "declarou e não usou". Confundir os dois faria o app inventar uma escolha
    que a pessoa não fez (ADR 0019, item 2).
    """

    def test_quem_nunca_declarou_tem_os_cinco_campos_ausentes(self, client, auth):
        _fonte(client, auth)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiro"] is None
        assert caixa["respiroAtivo"] is None
        assert caixa["respiroUsadoNoMes"] is None
        assert caixa["respiroDisponivelNoMes"] is None
        assert caixa["respiroSaldoAcumulado"] is None

    def test_com_respiro_declarado_e_nada_usado_o_usado_e_zero(self, client, auth):
        # Aqui o zero é FATO, não ausência: a fatia existe e está inteira.
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiro"] == 15000
        assert caixa["respiroAtivo"] is True
        assert caixa["respiroUsadoNoMes"] == 0
        assert caixa["respiroDisponivelNoMes"] == 15000
        assert caixa["respiroSaldoAcumulado"] == 0

    def test_o_disponivel_desce_com_o_uso_e_nunca_fica_negativo(self, client, auth):
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _usar_respiro(client, auth, 8000)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroUsadoNoMes"] == 8000
        assert caixa["respiroDisponivelNoMes"] == 7000

        _usar_respiro(client, auth, 12000)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroDisponivelNoMes"] == 0


class TestDeclaracaoDeRespiro:
    def test_o_put_grava_e_devolve_a_linha(self, client, auth):
        _fonte(client, auth)
        corpo = _declarar_respiro(client, auth, valorMensal=15000).json()
        assert corpo["respiro"] == {
            "valorMensal": 15000,
            "ativo": True,
            "saldoAcumulado": 0,
        }

    def test_declarar_de_novo_atualiza_a_mesma_linha(self, client, auth, sessao):
        # UMA LINHA POR TENANT: duas dariam dois valores para a mesma pergunta.
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _declarar_respiro(client, auth, valorMensal=20000)

        assert sessao.query(orm.Respiro).count() == 1
        assert _linha_de_respiro(sessao).valor_mensal == 20000

    def test_sem_divida_simulavel_o_preco_e_nulo(self, client, auth):
        # A tela grava sem preço em vez de exibir palpite.
        _fonte(client, auth)
        assert _declarar_respiro(client, auth).json()["custoEmMeses"] is None

    def test_plano_que_nao_quita_nao_tem_preco(self, client, auth):
        # Dívida sem cronograma e com juros que passam do orçamento: nenhum dos
        # dois cenários quita, e sem os dois lados não há diferença a afirmar.
        _fonte(client, auth, valorTipicoInformado=200000)
        _gasto(client, auth, valorMensal=100000)
        client.post(
            "/v1/dividas",
            json={
                "credor": "Banco Teste",
                "valorCobrado": 6000000,
                "dataOrigem": "2025-01-10",
                "tipo": "consumo",
                "taxaJurosMensal": 1000,
            },
            headers=auth,
        )

        corpo = _declarar_respiro(client, auth, valorMensal=20000).json()
        assert corpo["custoEmMeses"] is None

    def test_o_snapshot_e_gravado_depois_da_declaracao(self, client, auth, sessao):
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)

        fotos = sessao.query(orm.CaixaSnapshot).all()
        assert fotos
        assert fotos[-1].respiro == 15000

    def test_desativar_preserva_o_valor_e_o_saldo_acumulado(self, client, auth, sessao):
        # Desativar NÃO É APAGAR (ADR 0019, item 5). A tela precisa poder
        # distinguir "desativou" de "nunca declarou".
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=22000)

        corpo = _declarar_respiro(client, auth, valorMensal=15000, ativo=False).json()
        assert corpo["respiro"]["ativo"] is False
        assert corpo["respiro"]["valorMensal"] == 15000
        assert corpo["respiro"]["saldoAcumulado"] == 22000

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroAtivo"] is False
        assert caixa["respiroSaldoAcumulado"] == 22000
        assert caixa["respiro"] == 15000

    def test_exige_token(self, client):
        assert client.put("/v1/caixa/respiro", json={"valorMensal": 1}).status_code == 401


class TestRecusaDeRespiro:
    """
    O piso é da lei; a alocação acima dele é do usuário (ADR 0019, item 6).
    """

    def test_respiro_que_invade_o_minimo_existencial_devolve_422(self, client, auth):
        # Renda R$ 2.000, essenciais R$ 1.000: sobram R$ 1.000, e um respiro de
        # R$ 500 deixaria R$ 500 — abaixo do piso legal de R$ 600.
        _fonte(client, auth, valorTipicoInformado=200000)
        _gasto(client, auth, valorMensal=100000)

        r = _declarar_respiro(client, auth, valorMensal=50000)
        assert r.status_code == 422
        corpo = r.json()
        assert corpo["campo"] == "valorMensal"
        # Guardrail 5: renda e custo de vida não vazam em corpo de erro.
        assert "R$" not in corpo["message"]
        assert "mínimo existencial" in corpo["message"]

    def test_respiro_que_cabe_acima_do_piso_passa(self, client, auth):
        _fonte(client, auth, valorTipicoInformado=200000)
        _gasto(client, auth, valorMensal=100000)
        assert _declarar_respiro(client, auth, valorMensal=20000).status_code == 200

    def test_valor_negativo_devolve_422(self, client, auth):
        _fonte(client, auth)
        r = _declarar_respiro(client, auth, valorMensal=-1)
        assert r.status_code == 422
        corpo = r.json()
        assert corpo["campo"] == "valorMensal"
        assert "R$" not in corpo["message"]

    def test_a_recusa_nao_grava_nada(self, client, auth, sessao):
        _fonte(client, auth, valorTipicoInformado=200000)
        _gasto(client, auth, valorMensal=100000)
        _declarar_respiro(client, auth, valorMensal=50000)
        assert sessao.query(orm.Respiro).count() == 0

    def test_sem_caixa_preenchido_a_declaracao_segue(self, client, auth):
        # Limitação declarada, no molde de `_validar_aporte`: sem renda e sem
        # essenciais não há o que comparar, e recusar diria a quem não informou
        # nada que o respiro dele é ilegal.
        assert _declarar_respiro(client, auth, valorMensal=15000).status_code == 200


class TestUsoDeRespiro:
    """
    Registrar uso não produz alerta, aviso, sinal nem comparação. O único
    acompanhamento é quanto ainda há (guardrail 4.1).
    """

    def test_registrar_uso_devolve_o_disponivel_e_nada_mais(self, client, auth):
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)

        r = _usar_respiro(client, auth, 8000, descricao="cinema")
        assert r.status_code == 201
        corpo = r.json()
        # NENHUM campo de alerta, aviso, sinal de excesso ou comparação. O `id`
        # existe porque o DELETE do desfazer é inalcançável sem ele.
        assert set(corpo) == {"id", "respiroDisponivelNoMes"}
        assert corpo["respiroDisponivelNoMes"] == 7000

    def test_a_descricao_e_opcional(self, client, auth, sessao):
        _fonte(client, auth)
        _declarar_respiro(client, auth)
        assert _usar_respiro(client, auth, 1000).status_code == 201
        assert sessao.query(orm.RespiroUso).one().descricao is None

    def test_uso_maior_que_o_disponivel_e_aceito_e_consome_o_acumulado(
        self, client, auth, sessao
    ):
        # O app não impede ninguém de gastar o próprio dinheiro.
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=22000)

        r = _usar_respiro(client, auth, 20000)
        assert r.status_code == 201
        assert r.json()["respiroDisponivelNoMes"] == 0

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroDisponivelNoMes"] == 0
        assert caixa["respiroSaldoAcumulado"] == 17000

    def test_uso_alem_dos_dois_ainda_e_aceito_e_nada_fica_negativo(
        self, client, auth, sessao
    ):
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=2000)

        assert _usar_respiro(client, auth, 50000).status_code == 201
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroDisponivelNoMes"] == 0
        assert caixa["respiroSaldoAcumulado"] == 0

    def test_sem_respiro_declarado_o_uso_devolve_404(self, client, auth):
        _fonte(client, auth)
        assert _usar_respiro(client, auth, 1000).status_code == 404

    def test_valor_zero_ou_negativo_nao_entra(self, client, auth):
        _fonte(client, auth)
        _declarar_respiro(client, auth)
        assert _usar_respiro(client, auth, 0).status_code == 422
        assert _usar_respiro(client, auth, -500).status_code == 422


class TestDesfazerUsoDeRespiro:
    """
    Existe porque valor digitado errado precisa de desfazer, e conviver com ele
    transformaria um erro de digitação em culpa.
    """

    def test_a_ida_e_a_volta_devolvem_o_disponivel(self, client, auth):
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        uso_id = _usar_respiro(client, auth, 8000).json()["id"]

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroDisponivelNoMes"] == 7000

        assert (
            client.delete(f"/v1/caixa/respiro/uso/{uso_id}", headers=auth).status_code
            == 204
        )

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroUsadoNoMes"] == 0
        assert caixa["respiroDisponivelNoMes"] == 15000

    def test_desfazer_devolve_tambem_o_que_o_excesso_consumiu_do_acumulado(
        self, client, auth, sessao
    ):
        # Sem esta volta, desfazer um valor digitado errado custaria saldo
        # acumulado de verdade — o erro de digitação viraria prejuízo.
        #
        # A COLUNA NÃO SE MEXE: o desconto do excesso é derivado na leitura, e é
        # isso que torna o desfazer exato. Este teste prova as duas pontas — o
        # que o usuário vê desce, e o que está gravado fica.
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=22000)

        uso_id = _usar_respiro(client, auth, 20000).json()["id"]
        exposto = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert exposto["respiroSaldoAcumulado"] == 17000
        assert _linha_de_respiro(sessao).saldo_acumulado == 22000

        client.delete(f"/v1/caixa/respiro/uso/{uso_id}", headers=auth)
        de_volta = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert de_volta["respiroSaldoAcumulado"] == 22000
        assert de_volta["respiroDisponivelNoMes"] == 15000

    def test_desfazer_um_uso_que_exauriu_o_acumulado_devolve_o_saldo_inteiro(
        self, client, auth, sessao
    ):
        """
        O caso REAL do desfazer: R$ 300 digitados no lugar de R$ 30.

        A fatia é R$ 150 e havia R$ 50 guardados. O uso de R$ 300 leva o
        disponível e o saldo visíveis a zero — e corrigir o erro tem de devolver
        os R$ 50 inteiros. Uma implementação que debitasse a coluna a cada uso
        não teria como: zerada, ela não sabe se era zero desde o começo do mês
        ou se foi exaurida. Derivado, não há o que estornar.
        """
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=5000)

        uso_id = _usar_respiro(client, auth, 30000).json()["id"]
        no_erro = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert no_erro["respiroDisponivelNoMes"] == 0
        assert no_erro["respiroSaldoAcumulado"] == 0

        assert (
            client.delete(f"/v1/caixa/respiro/uso/{uso_id}", headers=auth).status_code
            == 204
        )
        corrigido = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert corrigido["respiroSaldoAcumulado"] == 5000
        assert corrigido["respiroDisponivelNoMes"] == 15000
        assert corrigido["respiroUsadoNoMes"] == 0

    def test_uso_inexistente_devolve_404(self, client, auth):
        _fonte(client, auth)
        _declarar_respiro(client, auth)
        assert (
            client.delete("/v1/caixa/respiro/uso/nao-existe", headers=auth).status_code
            == 404
        )

    def test_uso_de_outro_tenant_devolve_404(self, client, auth, sessao):
        # 404, nunca 403: um 403 confirmaria que o id existe em outro tenant.
        _fonte(client, auth)
        _declarar_respiro(client, auth)
        alheio = orm.RespiroUso(tenant_id="outro-tenant", valor=5000)
        sessao.add(alheio)
        sessao.commit()

        assert (
            client.delete(f"/v1/caixa/respiro/uso/{alheio.id}", headers=auth).status_code
            == 404
        )
        assert sessao.query(orm.RespiroUso).count() == 1


class TestDestinacaoDeRespiro:
    def test_destinar_debita_o_saldo_e_grava_o_lancamento(self, client, auth, sessao):
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=22000)

        r = _destinar_respiro(client, auth, 22000)
        assert r.status_code == 201
        assert r.json() == {"respiroSaldoAcumulado": 0}

        lancamentos = sessao.query(orm.RespiroDestinacao).all()
        assert [x.valor for x in lancamentos] == [22000]
        assert _linha_de_respiro(sessao).saldo_acumulado == 0

    def test_destinar_mais_que_o_saldo_devolve_422(self, client, auth, sessao):
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=22000)

        r = _destinar_respiro(client, auth, 22001)
        assert r.status_code == 422
        corpo = r.json()
        assert corpo["campo"] == "valor"
        assert "R$" not in corpo["message"]
        assert sessao.query(orm.RespiroDestinacao).count() == 0
        assert _linha_de_respiro(sessao).saldo_acumulado == 22000

    def test_o_teto_da_destinacao_e_o_saldo_que_o_usuario_ve(
        self, client, auth, sessao
    ):
        # R$ 220 guardados, fatia R$ 150, uso de R$ 200 no mês: o usuário vê
        # R$ 170. Destinar sobre a coluna crua deixaria ele mandar para a dívida
        # um dinheiro que a tela dele não mostra mais.
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=22000)
        _usar_respiro(client, auth, 20000)

        assert _destinar_respiro(client, auth, 18000).status_code == 422

        r = _destinar_respiro(client, auth, 17000)
        assert r.status_code == 201
        assert r.json() == {"respiroSaldoAcumulado": 0}
        assert _linha_de_respiro(sessao).saldo_acumulado == 5000

    def test_sem_respiro_declarado_a_destinacao_devolve_404(self, client, auth):
        _fonte(client, auth)
        assert _destinar_respiro(client, auth, 1000).status_code == 404

    def test_a_destinacao_nao_toca_parcela_nem_divida(self, client, auth, sessao):
        # PF-1, decidido em 19/08/2026: a destinação DEBITA o saldo e grava o
        # lançamento, e nada mais. Não é pagamento, não abate saldo devedor.
        _fonte(client, auth)
        _declarar_respiro(client, auth, valorMensal=15000)
        _carimbar(sessao, saldo=22000)
        divida = client.post(
            "/v1/dividas",
            json={
                "credor": "Banco Teste",
                "valorCobrado": 1200000,
                "dataOrigem": "2025-01-10",
                "tipo": "consumo",
                "taxaJurosMensal": 200,
                "totalParcelas": 12,
                "primeiroVencimento": "2026-09-10",
            },
            headers=auth,
        ).json()["divida"]

        assert _destinar_respiro(client, auth, 22000).status_code == 201

        depois = client.get(f"/v1/dividas/{divida['id']}", headers=auth).json()["divida"]
        assert depois["valorCobrado"] == 1200000
        assert depois["situacao"] == divida["situacao"]
        parcelas = client.get(
            f"/v1/dividas/{divida['id']}/parcelas", headers=auth
        ).json()["parcelas"]
        assert all(p["pagoEm"] is None for p in parcelas)
        assert all(p["valorPago"] is None for p in parcelas)


class TestViradaDoMes:
    """
    O saldo não usado rola na virada, sem job, sem notificação e sem pergunta.

    O MODO DE FALHA É ROLAR DUAS VEZES e inflar o saldo em silêncio: ele seria
    invisível até alguém conferir a conta. Por isso cada cenário aqui lê MAIS DE
    UMA VEZ, e a asserção é sobre o total não ter se mexido na segunda leitura.
    """

    def test_a_primeira_leitura_de_uma_linha_sem_carimbo_so_carimba(
        self, client, auth, sessao
    ):
        # Sem carimbo não há mês fechado sob a linha, e somar o mês anterior
        # somaria uma fatia que ninguém reservou.
        _respiro_declarado(sessao, valor=15000)
        _fonte(client, auth)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroSaldoAcumulado"] == 0
        # O carimbo é o mês ANTERIOR: o mês corrente ainda está sendo vivido, e
        # a fatia dele é disponível, não saldo.
        assert _linha_de_respiro(sessao).ultimo_mes_apurado == _mes_relativo(1)

    def test_ler_varias_vezes_no_mesmo_mes_nao_rola_duas_vezes(
        self, client, auth, sessao
    ):
        _respiro_declarado(sessao, valor=15000)
        _fonte(client, auth)
        # Apurado até o antepassado: o mês passado ainda tem uma fatia a rolar.
        _carimbar(sessao, ultimo_mes_apurado=_mes_relativo(2))

        primeira = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert primeira["respiroSaldoAcumulado"] == 15000

        for _ in range(3):
            de_novo = client.get("/v1/caixa", headers=auth).json()["caixa"]
            assert de_novo["respiroSaldoAcumulado"] == 15000

        assert _linha_de_respiro(sessao).ultimo_mes_apurado == _mes_relativo(1)

    def test_dois_meses_fechados_rolam_uma_vez_cada(self, client, auth, sessao):
        _respiro_declarado(sessao, valor=15000)
        _fonte(client, auth)
        _carimbar(sessao, ultimo_mes_apurado=_mes_relativo(3))

        assert (
            client.get("/v1/caixa", headers=auth).json()["caixa"]["respiroSaldoAcumulado"]
            == 30000
        )
        assert (
            client.get("/v1/caixa", headers=auth).json()["caixa"]["respiroSaldoAcumulado"]
            == 30000
        )

    def test_o_que_foi_usado_no_mes_fechado_nao_rola(self, client, auth, sessao):
        from datetime import date, timedelta

        _respiro_declarado(sessao, valor=15000)
        _fonte(client, auth)
        ultimo_dia_do_mes_passado = date.today().replace(day=1) - timedelta(days=1)
        sessao.add(
            orm.RespiroUso(
                tenant_id=get_settings().tenant_id,
                valor=5000,
                data=ultimo_dia_do_mes_passado,
            )
        )
        sessao.commit()
        _carimbar(sessao, ultimo_mes_apurado=_mes_relativo(2))

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroSaldoAcumulado"] == 10000
        # E o sorvete do mês passado não come a fatia deste mês.
        assert caixa["respiroUsadoNoMes"] == 0
        assert caixa["respiroDisponivelNoMes"] == 15000

        assert (
            client.get("/v1/caixa", headers=auth).json()["caixa"]["respiroSaldoAcumulado"]
            == 10000
        )

    @pytest.mark.parametrize(
        "usos_do_mes_fechado, saldo_esperado",
        [
            # Fatia R$ 150, R$ 50 guardados. Só um dos dois termos da
            # liquidação é diferente de zero em cada linha.
            (10000, 10000),  # sobrou R$ 50 da fatia: 50 guardados + 50
            (17000, 3000),  # passou R$ 20 da fatia: 50 guardados − 20
            (30000, 0),  # passou mais do que havia: piso em zero, nunca dívida
        ],
    )
    def test_a_virada_liquida_o_mes_fechado_nas_duas_pontas(
        self, client, auth, sessao, usos_do_mes_fechado, saldo_esperado
    ):
        # Enquanto o mês corre, o excesso é descontado NA LEITURA; quando ele
        # fecha, o desconto vira definitivo. Sem esta ponta, o número sumiria
        # sozinho na virada.
        from datetime import date, timedelta

        _respiro_declarado(sessao, valor=15000, saldo=5000)
        _fonte(client, auth)
        sessao.add(
            orm.RespiroUso(
                tenant_id=get_settings().tenant_id,
                valor=usos_do_mes_fechado,
                data=date.today().replace(day=1) - timedelta(days=1),
            )
        )
        sessao.commit()
        _carimbar(sessao, ultimo_mes_apurado=_mes_relativo(2))

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroSaldoAcumulado"] == saldo_esperado
        # E a virada continua idempotente com a liquidação nas duas pontas.
        de_novo = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert de_novo["respiroSaldoAcumulado"] == saldo_esperado

    def test_o_excesso_do_mes_corrente_nao_e_liquidado_antes_da_virada(
        self, client, auth, sessao
    ):
        # A coluna é invariante durante o mês: o desconto que o usuário vê é
        # derivado, e é isso que mantém o desfazer exato.
        _respiro_declarado(sessao, valor=15000, saldo=5000)
        _fonte(client, auth)
        _usar_respiro(client, auth, 20000)

        assert (
            client.get("/v1/caixa", headers=auth).json()["caixa"][
                "respiroSaldoAcumulado"
            ]
            == 0
        )
        assert _linha_de_respiro(sessao).saldo_acumulado == 5000

    def test_a_virada_tambem_e_apurada_pelas_rotas_de_escrita(self, client, auth, sessao):
        # A rolagem não depende de alguém abrir a tela do caixa antes.
        _respiro_declarado(sessao, valor=15000)
        _fonte(client, auth)
        _carimbar(sessao, ultimo_mes_apurado=_mes_relativo(2))

        _usar_respiro(client, auth, 1000)
        assert _linha_de_respiro(sessao).saldo_acumulado == 15000

    def test_desativado_nao_acumula_mas_o_mes_e_carimbado(self, client, auth, sessao):
        # O que não foi reservado na cascata não pode acumular — e carimbar
        # impede que reativar meses depois faça aparecer saldo retroativo.
        _respiro_declarado(sessao, valor=15000, ativo=False)
        _fonte(client, auth)
        _carimbar(sessao, ultimo_mes_apurado=_mes_relativo(3))

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["respiroSaldoAcumulado"] == 0
        assert _linha_de_respiro(sessao).ultimo_mes_apurado == _mes_relativo(1)

        _declarar_respiro(client, auth, valorMensal=15000, ativo=True)
        assert (
            client.get("/v1/caixa", headers=auth).json()["caixa"]["respiroSaldoAcumulado"]
            == 0
        )

    def test_a_leitura_de_quem_nao_declarou_nao_grava_nada(self, client, auth, sessao):
        _fonte(client, auth)
        client.get("/v1/caixa", headers=auth)
        assert sessao.query(orm.Respiro).count() == 0


# --- F-011 · T3 · Renda tipada e compromisso percentual pela API --------------


class TestCamposNovosDoCaixa:
    """T3-AC1: os quatro campos do M12 no `GET /v1/caixa`."""

    def test_get_caixa_traz_os_quatro_campos_do_M12(self, client, auth):
        # `_fonte` é `pj_hora` sem alíquota: o par imposto-zero + sinal ligado.
        _fonte(client, auth)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["compromissoPercentualBps"] is None
        assert caixa["compromissoPercentual"] is None
        assert caixa["impostoNaoDeclarado"] is True
        assert caixa["impostoReservado"] == 0
        assert caixa["mesAncoraRenda"] is None

    def test_com_aliquota_na_fonte_o_sinal_apaga(self, client, auth):
        _fonte(client, auth, impostoBps=600)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["impostoNaoDeclarado"] is False
        assert caixa["impostoReservado"] == 60000


class TestCompromissoPercentualNasMetas:
    def test_grava_e_devolve_o_percentual_aplicado_no_servidor(self, client, auth):
        _fonte(client, auth, impostoBps=600)
        r = client.put(
            "/v1/caixa/metas", json={"compromissoPercentualBps": 1000}, headers=auth
        )
        assert r.status_code == 200
        assert r.json()["metas"]["compromissoPercentualBps"] == 1000

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        # 10% da LÍQUIDA (940.000) = 94.000 — o cliente não multiplica.
        assert caixa["compromissoPercentualBps"] == 1000
        assert caixa["compromissoPercentual"] == 94000
        assert caixa["capacidadeMaxima"] == 846000

    def test_zero_declarado_e_diferente_de_ausente(self, client, auth):
        _fonte(client, auth)
        client.put("/v1/caixa/metas", json={"compromissoPercentualBps": 0}, headers=auth)
        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert caixa["compromissoPercentualBps"] == 0
        assert caixa["compromissoPercentual"] == 0

    def test_bps_negativo_e_rejeitado(self, client, auth):
        r = client.put(
            "/v1/caixa/metas", json={"compromissoPercentualBps": -1}, headers=auth
        )
        assert r.status_code == 422

    def test_bps_acima_de_10000_e_rejeitado(self, client, auth):
        r = client.put(
            "/v1/caixa/metas", json={"compromissoPercentualBps": 10001}, headers=auth
        )
        assert r.status_code == 422

    def test_percentual_que_invade_o_piso_legal_devolve_422_sem_valor(self, client, auth):
        # Renda baixa e essenciais altos: um percentual grande empurra o que
        # sobra abaixo do piso legal.
        _fonte(client, auth, valorTipicoInformado=650000)
        _gasto(client, auth, valorMensal=600000)

        r = client.put(
            "/v1/caixa/metas", json={"compromissoPercentualBps": 5000}, headers=auth
        )
        assert r.status_code == 422
        corpo = r.json()
        assert corpo["campo"] == "compromissoPercentualBps"
        # A mensagem é exibida direto ao usuário: pt-BR, sem valor (guardrail 5).
        assert "mínimo existencial" in corpo["message"]
        assert "R$" not in corpo["message"]
        assert not any(ch.isdigit() for ch in corpo["message"])

    def test_sem_caixa_preenchido_nao_recusa(self, client, auth):
        # Mesma limitação declarada do respiro e de `_validar_aporte`: sem renda
        # não há o que comparar, e recusar diria a quem não informou nada que a
        # escolha dele é ilegal.
        r = client.put(
            "/v1/caixa/metas", json={"compromissoPercentualBps": 9000}, headers=auth
        )
        assert r.status_code == 200


class TestAliquotaPorFonteNaAPI:
    """T3-AC4: `impostoBps` e `diaPagamento` por fonte, com o `Perfil` de fallback."""

    def test_post_e_patch_aceitam_imposto_bps_e_dia_pagamento(self, client, auth):
        criada = _fonte(client, auth, impostoBps=600, diaPagamento=5).json()["fonte"]
        assert criada["impostoBps"] == 600
        assert criada["diaPagamento"] == 5

        editada = client.patch(
            f"/v1/caixa/fontes/{criada['id']}",
            json={"impostoBps": 800},
            headers=auth,
        ).json()["fonte"]
        assert editada["impostoBps"] == 800
        # Campo não enviado no PATCH permanece.
        assert editada["diaPagamento"] == 5

    def test_ausentes_a_fonte_continua_como_hoje_com_o_perfil_de_fallback(self, client, auth):
        _fonte(client, auth, valorTipicoInformado=1000000)  # sem impostoBps próprio
        client.put("/v1/caixa/metas", json={"impostoBps": 600}, headers=auth)

        caixa = client.get("/v1/caixa", headers=auth).json()["caixa"]
        # A fonte sem alíquota usa os 6% do perfil: 60.000, campo a campo o de hoje.
        assert caixa["impostoReservado"] == 60000
        assert caixa["impostoNaoDeclarado"] is False


class TestEventoPrevisivelAPI:
    def test_crud_completo(self, client, auth):
        criado = client.post(
            "/v1/caixa/eventos-previsiveis",
            json={"tipo": "decimo_terceiro", "mesPrevisto": 12, "valor": 300000},
            headers=auth,
        ).json()["evento"]
        assert criado["tipo"] == "decimo_terceiro"
        assert len(
            client.get("/v1/caixa/eventos-previsiveis", headers=auth).json()["eventos"]
        ) == 1

        client.patch(
            f"/v1/caixa/eventos-previsiveis/{criado['id']}",
            json={"valor": 350000},
            headers=auth,
        )
        lista = client.get("/v1/caixa/eventos-previsiveis", headers=auth).json()["eventos"]
        assert lista[0]["valor"] == 350000

        assert (
            client.delete(
                f"/v1/caixa/eventos-previsiveis/{criado['id']}", headers=auth
            ).status_code
            == 204
        )
        assert client.get(
            "/v1/caixa/eventos-previsiveis", headers=auth
        ).json()["eventos"] == []

    def test_nao_muda_nenhum_numero_da_cascata(self, client, auth):
        # ADR 0021, item 2: o evento previsível NÃO entra na cascata.
        _fonte(client, auth, impostoBps=600)
        antes = client.get("/v1/caixa", headers=auth).json()["caixa"]
        client.post(
            "/v1/caixa/eventos-previsiveis",
            json={"tipo": "ferias", "mesPrevisto": 1, "valor": 500000},
            headers=auth,
        )
        depois = client.get("/v1/caixa", headers=auth).json()["caixa"]
        assert antes == depois

    def test_evento_de_outro_tenant_devolve_404_e_nao_403(self, client, auth, sessao):
        import orm

        e = orm.EventoPrevisivel(
            tenant_id="outro-tenant", tipo="ferias", mes_previsto=1, valor=100000
        )
        sessao.add(e)
        sessao.commit()

        r = client.patch(
            f"/v1/caixa/eventos-previsiveis/{e.id}", json={"valor": 200000}, headers=auth
        )
        assert r.status_code == 404

    def test_fonte_de_outro_tenant_no_post_devolve_404(self, client, auth, sessao):
        import orm

        f = orm.FonteRenda(
            tenant_id="outro-tenant", nome="Alheia", tipo="clt", valor_tipico_informado=100000
        )
        sessao.add(f)
        sessao.commit()

        r = client.post(
            "/v1/caixa/eventos-previsiveis",
            json={"tipo": "outro", "mesPrevisto": 6, "valor": 1000, "fonteId": f.id},
            headers=auth,
        )
        assert r.status_code == 404


class TestCompromissoNoSimulador:
    """
    T3-AC7: o teto do simulador cai para quem declarou percentual — SEM
    `backend/routers/simulacoes.py` ter sido tocado. O simulador lê
    `capacidade_atual`, e a linha nova derruba `aporte_maximo`.
    """

    def _simular(self, client, auth, aporte):
        return client.post(
            "/v1/dividas/simulacoes",
            json={
                "aporteExtraMensal": aporte,
                "estrategias": ["avalanche"],
                "dividasIds": None,
            },
            headers=auth,
        )

    def test_um_aporte_aceito_passa_a_ser_recusado_apos_o_compromisso(self, client, auth):
        _fonte(client, auth, valorTipicoInformado=1000000)  # pj_hora, sem imposto
        _gasto(client, auth, valorMensal=400000)  # essencial
        client.post(
            "/v1/dividas",
            json={
                "credor": "Banco Teste",
                "valorCobrado": 100000,
                "dataOrigem": "2025-01-10",
                "tipo": "consumo",
            },
            headers=auth,
        )

        # Sem compromisso, `aporte_maximo` é 600.000: 550.000 cabe.
        assert self._simular(client, auth, 550000).status_code == 200

        # 10% da líquida (1.000.000) = 100.000 → teto cai para 500.000.
        client.put(
            "/v1/caixa/metas", json={"compromissoPercentualBps": 1000}, headers=auth
        )
        assert self._simular(client, auth, 550000).status_code == 422
