from dataclasses import dataclass, field
from typing import Literal, Protocol, runtime_checkable

"""
O assistente do chat.

O chat é, por escrito, a superfície mais perigosa do produto (guardrails.md,
seção 7): texto livre parece autoridade. Por isso a regra que organiza este
pacote inteiro:

    O ASSISTENTE ESCOLHE QUAL CARD MOSTRAR. O BACKEND PREENCHE OS NÚMEROS.

Um `PedidoDeCard` carrega um id e, no máximo, um parâmetro de entrada que o
usuário já forneceu. Não existe campo para valor monetário em lugar nenhum
desta estrutura — não por confiança no modelo, mas porque o tipo não permite.
Quem preenche saldo, prazo e juros é `routers/chat.py`, lendo o banco.
"""

TipoDeCard = Literal["divida_resumo", "plano_sugerido"]


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
class PedidoDeCard:
    tipo: TipoDeCard
    divida_id: str | None = None
    # Único número que atravessa: o aporte que o próprio usuário disse na
    # conversa, em centavos. Ele não é exibido como fato — é entrada da
    # simulação, que o backend roda.
    aporte_extra_mensal: int | None = None


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
