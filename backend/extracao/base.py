from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

import schemas


@dataclass
class ArquivoContrato:
    """O arquivo em memória. NUNCA é gravado em disco (ADR 0005)."""

    conteudo: bytes
    nome: str
    mime_type: str


@dataclass
class ResultadoExtracao:
    campos: schemas.CamposContrato
    alertas: list[schemas.AlertaContrato] = field(default_factory=list)


class ErroDeExtracao(Exception):
    """
    Falha que o USUÁRIO precisa entender. A mensagem vai direto para a tela,
    então é pt-BR, sem jargão e sem trecho do contrato (guardrail 5).
    """


@runtime_checkable
class ExtratorDeContrato(Protocol):
    """
    Contrato de qualquer implementação de extração.

    Existe para que trocar de provedor — ou plugar um extrator determinístico
    para um banco específico — não toque nas rotas. A rota conhece este
    Protocol; a fábrica escolhe a implementação por variável de ambiente.
    """

    def extrair(self, arquivo: ArquivoContrato) -> ResultadoExtracao: ...


def limpar_campos_sem_evidencia(campos: schemas.CamposContrato) -> schemas.CamposContrato:
    """
    Zera todo campo que tem valor mas não tem trecho literal do contrato.

    Guardrail 8.1, aplicado no SERVIDOR e não só no cliente: número sem
    evidência citável é palpite do modelo. O front já descartaria esses campos
    — mas mandá-los pela rede significaria que em algum momento existiu um
    número não comprovado circulando como dado.
    """
    limpos = campos.model_copy(deep=True)
    for nome in type(campos).model_fields:
        campo = getattr(limpos, nome)
        if campo.valor is not None and not campo.trecho:
            campo.valor = None
            campo.confianca = "baixa"
    return limpos
