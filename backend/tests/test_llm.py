import base64
import json
from collections.abc import Sequence

import pytest

from llm.base import (
    Bloco,
    BlocoDocumento,
    BlocoImagem,
    BlocoTexto,
    ClienteLLM,
    ErroDeLLM,
)

SCHEMA = {
    "type": "object",
    "properties": {"ok": {"type": "boolean"}},
    "required": ["ok"],
    "additionalProperties": False,
}


class ClienteFake:
    """Um cliente que não é subclasse de nada — é o Protocol que decide."""

    def __init__(self, resposta: dict) -> None:
        self.resposta = resposta
        self.chamadas: list[dict] = []

    def responder_json(
        self,
        *,
        system: str,
        blocos: Sequence[Bloco],
        schema: dict,
        nome_schema: str,
        max_tokens: int = 8000,
    ) -> dict:
        self.chamadas.append({"system": system, "blocos": list(blocos), "schema": schema})
        return self.resposta


class TestProtocolo:
    def test_implementacao_estrutural_satisfaz_o_protocol(self):
        # Sem herança: quem tiver o método certo é um ClienteLLM. É o que
        # permite trocar de provedor sem tocar em quem usa.
        assert isinstance(ClienteFake({"ok": True}), ClienteLLM)

    def test_objeto_sem_o_metodo_nao_satisfaz(self):
        assert not isinstance(object(), ClienteLLM)


class TestAdaptadorOpenAI:
    def _cliente(self):
        from llm.openai_cliente import ClienteOpenAI

        return ClienteOpenAI(modelo="modelo-de-teste")

    def test_texto_vira_input_text(self):
        traduzido = self._cliente()._traduzir(BlocoTexto(texto="oi"))
        assert traduzido == {"type": "input_text", "text": "oi"}

    def test_pdf_vira_input_file_em_data_uri(self):
        traduzido = self._cliente()._traduzir(
            BlocoDocumento(dados=b"%PDF-1.4", mime_type="application/pdf", nome="c.pdf")
        )
        assert traduzido["type"] == "input_file"
        assert traduzido["filename"] == "c.pdf"
        # Data URI em vez de URL: o arquivo não é hospedado em lugar nenhum.
        esperado = base64.standard_b64encode(b"%PDF-1.4").decode()
        assert traduzido["file_data"] == f"data:application/pdf;base64,{esperado}"

    def test_imagem_vira_input_image(self):
        traduzido = self._cliente()._traduzir(BlocoImagem(dados=b"\x89PNG", mime_type="image/png"))
        assert traduzido["type"] == "input_image"
        assert traduzido["image_url"].startswith("data:image/png;base64,")

    def test_sem_chave_a_mensagem_e_para_o_usuario(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        with pytest.raises(ErroDeLLM) as erro:
            self._cliente().responder_json(
                system="s", blocos=[BlocoTexto(texto="x")], schema=SCHEMA, nome_schema="t"
            )
        # pt-BR, sem jargão e sem nome de provedor ou de variável de ambiente.
        assert "não está configurado" in str(erro.value)
        assert "OPENAI" not in str(erro.value)

    def test_erro_de_conexao_nao_vaza_excecao_do_sdk(self, monkeypatch):
        import openai

        monkeypatch.setenv("OPENAI_API_KEY", "chave-de-teste")

        class ClienteQueFalha:
            def __init__(self, *a, **k):
                self.responses = self

            def create(self, **kwargs):
                raise openai.APIConnectionError(request=None)  # type: ignore[arg-type]

        monkeypatch.setattr(openai, "OpenAI", ClienteQueFalha)

        with pytest.raises(ErroDeLLM):
            self._cliente().responder_json(
                system="s", blocos=[BlocoTexto(texto="x")], schema=SCHEMA, nome_schema="t"
            )

    def test_json_invalido_vira_erro_de_llm(self, monkeypatch):
        import openai

        monkeypatch.setenv("OPENAI_API_KEY", "chave-de-teste")

        class Resposta:
            output_text = "isto não é json"

        class ClienteOk:
            def __init__(self, *a, **k):
                self.responses = self

            def create(self, **kwargs):
                return Resposta()

        monkeypatch.setattr(openai, "OpenAI", ClienteOk)

        with pytest.raises(ErroDeLLM) as erro:
            self._cliente().responder_json(
                system="s", blocos=[BlocoTexto(texto="x")], schema=SCHEMA, nome_schema="t"
            )
        assert "interpretar" in str(erro.value)

    def test_resposta_valida_volta_como_dict(self, monkeypatch):
        import openai

        monkeypatch.setenv("OPENAI_API_KEY", "chave-de-teste")
        recebido: dict = {}

        class Resposta:
            output_text = json.dumps({"ok": True})

        class ClienteOk:
            def __init__(self, *a, **k):
                self.responses = self

            def create(self, **kwargs):
                recebido.update(kwargs)
                return Resposta()

        monkeypatch.setattr(openai, "OpenAI", ClienteOk)

        saida = self._cliente().responder_json(
            system="regras", blocos=[BlocoTexto(texto="x")], schema=SCHEMA, nome_schema="teste"
        )
        assert saida == {"ok": True}
        # Schema ESTRITO: é o que impede o modelo de devolver campo livre.
        assert recebido["text"]["format"]["strict"] is True
        assert recebido["text"]["format"]["schema"] == SCHEMA
        assert recebido["instructions"] == "regras"


class TestAdaptadorAnthropic:
    def _cliente(self):
        from llm.anthropic_cliente import ClienteAnthropic

        return ClienteAnthropic(modelo="modelo-de-teste")

    def test_pdf_vira_bloco_document(self):
        traduzido = self._cliente()._traduzir(
            BlocoDocumento(dados=b"%PDF-1.4", mime_type="application/pdf")
        )
        assert traduzido["type"] == "document"
        assert traduzido["source"]["type"] == "base64"

    def test_sem_chave_a_mensagem_e_a_mesma_do_outro_provedor(self, monkeypatch):
        # A frase que o usuário lê não pode mudar conforme o provedor
        # configurado — ele não sabe que existe provedor.
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        with pytest.raises(ErroDeLLM) as erro:
            self._cliente().responder_json(
                system="s", blocos=[BlocoTexto(texto="x")], schema=SCHEMA, nome_schema="t"
            )
        assert "não está configurado" in str(erro.value)


class TestFabrica:
    def test_provedor_desconhecido_estoura_erro_de_llm(self, monkeypatch):
        import config
        import llm

        monkeypatch.setenv("BUDDY_LLM_PROVIDER", "inexistente")
        config.get_settings.cache_clear()
        try:
            with pytest.raises(ErroDeLLM):
                llm.obter_cliente("modelo")
        finally:
            config.get_settings.cache_clear()

    def test_devolve_o_adaptador_do_provedor_configurado(self, monkeypatch):
        import config
        import llm
        from llm.anthropic_cliente import ClienteAnthropic

        monkeypatch.setenv("BUDDY_LLM_PROVIDER", "anthropic")
        config.get_settings.cache_clear()
        try:
            cliente = llm.obter_cliente("modelo-x")
            assert isinstance(cliente, ClienteAnthropic)
            assert cliente.modelo == "modelo-x"
        finally:
            config.get_settings.cache_clear()
