import base64
import json
import os
from collections.abc import Sequence
from typing import Any

import openai

from llm.base import Bloco, BlocoDocumento, BlocoImagem, BlocoTexto, ErroDeLLM


class ClienteOpenAI:
    """
    Adaptador da Responses API.

    Traduz os blocos neutros para `input_text` / `input_image` / `input_file` e
    devolve JSON já validado pelo provedor contra o schema estrito. Toda falha
    vira `ErroDeLLM` com frase em pt-BR — é esta classe que impede um
    `openai.APIStatusError` de chegar à rota.
    """

    def __init__(self, modelo: str, api_key: str | None = None) -> None:
        self.modelo = modelo
        # A chave vem da fábrica, que a lê do settings (e portanto do .env).
        # `None` cai no ambiente do processo, que é como o SDK se vira sozinho.
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY") or ""

    def _traduzir(self, bloco: Bloco) -> dict[str, Any]:
        if isinstance(bloco, BlocoTexto):
            return {"type": "input_text", "text": bloco.texto}

        dados = base64.standard_b64encode(bloco.dados).decode()

        if isinstance(bloco, BlocoImagem):
            # A Responses API aceita data URI no lugar de uma URL remota, então
            # a imagem não precisa ser hospedada em lugar nenhum (ADR 0005).
            return {
                "type": "input_image",
                "detail": "auto",
                "image_url": f"data:{bloco.mime_type};base64,{dados}",
            }

        return {
            "type": "input_file",
            "filename": bloco.nome,
            "file_data": f"data:{bloco.mime_type};base64,{dados}",
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

        cliente = openai.OpenAI(api_key=self.api_key)

        try:
            resposta = cliente.responses.create(
                model=self.modelo,
                instructions=system,
                max_output_tokens=max_tokens,
                input=[{"role": "user", "content": [self._traduzir(b) for b in blocos]}],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": nome_schema,
                        "schema": schema,
                        "strict": True,
                    }
                },
            )
        except openai.APIConnectionError as e:
            raise ErroDeLLM("O servidor não conseguiu se conectar. Tente de novo.") from e
        except openai.APIStatusError as e:
            raise ErroDeLLM("Não deu certo agora. Tente de novo em instantes.") from e

        texto = (resposta.output_text or "").strip()
        if not texto:
            # Acontece quando o modelo recusa ou o teto de tokens corta a saída.
            raise ErroDeLLM("A resposta voltou vazia. Tente de novo.")

        try:
            return json.loads(texto)
        except json.JSONDecodeError as e:
            raise ErroDeLLM("Não consegui interpretar a resposta do modelo.") from e
