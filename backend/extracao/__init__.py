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

    O import da implementação é preguiçoso de propósito: o SDK da Anthropic só
    é carregado quando o extrator dele é realmente usado, então os testes e as
    demais rotas não pagam por ele.
    """
    nome = get_settings().extrator

    if nome == "anthropic":
        from extracao.anthropic_extrator import ExtratorAnthropic

        return ExtratorAnthropic(modelo=get_settings().llm_model)

    raise ErroDeExtracao(f"Extrator '{nome}' não existe neste servidor.")
