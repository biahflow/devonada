from datetime import date, timedelta

import pytest

from assistente.base import (
    Assistente,
    ContextoDoUsuario,
    DividaDoContexto,
    ErroDeAssistente,
    PedidoDeCard,
    RespostaAssistente,
)
from assistente.determinista import AssistenteDeterminista

HOJE = date.today()
ROTA = "/v1/chat/messages"


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


def _enviar(client, auth, texto):
    return client.post(ROTA, json={"content": texto}, headers=auth)


def _contexto(*credores):
    return ContextoDoUsuario(
        dividas=[
            DividaDoContexto(
                divida_id=f"id-{i}", credor=c, tipo="consumo", situacao="ativa"
            )
            for i, c in enumerate(credores)
        ]
    )


class TestDeterminista:
    def test_satisfaz_o_protocol(self):
        assert isinstance(AssistenteDeterminista(), Assistente)

    def test_credor_citado_vira_card_daquela_divida(self):
        r = AssistenteDeterminista().responder("como está o nubank?", _contexto("Nubank"), [])
        assert [c.tipo for c in r.cards] == ["divida_resumo"]
        assert r.cards[0].divida_id == "id-0"

    def test_credor_sem_acento_tambem_casa(self):
        # "Distribuição" digitado sem acento é a mesma pergunta.
        r = AssistenteDeterminista().responder("e a financeira sao paulo?", _contexto("Financeira São Paulo"), [])
        assert r.cards[0].divida_id == "id-0"

    def test_pedido_de_plano_vira_card_de_plano(self):
        r = AssistenteDeterminista().responder("me ajuda a quitar isso", _contexto("Nubank"), [])
        assert [c.tipo for c in r.cards] == ["plano_sugerido"]

    def test_pergunta_desconhecida_admite_que_nao_sabe(self):
        # Guardrail 7.1: recusar é melhor que estimar.
        r = AssistenteDeterminista().responder(
            "o que você acha da taxa selic?", _contexto("Nubank"), []
        )
        assert r.cards == []
        assert "não sei responder" in r.content

    def test_sem_divida_cadastrada_convida_a_cadastrar(self):
        r = AssistenteDeterminista().responder("quanto devo?", ContextoDoUsuario(), [])
        assert r.cards == []
        assert "Cadastre a primeira" in r.content

    def test_nenhuma_resposta_contem_numero(self):
        # A regra do produto: número vai em card, nunca no texto.
        contexto = _contexto("Nubank")
        for pergunta in ("quanto devo?", "quero quitar", "e o nubank?", "qualquer outra coisa"):
            conteudo = AssistenteDeterminista().responder(pergunta, contexto, []).content
            assert not any(ch.isdigit() for ch in conteudo), pergunta


class TestRotaDeChat:
    def test_exige_auth(self, client):
        assert client.post(ROTA, json={"content": "oi"}).status_code == 401
        assert client.get(ROTA).status_code == 401

    def test_mensagem_vazia_e_rejeitada(self, client, auth):
        r = _enviar(client, auth, "   ")
        assert r.status_code == 422
        assert r.json()["campo"] == "content"

    def test_card_e_preenchido_com_dado_do_banco(self, client, auth):
        d = _criar(client, auth, credor="Nubank", valorCobrado=250000)
        card = _enviar(client, auth, "como está o nubank?").json()["message"]["cards"][0]

        assert card["kind"] == "divida_resumo"
        assert card["dividaId"] == d["id"]
        # O valor NÃO veio do assistente: veio da linha do banco.
        assert card["saldoDevedor"] == 250000
        assert card["criticidade"] == "juros_abusivos"

    def test_saldo_do_card_sai_das_parcelas_em_aberto(self, client, auth):
        d = _criar(
            client,
            auth,
            credor="Nubank",
            valorCobrado=120000,
            totalParcelas=12,
            primeiroVencimento=str(HOJE + timedelta(days=5)),
        )
        parcelas = client.get(f"/v1/dividas/{d['id']}/parcelas", headers=auth).json()["parcelas"]
        client.post(
            f"/v1/parcelas/{parcelas[0]['id']}/pagamento",
            json={"pagoEm": str(HOJE), "valorPago": parcelas[0]["valor"]},
            headers=auth,
        )

        card = _enviar(client, auth, "e o nubank?").json()["message"]["cards"][0]
        assert card["saldoDevedor"] == 120000 - parcelas[0]["valor"]

    def test_card_de_plano_bate_com_o_simulador(self, client, auth):
        _criar(
            client,
            auth,
            credor="Nubank",
            valorCobrado=120000,
            taxaJurosMensal=300,
            totalParcelas=12,
            primeiroVencimento=str(HOJE + timedelta(days=5)),
        )
        card = _enviar(client, auth, "quero um plano para quitar").json()["message"]["cards"][0]

        simulado = client.post(
            "/v1/dividas/simulacoes",
            json={"aporteExtraMensal": 0, "estrategias": ["avalanche"], "dividasIds": None},
            headers=auth,
        ).json()["simulacoes"][0]

        # Uma pergunta, um número: o chat e o simulador não podem divergir.
        assert card["mesesAteQuitacao"] == simulado["mesesAteQuitacao"]
        assert card["dataLiberdade"] == simulado["dataLiberdade"]

    def test_divida_de_outro_tenant_nao_vira_card(self, client, auth, sessao):
        import orm

        sessao.add(
            orm.Divida(
                id="divida-de-outro",
                tenant_id="outro-tenant",
                credor="Banco Alheio",
                valor_cobrado=999999,
                data_origem=HOJE,
                tipo="consumo",
            )
        )
        sessao.commit()

        # O credor existe no banco, mas não no contexto deste tenant.
        cards = _enviar(client, auth, "e o banco alheio?").json()["message"]["cards"]
        assert cards == []


