from config import get_settings
from extracao.base import (
    ArquivoContrato,
    ErroDeExtracao,
    ExtratorDeContrato,
    ResultadoExtracao,
    limpar_campos_sem_evidencia,
)

__all__ = [
    "ArquivoContrato",
    "ErroDeExtracao",
    "ExtratorDeContrato",
    "ResultadoExtracao",
    "limpar_campos_sem_evidencia",
    "obter_extrator",
]


def obter_extrator() -> ExtratorDeContrato:
    """
    Escolhe a implementação por `BUDDY_EXTRATOR`.

    Hoje só existe `llm`, que serve a qualquer provedor — quem escolhe o
    provedor é `BUDDY_LLM_PROVIDER`, e este módulo não sabe qual é. O `extrator`
    continua sendo uma opção porque a porta faz sentido: um extrator
    determinístico para o layout de contrato de um banco específico seria mais
    exato que qualquer modelo, e entraria aqui sem tocar a rota.

    O import é preguiçoso: nenhum SDK é carregado por quem não extrai contrato.
    """
    nome = get_settings().extrator

    if nome == "llm":
        from llm import obter_cliente
        from extracao.extrator_llm import ExtratorLLM

        return ExtratorLLM(cliente=obter_cliente(get_settings().llm_model_extracao))

    raise ErroDeExtracao(f"Extrator '{nome}' não existe neste servidor.")
