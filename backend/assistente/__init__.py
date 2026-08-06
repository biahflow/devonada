from assistente.base import (
    Assistente,
    ContextoDoUsuario,
    DividaDoContexto,
    ErroDeAssistente,
    PedidoDeCard,
    PropostaDeDivida,
    RespostaAssistente,
)
from config import get_settings

__all__ = [
    "Assistente",
    "ContextoDoUsuario",
    "DividaDoContexto",
    "ErroDeAssistente",
    "PedidoDeCard",
    "PropostaDeDivida",
    "RespostaAssistente",
    "obter_assistente",
]


def obter_assistente() -> Assistente:
    """
    Escolhe a implementação por `BUDDY_ASSISTENTE`.

    `llm` serve a qualquer provedor — quem escolhe o provedor é
    `BUDDY_LLM_PROVIDER`, e este módulo não sabe qual é.
    """
    nome = get_settings().assistente

    if nome == "llm":
        from assistente.assistente_llm import AssistenteLLM
        from llm import obter_cliente

        return AssistenteLLM(cliente=obter_cliente(get_settings().llm_model_assistente))

    if nome == "determinista":
        from assistente.determinista import AssistenteDeterminista

        return AssistenteDeterminista()

    raise ErroDeAssistente(f"Assistente '{nome}' não existe neste servidor.")
