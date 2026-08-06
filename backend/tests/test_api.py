from datetime import date, timedelta

import schemas
from extracao.base import limpar_campos_sem_evidencia

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


class TestAuth:
    def test_health_check_nao_exige_token(self, client):
        assert client.get("/").status_code == 200

    def test_sem_token_devolve_401(self, client):
        r = client.get("/v1/dividas")
        assert r.status_code == 401
        assert "message" in r.json()

    def test_token_errado_devolve_401(self, client):
        r = client.get("/v1/dividas", headers={"Authorization": "Bearer errado"})
        assert r.status_code == 401

    def test_header_malformado_devolve_401(self, client):
        r = client.get("/v1/dividas", headers={"Authorization": "token-de-teste"})
        assert r.status_code == 401

    def test_token_certo_passa(self, client, auth):
        assert client.get("/v1/dividas", headers=auth).status_code == 200

    def test_erro_de_auth_nao_vaza_detalhe_tecnico(self, client):
        corpo = client.get("/v1/dividas").json()
        assert "token" not in corpo["message"].lower()


class TestCrudDividas:
    def test_lista_comeca_vazia(self, client, auth):
        assert client.get("/v1/dividas", headers=auth).json() == {"dividas": []}

    def test_cria_e_lista(self, client, auth):
        r = client.post("/v1/dividas", json=_nova(), headers=auth)
        assert r.status_code == 201
        divida = r.json()["divida"]
        assert divida["credor"] == "Banco Teste S/A"
        assert divida["valorCobrado"] == 150000

        listadas = client.get("/v1/dividas", headers=auth).json()["dividas"]
        assert len(listadas) == 1

    def test_id_e_uuid_em_string(self, client, auth):
        # O bug que impedia o POST de funcionar: id: int com uuid string.
        divida = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        assert isinstance(divida["id"], str)
        assert len(divida["id"]) == 36

    def test_sem_taxa_valor_corrigido_e_null_nunca_zero(self, client, auth):
        divida = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        assert divida["valorCorrigido"] is None

    def test_com_taxa_valor_corrigido_e_calculado(self, client, auth):
        divida = client.post(
            "/v1/dividas",
            json=_nova(dataOrigem=str(HOJE - timedelta(days=365)), taxaJurosMensal=100),
            headers=auth,
        ).json()["divida"]
        assert divida["valorCorrigido"] is not None
        assert divida["valorCorrigido"] > 150000

    def test_divida_antiga_sinaliza_prescricao(self, client, auth):
        divida = client.post(
            "/v1/dividas", json=_nova(dataOrigem="2015-06-01"), headers=auth
        ).json()["divida"]
        assert divida["possivelPrescricao"] is True

    def test_divida_recente_nao_sinaliza(self, client, auth):
        divida = client.post(
            "/v1/dividas", json=_nova(dataOrigem=str(HOJE - timedelta(days=30))), headers=auth
        ).json()["divida"]
        assert divida["possivelPrescricao"] is False

    def test_data_no_futuro_e_rejeitada(self, client, auth):
        r = client.post(
            "/v1/dividas", json=_nova(dataOrigem=str(HOJE + timedelta(days=1))), headers=auth
        )
        assert r.status_code == 422
        assert r.json()["campo"] == "dataOrigem"

    def test_tipo_invalido_e_rejeitado(self, client, auth):
        r = client.post("/v1/dividas", json=_nova(tipo="inventado"), headers=auth)
        assert r.status_code == 422

    def test_valor_zero_e_rejeitado(self, client, auth):
        assert client.post("/v1/dividas", json=_nova(valorCobrado=0), headers=auth).status_code == 422

    def test_detalhe(self, client, auth):
        criada = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        r = client.get(f"/v1/dividas/{criada['id']}", headers=auth)
        assert r.status_code == 200
        assert r.json()["divida"]["id"] == criada["id"]

    def test_id_inexistente_devolve_404_e_nao_403(self, client, auth):
        # 403 confirmaria que o id existe — é o que não queremos revelar.
        r = client.get("/v1/dividas/00000000-0000-0000-0000-000000000999", headers=auth)
        assert r.status_code == 404

    def test_edita(self, client, auth):
        criada = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        r = client.patch(
            f"/v1/dividas/{criada['id']}", json={"credor": "Nubank"}, headers=auth
        )
        assert r.json()["divida"]["credor"] == "Nubank"
        assert r.json()["divida"]["valorCobrado"] == 150000

    def test_quita(self, client, auth):
        criada = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        r = client.post(
            f"/v1/dividas/{criada['id']}/quitacao",
            json={"dataQuitacao": str(HOJE), "valorPago": 90000},
            headers=auth,
        )
        assert r.json()["divida"]["situacao"] == "quitada"
        assert r.json()["divida"]["saldoDevedor"] == 0

    def test_quitar_duas_vezes_devolve_409(self, client, auth):
        criada = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        corpo = {"dataQuitacao": str(HOJE), "valorPago": 90000}
        client.post(f"/v1/dividas/{criada['id']}/quitacao", json=corpo, headers=auth)
        r = client.post(f"/v1/dividas/{criada['id']}/quitacao", json=corpo, headers=auth)
        assert r.status_code == 409

    def test_exclusao_e_logica(self, client, auth):
        criada = client.post("/v1/dividas", json=_nova(), headers=auth).json()["divida"]
        assert client.delete(f"/v1/dividas/{criada['id']}", headers=auth).status_code == 204
        assert client.get("/v1/dividas", headers=auth).json()["dividas"] == []
        assert client.get(f"/v1/dividas/{criada['id']}", headers=auth).status_code == 404


