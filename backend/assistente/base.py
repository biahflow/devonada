from dataclasses import dataclass, field, fields
from typing import Literal, Protocol, runtime_checkable

"""
O assistente do chat.

O chat é, por escrito, a superfície mais perigosa do produto (guardrails.md,
seção 7): texto livre parece autoridade. Por isso a regra que organiza este
pacote inteiro:

    O ASSISTENTE ESCOLHE QUAL CARD MOSTRAR. O BACKEND PREENCHE OS NÚMEROS.

Um `PedidoDeCard` carrega um id e, no máximo, parâmetros de entrada que o
usuário já forneceu. Quem preenche saldo, prazo e juros é `routers/chat.py`,
lendo o banco.

A ÚNICA EXCEÇÃO, e o motivo dela. `PropostaDeDivida` tem campo para valor —
porque é rascunho do que a PESSOA disse na conversa, devolvido a ela para
conferência (guardrail 7.2). Não é número apurado pelo modelo, não é exibido
como fato, e não chega ao banco: ele preenche um formulário que só grava
quando o dedo dela toca em salvar. Mesmo precedente do `aporte_extra_mensal`
abaixo. Todo o resto continua valendo: o que o modelo afirma como fato não
tem campo onde caber.
"""

TipoDeCard = Literal["divida_resumo", "plano_sugerido", "divida_proposta", "valor_justo"]


@dataclass(frozen=True)
class DividaDoContexto:
    """O que o assistente sabe de uma dívida. Sem ORM: o pacote é puro."""

    divida_id: str
    credor: str
    tipo: str
    situacao: str


@dataclass(frozen=True)
class ContextoDoUsuario:
    """
    Carregado pela rota, do banco, a cada mensagem.

    Não inclui valores: o assistente não precisa deles para decidir qual card
    mostrar, e o que ele não recebe, ele não repete errado.
    """

    dividas: list[DividaDoContexto] = field(default_factory=list)
    tem_renda_informada: bool = False


@dataclass(frozen=True)
class PropostaDeDivida:
    """
    Rascunho de cadastro, montado com o que a pessoa disse na conversa.

    TODO campo é opcional, e ausente significa "ela não disse" — nunca zero.
    O que o modelo não ouviu, ele não preenche: o formulário abre com o campo
    vazio, e ela completa. Deduzir aqui seria inventar dado financeiro em nome
    de alguém.
    """

    credor: str | None = None
    # Em centavos, como todo dinheiro do repositório.
    valor_cobrado: int | None = None
    data_origem: str | None = None
    tipo: str | None = None
    # Basis points inteiros: 250 = 2,50% a.m.
    taxa_juros_mensal: int | None = None
    total_parcelas: int | None = None
    primeiro_vencimento: str | None = None

    def vazia(self) -> bool:
        return all(getattr(self, campo.name) is None for campo in fields(self))


@dataclass(frozen=True)
class PedidoDeCard:
    tipo: TipoDeCard
    divida_id: str | None = None
    # Único número que atravessa: o aporte que o próprio usuário disse na
    # conversa, em centavos. Ele não é exibido como fato — é entrada da
    # simulação, que o backend roda.
    aporte_extra_mensal: int | None = None
    # Só em `divida_proposta`. Ver o cabeçalho do módulo: rascunho da fala da
    # pessoa, não afirmação do modelo.
    proposta: "PropostaDeDivida | None" = None


@dataclass(frozen=True)
class RespostaAssistente:
    content: str
    cards: list[PedidoDeCard] = field(default_factory=list)


class ErroDeAssistente(Exception):
    """
    Falha que o USUÁRIO precisa entender. pt-BR, para leigo, sem dado sensível
    e sem detalhe técnico (guardrail 5).
    """


@runtime_checkable
class Assistente(Protocol):
    def responder(
        self,
        mensagem: str,
        contexto: ContextoDoUsuario,
        historico: list[tuple[str, str]],
    ) -> RespostaAssistente: ...
