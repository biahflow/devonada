from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

"""
Camada de provedor de LLM.

Este pacote é a ÚNICA parte do backend que conhece um SDK de modelo. Quem usa
LLM — extração de contrato, assistente do chat — fala com o `ClienteLLM` e não
sabe qual provedor está do outro lado.

A abstração é do PROVEDOR, não da capacidade. A alternativa (um extrator por
provedor, um assistente por provedor) multiplica: duas capacidades vezes N
provedores, com as regras de guardrail copiadas em cada arquivo — e divergindo
no primeiro ajuste. Aqui é duas capacidades MAIS N provedores, e cada regra
existe uma vez só.
"""


@dataclass(frozen=True)
class BlocoTexto:
    texto: str


@dataclass(frozen=True)
class BlocoImagem:
    """Foto de contrato. `dados` são bytes crus; o adaptador cuida do base64."""

    dados: bytes
    mime_type: str


@dataclass(frozen=True)
class BlocoDocumento:
    """PDF. Provedores com visão leem sem OCR separado — sem Tesseract no servidor."""

    dados: bytes
    mime_type: str
    nome: str = "documento.pdf"


Bloco = BlocoTexto | BlocoImagem | BlocoDocumento


class ErroDeLLM(Exception):
    """
    Falha que o USUÁRIO precisa entender.

    A mensagem chega à tela, então é pt-BR, para leigo, e nunca carrega trecho
    de contrato, valor, credor ou detalhe técnico (guardrail 5). Todo erro de
    SDK é convertido para cá dentro do adaptador: nenhuma exceção de provedor
    atravessa esta fronteira.
    """


@runtime_checkable
class ClienteLLM(Protocol):
    """
    Um método, e ele devolve JSON validado contra schema estrito.

    NÃO EXISTE "me dê texto livre" nesta interface, de propósito. As duas
    capacidades do produto precisam de saída estruturada, e uma porta de texto
    livre seria o caminho mais curto para um número sem procedência entrar no
    app (guardrail 1.3).

    O que também não entra aqui: `thinking`, `effort`, `temperature`. São
    dialeto de provedor e vivem dentro de cada adaptador — expô-los vazaria o
    provedor para quem usa.
    """

    def responder_json(
        self,
        *,
        system: str,
        blocos: Sequence[Bloco],
        schema: dict,
        nome_schema: str,
        max_tokens: int = 8000,
    ) -> dict: ...