class TestPerfil:
    def test_perfil_vazio_devolve_campos_ausentes_nao_zero(self, client, auth):
        perfil = client.get("/v1/perfil", headers=auth).json()["perfil"]
        assert perfil["rendaMensal"] is None
        assert perfil["dependentes"] is None

    def test_grava_e_le(self, client, auth):
        client.put("/v1/perfil", json={"rendaMensal": 550000, "dependentes": 2}, headers=auth)
        perfil = client.get("/v1/perfil", headers=auth).json()["perfil"]
        assert perfil["rendaMensal"] == 550000
        assert perfil["dependentes"] == 2

    def test_sobrescreve(self, client, auth):
        client.put("/v1/perfil", json={"rendaMensal": 550000}, headers=auth)
        client.put("/v1/perfil", json={"rendaMensal": 700000}, headers=auth)
        assert client.get("/v1/perfil", headers=auth).json()["perfil"]["rendaMensal"] == 700000


class TestResumo:
    def test_resumo_vazio(self, client, auth):
        r = client.get("/v1/dividas/resumo", headers=auth)
        assert r.status_code == 200
        resumo = r.json()["resumo"]
        assert resumo["totalDevido"] == 0
        assert resumo["quantidadeDividas"] == 0

    def test_rota_resumo_nao_e_capturada_como_id(self, client, auth):
        # /v1/dividas/{id} viria antes se a ordem de registro estivesse errada.
        assert client.get("/v1/dividas/resumo", headers=auth).status_code == 200

    def test_soma_e_conta_dividas_ativas(self, client, auth):
        client.post("/v1/dividas", json=_nova(valorCobrado=100000), headers=auth)
        client.post("/v1/dividas", json=_nova(valorCobrado=50000, tipo="consumo"), headers=auth)
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert resumo["totalDevido"] == 150000
        assert resumo["quantidadeDividas"] == 2

    def test_quitada_sai_do_total(self, client, auth):
        criada = client.post("/v1/dividas", json=_nova(valorCobrado=100000), headers=auth).json()[
            "divida"
        ]
        client.post(
            f"/v1/dividas/{criada['id']}/quitacao",
            json={"dataQuitacao": str(HOJE), "valorPago": 90000},
            headers=auth,
        )
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert resumo["totalDevido"] == 0
        assert resumo["totalQuitadoNoAno"] == 90000

    def test_sem_renda_campos_derivados_vem_ausentes(self, client, auth):
        client.post("/v1/dividas", json=_nova(), headers=auth)
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert resumo["rendaMensal"] is None
        assert resumo["comprometimentoRenda"] is None
        assert resumo["minimoExistencial"] is None

    def test_com_renda_calcula_minimo_existencial(self, client, auth):
        client.put("/v1/perfil", json={"rendaMensal": 550000}, headers=auth)
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert resumo["rendaMensal"] == 550000
        assert resumo["minimoExistencial"] == 37950  # 25% de R$ 1.518,00

    def test_distribuicao_por_criticidade_em_ordem_de_ataque(self, client, auth):
        client.post("/v1/dividas", json=_nova(tipo="consumo"), headers=auth)
        client.post("/v1/dividas", json=_nova(tipo="juros_abusivos"), headers=auth)
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert [p["tipo"] for p in resumo["porCriticidade"]] == ["juros_abusivos", "consumo"]

    def test_snapshot_nao_duplica_no_mesmo_mes(self, client, auth):
        client.post("/v1/dividas", json=_nova(), headers=auth)
        client.get("/v1/dividas/resumo", headers=auth)
        client.get("/v1/dividas/resumo", headers=auth)
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert len(resumo["evolucaoSaldo"]) == 1

    def test_mes_futuro_e_rejeitado(self, client, auth):
        r = client.get("/v1/dividas/resumo?mes=2099-01", headers=auth)
        assert r.status_code == 422

    def test_proximos_vencimentos_vazio_ate_o_bloco_5(self, client, auth):
        client.post("/v1/dividas", json=_nova(), headers=auth)
        resumo = client.get("/v1/dividas/resumo", headers=auth).json()["resumo"]
        assert resumo["proximosVencimentos"] == []


