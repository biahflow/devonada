import json
from datetime import date, timedelta

import pytest

import orm
import schemas
from assistente.base import PedidoDeCard, RespostaAssistente
from assistente.assistente_llm import AssistenteLLM
from config import get_settings

HOJE = date.today()


def _campo(valor=None, trecho=None):
    return {"valor": valor, "confianca": "alta", "trecho": trecho, "pagina": 1}


def _campos(**over):
    base = {nome: _campo() for nome in schemas.CamposContrato.model_fields}
    base.update(over)
    return json.dumps(base)


@pytest.fixture
def tetos_configurados():
    """
    Configura os tetos e devolve o `Settings` ao estado anterior no fim.

    `get_settings` é `lru_cache`, então mexer no objeto exige limpar o cache —
    senão o teste seguinte herda o teto deste.
    """
    s = get_settings()
    antes = (
        s.teto_juros_consignado_inss_bps,
        s.teto_juros_cartao_consignado_bps,
        s.tetos_vigentes_em,
    )
    s.teto_juros_consignado_inss_bps = 1_850
    s.teto_juros_cartao_consignado_bps = 2_460
    s.tetos_vigentes_em = "2025-03-25"
    yield
    (
        s.teto_juros_consignado_inss_bps,
        s.teto_juros_cartao_consignado_bps,
        s.tetos_vigentes_em,
    ) = antes


def _criar_divida(client, auth, **over):
    base = {
        "credor": "Banco Teste S/A",
        "valorCobrado": 1_500_000,
        "dataOrigem": "2021-06-01",
        "tipo": "juros_abusivos",
    }
    base.update(over)
    return client.post("/v1/dividas", json=base, headers=auth).json()["divida"]


def _com_contrato(client, auth, sessao, **campos_over):
    """Cria uma dívida ligada a uma extração já concluída."""
    extracao = orm.Extracao(
        tenant_id=get_settings().tenant_id,
        status="concluida",
        campos_json=_campos(**campos_over),
    )
    sessao.add(extracao)
    sessao.commit()

    divida = _criar_divida(client, auth, extracaoId=extracao.id)
    return divida


def _revisar(client, auth, divida_id):
    return client.get(f"/v1/dividas/{divida_id}/revisao", headers=auth)


class TestRota:
    def test_divida_sem_contrato_lido_responde_200_sem_achado(self, client, auth):
        # Resposta válida, não erro: não ter o que conferir é uma verdade.
        d = _criar_divida(client, auth)
        r = _revisar(client, auth, d["id"])
        assert r.status_code == 200
        corpo = r.json()["revisao"]
        assert corpo["achados"] == []
        assert corpo["valorJusto"] is None
        assert corpo["script"] is None

    def test_id_inexistente_devolve_404(self, client, auth):
        r = _revisar(client, auth, "nao-existe")
        assert r.status_code == 404
        assert "message" in r.json()

    def test_sem_token_devolve_401(self, client):
        d_id = "qualquer"
        assert client.get(f"/v1/dividas/{d_id}/revisao").status_code == 401

    def test_achado_carrega_fonte_e_trecho_literal(self, client, auth, sessao):
        d = _com_contrato(
            client,
            auth,
            sessao,
            multaMoratoriaMensal=_campo(500, "Multa por atraso: 5% da parcela"),
        )
        achados = _revisar(client, auth, d["id"]).json()["revisao"]["achados"]
        multa = next(a for a in achados if a["id"] == "multa_acima_do_teto")
        assert multa["fonte"].startswith("Código de Defesa do Consumidor")
        assert multa["evidencia"] == "Multa por atraso: 5% da parcela"

    def test_valor_justo_e_a_subtracao(self, client, auth, sessao):
        d = _com_contrato(
            client,
            auth,
            sessao,
            seguroPrestamista=_campo(120_000, "Seguro prestamista: R$ 1.200,00"),
        )
        corpo = _revisar(client, auth, d["id"]).json()["revisao"]
        assert corpo["valorCobrado"] == 1_500_000
        assert corpo["valorJusto"] == 1_380_000

    def test_economia_nao_viaja_na_resposta(self, client, auth, sessao):
        # O cliente a calcula — é a única subtração que o guardrail 1.2 permite.
        d = _com_contrato(
            client, auth, sessao, seguroPrestamista=_campo(120_000, "Seguro: R$ 1.200,00")
        )
        assert "economia" not in _revisar(client, auth, d["id"]).json()["revisao"]

    def test_campo_sem_trecho_nao_vira_achado(self, client, auth, sessao):
        # Guardrail 8.1: valor sem evidência é palpite, e palpite não vira achado.
        d = _com_contrato(client, auth, sessao, seguroPrestamista=_campo(120_000, None))
        corpo = _revisar(client, auth, d["id"]).json()["revisao"]
        assert all(a["id"] != "seguro_prestamista_embutido" for a in corpo["achados"])

    def test_script_lista_os_achados_e_nao_e_nulo(self, client, auth, sessao):
        d = _com_contrato(
            client, auth, sessao, seguroPrestamista=_campo(120_000, "Seguro: R$ 1.200,00")
        )
        corpo = _revisar(client, auth, d["id"]).json()["revisao"]
        assert corpo["script"]
        assert "Banco Teste S/A" in corpo["script"]
        assert corpo["fundamentos"]


