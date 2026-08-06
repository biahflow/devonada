import base64
import json
import os
from collections.abc import Sequence
from typing import Any

import anthropic

from llm.base import Bloco, BlocoDocumento, BlocoImagem, BlocoTexto, ErroDeLLM


class ClienteAnthropic:
    """
    Adaptador do Claude. Herda o que já funcionava no extrator de contrato antes
    de a camada existir.

    Vive no repositório como segunda implementação — é ela que prova que a
    fronteira do `ClienteLLM` é real, e não uma interface desenhada em volta de
    um provedor só.
    """

    def __init__(self, modelo: str, api_key: str | None = None) -> None:
        self.modelo = modelo
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY") or ""

    def _traduzir(self, bloco: Bloco) -> dict[str, Any]:
        if isinstance(bloco, BlocoTexto):
            return {"type": "text", "text": bloco.texto}

        dados = base64.standard_b64encode(bloco.dados).decode()

        if isinstance(bloco, BlocoImagem):
            return {
                "type": "image",
                "source": {"type": "base64", "media_type": bloco.mime_type, "data": dados},
            }

        return {
            "type": "document",
            "source": {"type": "base64", "media_type": bloco.mime_type, "data": dados},
        }

    def responder_json(
        self,
        *,
        system: str,
        blocos: Sequence[Bloco],
        schema: dict,
        nome_schema: str,
        max_tokens: int = 8000,
    ) -> dict:
        if not self.api_key:
            raise ErroDeLLM(
                "Este recurso ainda não está configurado neste servidor. "
                "Você pode continuar usando o app normalmente."
            )

        cliente = anthropic.Anthropic(api_key=self.api_key)

        try:
            resposta = cliente.messages.create(
                model=self.modelo,
                max_tokens=max_tokens,
                system=system,
                thinking={"type": "adaptive"},
                output_config={
                    "effort": "high",
                    "format": {"type": "json_schema", "schema": schema},
                },
                messages=[{"role": "user", "content": [self._traduzir(b) for b in blocos]}],
            )
        except anthropic.APIConnectionError as e:
            raise ErroDeLLM("O servidor não conseguiu se conectar. Tente de novo.") from e
        except anthropic.APIStatusError as e:
            raise ErroDeLLM("Não deu certo agora. Tente de novo em instantes.") from e

        if resposta.stop_reason == "refusal":
            raise ErroDeLLM("O modelo recusou essa solicitação.")

        texto = next((b.text for b in resposta.content if b.type == "text"), None)
        if not texto:
            raise ErroDeLLM("A resposta voltou vazia. Tente de novo.")

        try:
            return json.loads(texto)
        except json.JSONDecodeError as e:
            raise ErroDeLLM("Não consegui interpretar a resposta do modelo.") from e