class TestHistorico:
    def test_conversa_sobrevive_entre_sessoes(self, client, auth):
        _criar(client, auth, credor="Nubank")
        _enviar(client, auth, "e o nubank?")

        mensagens = client.get(ROTA, headers=auth).json()["mensagens"]
        assert [m["role"] for m in mensagens] == ["user", "assistant"]
        assert mensagens[0]["content"] == "e o nubank?"

    def test_historico_comeca_vazio(self, client, auth):
        assert client.get(ROTA, headers=auth).json()["mensagens"] == []

    def test_card_do_historico_e_remontado_com_o_saldo_de_hoje(self, client, auth):
        d = _criar(client, auth, credor="Nubank", valorCobrado=250000)
        _enviar(client, auth, "e o nubank?")

        client.patch(f"/v1/dividas/{d['id']}", json={"valorCobrado": 100000}, headers=auth)

        # O card foi gravado com 250000. Se o histórico servisse o JSON
        # congelado, a conversa exibiria hoje um saldo que não existe mais.
        mensagens = client.get(ROTA, headers=auth).json()["mensagens"]
        assert mensagens[-1]["cards"][0]["saldoDevedor"] == 100000

    def test_pergunta_do_usuario_e_gravada_mesmo_quando_o_assistente_falha(
        self, client, auth, monkeypatch
    ):
        import assistente

        class AssistenteQueFalha:
            def responder(self, mensagem, contexto, historico):
                raise ErroDeAssistente("Não deu certo agora. Tente de novo.")

        monkeypatch.setattr(assistente, "obter_assistente", lambda: AssistenteQueFalha())
        import routers.chat as rota_chat

        monkeypatch.setattr(rota_chat, "obter_assistente", lambda: AssistenteQueFalha())

        r = _enviar(client, auth, "oi")
        assert r.status_code == 503
        assert "Tente de novo" in r.json()["message"]

        # O que a pessoa escreveu não se perde por falha nossa.
        mensagens = client.get(ROTA, headers=auth).json()["mensagens"]
        assert [m["content"] for m in mensagens] == ["oi"]


class TestGuardrail71:
    """Número no texto sem card que o sustente é cortado no servidor."""

    def _assistente(self, resposta: dict):
        from assistente.assistente_llm import AssistenteLLM

        class ClienteFake:
            def responder_json(self, **kwargs):
                return resposta

        return AssistenteLLM(cliente=ClienteFake())

    def test_numero_sem_card_derruba_o_texto(self):
        r = self._assistente(
            {"texto": "Você deve R$ 1.500,00 no total.", "cards": []}
        ).responder("quanto devo?", _contexto("Nubank"), [])

        assert "1.500" not in r.content
        assert "não responder isso de cabeça" in r.content

    def test_numero_com_card_sobrevive(self):
        # Com card, o número exibido tem procedência — e o texto pode citar.
        r = self._assistente(
            {
                "texto": "Veja o retrato da dívida.",
                "cards": [{"tipo": "divida_resumo", "dividaId": "id-0", "aporteExtraMensal": None}],
            }
        ).responder("e o nubank?", _contexto("Nubank"), [])

        assert r.content == "Veja o retrato da dívida."
        assert r.cards[0].divida_id == "id-0"

    def test_id_fora_do_contexto_e_descartado(self):
        # Barreira de isolamento: o contexto só tem dívidas do tenant.
        r = self._assistente(
            {
                "texto": "Veja.",
                "cards": [
                    {"tipo": "divida_resumo", "dividaId": "id-de-outro", "aporteExtraMensal": None}
                ],
            }
        ).responder("x", _contexto("Nubank"), [])

        assert r.cards == []

    def test_texto_sem_numero_e_sem_card_passa_intacto(self):
        r = self._assistente({"texto": "Me conta mais sobre essa cobrança.", "cards": []}).responder(
            "oi", _contexto("Nubank"), []
        )
        assert r.content == "Me conta mais sobre essa cobrança."

    def test_erro_do_provedor_vira_erro_de_assistente(self):
        from assistente.assistente_llm import AssistenteLLM
        from llm import ErroDeLLM

        class ClienteQueFalha:
            def responder_json(self, **kwargs):
                raise ErroDeLLM("Não deu certo agora.")

        with pytest.raises(ErroDeAssistente):
            AssistenteLLM(cliente=ClienteQueFalha()).responder("oi", _contexto("Nubank"), [])
