from config import get_settings
from llm.base import (
    Bloco,
    BlocoDocumento,
    BlocoImagem,
    BlocoTexto,
    ClienteLLM,
    ErroDeLLM,
)

__all__ = [
    "Bloco",
    "BlocoDocumento",
    "BlocoImagem",
    "BlocoTexto",
    "ClienteLLM",
    "ErroDeLLM",
    "obter_cliente",
]


def obter_cliente(modelo: str) -> ClienteLLM:
    """
    Escolhe o adaptador por `DEVONADA_LLM_PROVIDER`.

    O MODELO É PARÂMETRO, não configuração global: ler um contrato (visão, PDF,
    evidência literal por campo) e classificar a intenção de uma frase são
    tarefas de dificuldade muito diferente. Amarrar as duas ao mesmo modelo
    forçaria pagar o mais caro nas duas ou arriscar o mais fraco na leitura de
    contrato.

    O import da implementação é preguiçoso: quem não usa LLM não paga o custo de
    carregar SDK nenhum.
    """
    settings = get_settings()
    provedor = settings.llm_provider

    if provedor == "openai":
        from llm.openai_cliente import ClienteOpenAI

        return ClienteOpenAI(modelo=modelo, api_key=settings.openai_api_key)

    if provedor == "anthropic":
        from llm.anthropic_cliente import ClienteAnthropic

        return ClienteAnthropic(modelo=modelo, api_key=settings.anthropic_api_key)

    raise ErroDeLLM(f"Provedor de modelo '{provedor}' não existe neste servidor.")
