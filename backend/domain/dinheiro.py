from decimal import ROUND_HALF_UP, Decimal

"""
Aritmética de dinheiro.

REGRA ABSOLUTA: `float` não entra em nenhum caminho de valor. Toda conta
intermediária é `Decimal`; a saída é `int` de centavos, arredondada com
ROUND_HALF_UP explícito.

Motivo: `0.1 + 0.2 == 0.30000000000000004`. Num produto sobre dívida, um
centavo de divergência entre o painel e o detalhe destrói a confiança no app
inteiro — e o número que exibimos vira argumento numa negociação real.
"""

CEM = Decimal(100)
DEZ_MIL = Decimal(10_000)


def centavos_para_decimal(centavos: int) -> Decimal:
    """Centavos inteiros → reais em Decimal. Exato, sem ponto flutuante."""
    return Decimal(centavos) / CEM


def decimal_para_centavos(valor: Decimal) -> int:
    """Reais em Decimal → centavos inteiros, meio para cima."""
    return int((valor * CEM).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def bps_para_decimal(bps: int) -> Decimal:
    """Basis points → fração decimal. 250 → 0.025 (2,50%)."""
    return Decimal(bps) / DEZ_MIL


def decimal_para_bps(fracao: Decimal) -> int:
    """Fração decimal → basis points inteiros. 0.025 → 250."""
    return int((fracao * DEZ_MIL).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def aplicar_percentual(centavos: int, bps: int) -> int:
    """Percentual de um valor, em centavos inteiros. 25% de R$ 100 → 2500."""
    return decimal_para_centavos(centavos_para_decimal(centavos) * bps_para_decimal(bps))
