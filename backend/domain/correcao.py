from datetime import date
from decimal import Decimal

from domain.dinheiro import bps_para_decimal, centavos_para_decimal, decimal_para_centavos

"""
Correção do valor de uma dívida.

FONTE: a taxa de juros do PRÓPRIO CONTRATO do usuário. Não aplicamos IPCA,
INPC, selic ou qualquer índice — corrigir por índice que o contrato não prevê
seria inventar uma regra e apresentá-la como fato.

SEM TAXA, NÃO HÁ CORREÇÃO. A função devolve None, o campo sai como null, e o
app exibe "ainda não calculado". Isso substitui o `valorCobrado * 1.1` que
existia antes — um número inventado que não vinha de lugar nenhum e que o
usuário poderia levar para uma negociação real.
"""

TETO_MESES = 600  # 50 anos. Além disso, o dado de origem é provavelmente erro de digitação.


def meses_decorridos(data_origem: date, hoje: date | None = None) -> int:
    """Meses cheios entre a origem e hoje. Nunca negativo."""
    referencia = hoje or date.today()
    meses = (referencia.year - data_origem.year) * 12 + (referencia.month - data_origem.month)
    if referencia.day < data_origem.day:
        meses -= 1
    return max(0, meses)


def valor_corrigido(
    valor_cobrado: int,
    taxa_juros_mensal_bps: int | None,
    data_origem: date,
    hoje: date | None = None,
) -> int | None:
    """
    Juros compostos sobre o valor cobrado, pelos meses decorridos.

    Devolve None quando a taxa é desconhecida — ausência é ausência, não zero
    e não um multiplicador arbitrário.
    """
    if taxa_juros_mensal_bps is None or taxa_juros_mensal_bps <= 0:
        return None

    meses = min(meses_decorridos(data_origem, hoje), TETO_MESES)
    if meses == 0:
        return valor_cobrado

    fator = (Decimal(1) + bps_para_decimal(taxa_juros_mensal_bps)) ** meses
    return decimal_para_centavos(centavos_para_decimal(valor_cobrado) * fator)
