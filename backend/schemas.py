from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

"""
Contrato de API. Espelha docs/api-contract.md e src/api/types.ts.

Os nomes de campo são camelCase de propósito: é o que o cliente TypeScript
espera, e traduzir na borda evita um mapeamento manual em toda rota.

UNIDADES, sem exceção: dinheiro em CENTAVOS inteiros, taxa e percentual em
BASIS POINTS inteiros (250 = 2,50%).
"""

CriticidadeTipo = Literal["essencial", "com_garantia", "juros_abusivos", "consumo"]
SituacaoDivida = Literal["ativa", "quitada", "renegociada"]
StatusExtracao = Literal["processando", "concluida", "falhou"]
Confianca = Literal["alta", "media", "baixa"]


class Camel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class NovaDivida(Camel):
    credor: str = Field(min_length=1, max_length=200)
    valorCobrado: int = Field(gt=0)
    dataOrigem: date
    tipo: CriticidadeTipo
    taxaJurosMensal: int | None = Field(default=None, ge=0)
    extracaoId: str | None = None


class PatchDivida(Camel):
    credor: str | None = Field(default=None, min_length=1, max_length=200)
    valorCobrado: int | None = Field(default=None, gt=0)
    dataOrigem: date | None = None
    tipo: CriticidadeTipo | None = None
    taxaJurosMensal: int | None = Field(default=None, ge=0)


class QuitacaoInput(Camel):
    dataQuitacao: date
    valorPago: int = Field(ge=0)


class Divida(Camel):
    id: str
    credor: str
    valorCobrado: int
    dataOrigem: date
    tipo: CriticidadeTipo

    # Ausente significa "não calculado", jamais zero. É o que o front exibe
    # como "ainda não calculado".
    valorCorrigido: int | None = None
    possivelPrescricao: bool | None = None

    situacao: SituacaoDivida = "ativa"
    saldoDevedor: int | None = None
    taxaJurosMensal: int | None = None
    totalParcelas: int | None = None
    parcelasPagas: int | None = None
    proximoVencimento: date | None = None


class ListaDividas(Camel):
    dividas: list[Divida]


class RespostaDivida(Camel):
    divida: Divida


class PerfilFinanceiro(Camel):
    rendaMensal: int | None = Field(default=None, ge=0)
    dependentes: int | None = Field(default=None, ge=0)


class RespostaPerfil(Camel):
    perfil: PerfilFinanceiro


class TotalPorCriticidade(Camel):
    tipo: CriticidadeTipo
    total: int
    quantidade: int


class VencimentoProximo(Camel):
    dividaId: str
    credor: str
    valor: int
    vencimento: date
    situacao: Literal["pendente", "paga", "atrasada"]


class PontoEvolucao(Camel):
    mes: str
    saldo: int


class ResumoDividas(Camel):
    totalDevido: int
    totalQuitadoNoAno: int
    quantidadeDividas: int
    custoMedioJurosMensal: int | None = None

    rendaMensal: int | None = None
    comprometimentoRenda: int | None = None
    minimoExistencial: int | None = None
    margemDisponivel: int | None = None

    porCriticidade: list[TotalPorCriticidade]
    proximosVencimentos: list[VencimentoProximo]
    evolucaoSaldo: list[PontoEvolucao]


class RespostaResumo(Camel):
    resumo: ResumoDividas


class CampoExtraido[T](Camel):
    """
    Todo campo extraído carrega a evidência que o sustenta.

    `valor` nulo significa "não encontrei". Campo com valor e SEM `trecho` é
    zerado antes de sair da rota (guardrail 8.1): número sem evidência citável
    é palpite do modelo, e o front o descartaria de qualquer forma.
    """

    valor: T | None = None
    confianca: Confianca = "baixa"
    trecho: str | None = None
    pagina: int | None = None


class CamposContrato(Camel):
    credor: CampoExtraido[str]
    valorCobrado: CampoExtraido[int]
    dataOrigem: CampoExtraido[date]
    tipo: CampoExtraido[CriticidadeTipo]
    taxaJurosMensal: CampoExtraido[int]
    totalParcelas: CampoExtraido[int]
    cet: CampoExtraido[int]


class AlertaContrato(Camel):
    id: str
    titulo: str
    explicacao: str
    trecho: str | None = None
    pagina: int | None = None


class ExtracaoContrato(Camel):
    id: str
    status: StatusExtracao
    erro: str | None = None
    campos: CamposContrato | None = None
    alertas: list[AlertaContrato] | None = None


class RespostaExtracao(Camel):
    extracao: ExtracaoContrato


class SendMessageRequest(Camel):
    content: str


class Erro(Camel):
    """
    Formato de erro que o cliente sabe ler. `message` é exibida DIRETO ao
    usuário (src/api/client.ts), então é pt-BR, para leigo, e nunca carrega
    valor, credor ou qualquer dado sensível.
    """

    message: str
    campo: str | None = None
