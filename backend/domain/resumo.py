from collections.abc import Sequence
from decimal import Decimal

from domain.dinheiro import DEZ_MIL, decimal_para_bps

"""
Agregados do painel.

Tudo aqui existe porque o cliente NÃO pode calcular (ADR 0003). Se o front
precisar somar algo para exibir, é sinal de que uma função deste módulo está
faltando.
"""


class ParcelaEstimada:
    """Wrapper mínimo para o cálculo de comprometimento — evita depender do ORM."""

    __slots__ = ("valor_cobrado", "total_parcelas", "taxa_juros_mensal", "saldo")

    def __init__(
        self,
        valor_cobrado: int,
        total_parcelas: int | None,
        taxa_juros_mensal: int | None,
        saldo: int,
    ) -> None:
        self.valor_cobrado = valor_cobrado
        self.total_parcelas = total_parcelas
        self.taxa_juros_mensal = taxa_juros_mensal
        self.saldo = saldo


def custo_medio_juros_mensal(itens: Sequence[ParcelaEstimada]) -> int | None:
    """
    Média das taxas PONDERADA PELO SALDO, em basis points.

    Ponderar pelo saldo e não pela contagem porque uma dívida de R$ 50 a 15% ao
    mês pesa menos no bolso do que uma de R$ 50.000 a 2% — a média aritmética
    diria o contrário e daria a prioridade errada ao usuário.

    Dívida sem taxa conhecida é IGNORADA, não tratada como zero: incluí-la como
    0% puxaria a média para baixo e faria o endividamento parecer mais barato do
    que é. Devolve None quando nenhuma dívida tem taxa.
    """
    com_taxa = [i for i in itens if i.taxa_juros_mensal is not None and i.saldo > 0]
    if not com_taxa:
        return None

    peso_total = sum(i.saldo for i in com_taxa)
    if peso_total <= 0:
        return None

    soma = sum(Decimal(i.taxa_juros_mensal or 0) * Decimal(i.saldo) for i in com_taxa)
    return decimal_para_bps(soma / Decimal(peso_total) / DEZ_MIL)


def comprometimento_mensal(itens: Sequence[ParcelaEstimada]) -> int:
    """
    Quanto sai por mês para pagar dívida, em centavos.

    APROXIMAÇÃO DECLARADA: enquanto não existir a tabela de parcelas (Bloco 5),
    estimamos a prestação como `valorCobrado / totalParcelas`. Dívida sem
    `totalParcelas` é ignorada — chutar um prazo produziria um comprometimento
    de renda inventado, que é justamente o número que o usuário levaria a sério.

    Quando as parcelas existirem, esta função passa a somar as parcelas reais e
    a aproximação sai.
    """
    total = 0
    for item in itens:
        if item.total_parcelas and item.total_parcelas > 0:
            total += item.valor_cobrado // item.total_parcelas
    return total


def comprometimento_renda_bps(comprometido_mensal: int, renda_mensal: int) -> int | None:
    """Proporção da renda comprometida, em basis points. None sem renda."""
    if renda_mensal <= 0:
        return None
    return decimal_para_bps(Decimal(comprometido_mensal) / Decimal(renda_mensal))