class TestTetos:
    def test_teto_configurado_produz_achado_com_vigencia(
        self, client, auth, sessao, tetos_configurados
    ):
        d = _com_contrato(
            client,
            auth,
            sessao,
            modalidade=_campo("consignado_inss", "Consignado INSS"),
            taxaJurosMensal=_campo(2_500, "Taxa: 25,00% a.m."),
        )
        corpo = _revisar(client, auth, d["id"]).json()["revisao"]
        assert any(a["id"] == "juros_acima_do_teto" for a in corpo["achados"])
        assert corpo["baseLegalVigenteEm"] == "2025-03-25"

    def test_sem_teto_configurado_o_achado_some_e_nenhum_numero_sobra(
        self, client, auth, sessao
    ):
        # O caso que a ADR 0008 protege: teto não confirmado não vira comparação.
        d = _com_contrato(
            client,
            auth,
            sessao,
            modalidade=_campo("consignado_inss", "Consignado INSS"),
            taxaJurosMensal=_campo(2_500, "Taxa: 25,00% a.m."),
        )
        corpo = _revisar(client, auth, d["id"]).json()["revisao"]
        assert all(a["id"] != "juros_acima_do_teto" for a in corpo["achados"])
        assert corpo["baseLegalVigenteEm"] is None


class TestIsolamento:
    def test_divida_de_outro_tenant_devolve_404_e_nao_403(self, client, auth, sessao):
        # 403 confirmaria que o id existe.
        alheia = orm.Divida(
            tenant_id="outro-tenant",
            credor="Banco de Outro",
            valor_cobrado=100_000,
            data_origem=date(2022, 1, 1),
            tipo="consumo",
        )
        sessao.add(alheia)
        sessao.commit()

        assert _revisar(client, auth, alheia.id).status_code == 404


class TestCardNoChat:
    """
    O card sai de `montar_cards`, com os números da rota — o assistente só
    escolheu a dívida. Mesmo regime do `divida_resumo` (guardrail 7.1).
    """

    def test_sem_achado_com_valor_o_card_nao_e_emitido(self, client, auth, sessao):
        from routers.chat import montar_cards

        d = _criar_divida(client, auth)
        cards = montar_cards(
            sessao,
            get_settings().tenant_id,
            [PedidoDeCard(tipo="valor_justo", divida_id=d["id"])],
        )
        assert cards == []

    def test_com_achado_o_card_traz_os_numeros_da_rota(self, client, auth, sessao):
        from routers.chat import montar_cards

        d = _com_contrato(
            client, auth, sessao, seguroPrestamista=_campo(120_000, "Seguro: R$ 1.200,00")
        )
        cards = montar_cards(
            sessao,
            get_settings().tenant_id,
            [PedidoDeCard(tipo="valor_justo", divida_id=d["id"])],
        )
        assert len(cards) == 1
        assert cards[0].kind == "valor_justo"
        assert cards[0].valorJusto == 1_380_000
        assert cards[0].dividaId == d["id"]

    def test_divida_de_outro_tenant_nao_vira_card(self, client, auth, sessao):
        from routers.chat import montar_cards

        d = _com_contrato(
            client, auth, sessao, seguroPrestamista=_campo(120_000, "Seguro: R$ 1.200,00")
        )
        cards = montar_cards(
            sessao, "outro-tenant", [PedidoDeCard(tipo="valor_justo", divida_id=d["id"])]
        )
        assert cards == []


