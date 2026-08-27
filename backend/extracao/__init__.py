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
    "TIPOS_DOCUMENTO",
    "limpar_campos_sem_evidencia",
    "modelo_de_campos",
    "obter_extrator",
]

# Os tipos de documento que a extração roteia. O router valida a entrada contra
# esta tupla; a fonte é o registro de `extracao.regras`, sem duplicar a lista.
TIPOS_DOCUMENTO: tuple[str, ...] = ("contrato", "boleto", "carta", "print")


def modelo_de_campos(tipo: str):
    """
    O modelo Pydantic que valida os campos daquele tipo de documento.

    A rota usa isto para DESERIALIZAR o `campos_json` gravado com o modelo certo
    antes de montar a resposta — passar um dict à união de `ExtracaoContrato`
    casaria com `CamposContrato` por engano. Tipo desconhecido (linha antiga sem
    coluna) cai em `contrato`, que é o `server_default` da migração.
    """
    from extracao.regras import REGRAS

    regra = REGRAS.get(tipo) or REGRAS["contrato"]
    return regra.modelo


def obter_extrator() -> ExtratorDeContrato:
    """
    Escolhe a implementação por `DEVONADA_EXTRATOR`.

    Hoje só existe `llm`, que serve a qualquer provedor — quem escolhe o
    provedor é `DEVONADA_LLM_PROVIDER`, e este módulo não sabe qual é. O `extrator`
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