class TestExtracaoGuardrail:
    def _campos(self, **over):
        base = {
            nome: {"valor": None, "confianca": "baixa", "trecho": None, "pagina": None}
            for nome in (
                "credor",
                "valorCobrado",
                "dataOrigem",
                "tipo",
                "taxaJurosMensal",
                "totalParcelas",
                "cet",
            )
        }
        base.update(over)
        return schemas.CamposContrato.model_validate(base)

    def test_campo_com_valor_e_sem_trecho_e_zerado(self):
        # Guardrail 8.1 aplicado no SERVIDOR: número sem evidência não sai da rota.
        campos = self._campos(
            valorCobrado={"valor": 999999, "confianca": "alta", "trecho": None, "pagina": None}
        )
        limpos = limpar_campos_sem_evidencia(campos)
        assert limpos.valorCobrado.valor is None
        assert limpos.valorCobrado.confianca == "baixa"

    def test_campo_com_trecho_sobrevive(self):
        campos = self._campos(
            valorCobrado={
                "valor": 150000,
                "confianca": "alta",
                "trecho": "Valor total: R$ 1.500,00",
                "pagina": 1,
            }
        )
        limpos = limpar_campos_sem_evidencia(campos)
        assert limpos.valorCobrado.valor == 150000

    def test_campo_nulo_permanece_nulo(self):
        limpos = limpar_campos_sem_evidencia(self._campos())
        assert limpos.credor.valor is None


class TestContratos:
    def test_upload_exige_auth(self, client):
        r = client.post("/v1/contratos", files={"arquivo": ("c.pdf", b"x", "application/pdf")})
        assert r.status_code == 401

    def test_formato_nao_suportado_e_rejeitado(self, client, auth):
        r = client.post(
            "/v1/contratos",
            files={"arquivo": ("c.txt", b"texto", "text/plain")},
            headers=auth,
        )
        assert r.status_code == 422

    def test_extracao_inexistente_devolve_404(self, client, auth):
        r = client.get("/v1/contratos/00000000-0000-0000-0000-000000000999", headers=auth)
        assert r.status_code == 404

    def test_sem_chave_configurada_falha_com_mensagem_util(self, client, auth, monkeypatch):
        # Sem ANTHROPIC_API_KEY o endpoint não pode estourar 500 — o app precisa
        # de uma frase que o usuário entenda e um caminho alternativo.
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        r = client.post(
            "/v1/contratos",
            files={"arquivo": ("c.pdf", b"%PDF-1.4 fake", "application/pdf")},
            headers=auth,
        )
        assert r.status_code == 202
        extracao_id = r.json()["extracao"]["id"]

        seguinte = client.get(f"/v1/contratos/{extracao_id}", headers=auth).json()["extracao"]
        assert seguinte["status"] == "falhou"
        assert "à mão" in seguinte["erro"]