class TestCamadaDoAssistente:
    """
    `valor_justo` NÃO sustenta número no texto livre, de propósito: a rota pode
    descartá-lo (quando não há achado), e um número cujo card sumiu é
    exatamente o modo de falha do guardrail 7.1.
    """

    class _Cliente:
        def __init__(self, resposta):
            self.resposta = resposta

        def responder_json(self, **kwargs):
            return self.resposta

    def _responder(self, resposta, contexto):
        return AssistenteLLM(self._Cliente(resposta)).responder("e aí?", contexto, [])

    def test_id_fora_do_contexto_derruba_o_card(self):
        from assistente.base import ContextoDoUsuario, DividaDoContexto

        ctx = ContextoDoUsuario(
            dividas=[DividaDoContexto("id-1", "Nubank", "consumo", "ativa")]
        )
        r = self._responder(
            {
                "texto": "Vou olhar isso.",
                "cards": [
                    {
                        "tipo": "valor_justo",
                        "dividaId": "id-de-outro",
                        "aporteExtraMensal": None,
                        "proposta": None,
                    }
                ],
            },
            ctx,
        )
        assert r.cards == []

    def test_numero_no_texto_com_so_valor_justo_derruba_o_texto(self):
        from assistente.base import ContextoDoUsuario, DividaDoContexto

        ctx = ContextoDoUsuario(
            dividas=[DividaDoContexto("id-1", "Nubank", "consumo", "ativa")]
        )
        r = self._responder(
            {
                "texto": "Você está pagando R$ 1.200 a mais.",
                "cards": [
                    {
                        "tipo": "valor_justo",
                        "dividaId": "id-1",
                        "aporteExtraMensal": None,
                        "proposta": None,
                    }
                ],
            },
            ctx,
        )
        assert "1.200" not in r.content
        assert isinstance(r, RespostaAssistente)


class TestConversaNaoGrava:
    def test_pedir_revisao_nao_altera_nenhuma_divida(self, client, auth, sessao):
        from routers.chat import montar_cards

        d = _com_contrato(
            client, auth, sessao, seguroPrestamista=_campo(120_000, "Seguro: R$ 1.200,00")
        )
        antes = client.get("/v1/dividas", headers=auth).json()

        montar_cards(
            sessao,
            get_settings().tenant_id,
            [PedidoDeCard(tipo="valor_justo", divida_id=d["id"])],
        )

        # A revisão é leitura pura. Nenhuma rota de escrita nova entrou no M6.
        assert client.get("/v1/dividas", headers=auth).json() == antes


class TestNaoEnvelhece:
    def test_parcela_paga_muda_a_revisao_na_mesma_sessao(self, client, auth, sessao):
        """
        A multa incide sobre parcela ATRASADA. Baixar a parcela tem de reduzir o
        valor contestável — o card é remontado a cada leitura, não guardado.
        """
        d = _com_contrato(
            client,
            auth,
            sessao,
            multaMoratoriaMensal=_campo(500, "Multa: 5% da parcela"),
        )
        vencida = HOJE - timedelta(days=30)
        client.patch(
            f"/v1/dividas/{d['id']}",
            json={"valorCobrado": 1_500_000},
            headers=auth,
        )
        sessao.add(
            orm.Parcela(
                tenant_id=get_settings().tenant_id,
                divida_id=d["id"],
                numero=1,
                total=1,
                valor=100_000,
                vencimento=vencida,
            )
        )
        sessao.commit()

        antes = _revisar(client, auth, d["id"]).json()["revisao"]
        multa = next(a for a in antes["achados"] if a["id"] == "multa_acima_do_teto")
        assert multa["valorContestavel"] == 3_000  # 3% de R$ 1.000,00

        parcela_id = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()[
            "parcelas"
        ][0]["id"]
        client.post(
            f"/v1/parcelas/{parcela_id}/pagamento",
            json={"pagoEm": HOJE.isoformat(), "valorPago": 100_000},
            headers=auth,
        )

        depois = _revisar(client, auth, d["id"]).json()["revisao"]
        multa = next(a for a in depois["achados"] if a["id"] == "multa_acima_do_teto")
        assert multa["valorContestavel"] is None
