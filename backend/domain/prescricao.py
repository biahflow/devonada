from datetime import date

"""
Prescrição de dívida.

FONTE: Código Civil, art. 206, §5º, I — prescreve em CINCO ANOS a pretensão de
cobrança de dívidas líquidas constantes de instrumento público ou particular.

O resultado é um SINAL PARA INVESTIGAR, nunca uma afirmação de que prescreveu.
Prescrição real depende de interrupção, suspensão, reconhecimento da dívida e
da natureza do título — nada disso o app sabe. A copy do cliente já reflete
isso ("pode ter prescrito, vale checar"), e o backend não deve prometer mais.
"""

ANOS_PRESCRICAO = 5


def possivel_prescricao(data_origem: date, hoje: date | None = None) -> bool:
    """True quando já se passaram 5 anos completos da origem."""
    referencia = hoje or date.today()

    try:
        limite = data_origem.replace(year=data_origem.year + ANOS_PRESCRICAO)
    except ValueError:
        # 29 de fevereiro em ano não bissexto: cai para 28.
        limite = data_origem.replace(year=data_origem.year + ANOS_PRESCRICAO, day=28)

    return referencia > limite
