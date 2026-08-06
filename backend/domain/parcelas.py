import calendar
from dataclasses import dataclass
from datetime import date

"""
Cronograma de parcelas.

Duas regras aqui existem porque a alternativa produz número errado na tela do
usuário, não porque são elegantes.
"""

MAX_PARCELAS = 480  # 40 anos. Além disso é erro de digitação, não financiamento.


@dataclass(frozen=True)
class ParcelaGerada:
    numero: int
    total: int
    valor: int
    vencimento: date


def somar_meses(inicio: date, meses: int) -> date:
    """
    Avança N meses preservando o dia.

    Dia 31 em mês de 30 cai no ÚLTIMO DIA do mês, não pula para o mês seguinte.
    A alternativa ingênua (`replace(month=...)`) estoura ValueError; somar 30
    dias faria o vencimento derivar alguns dias por ano.
    """
    total = inicio.month - 1 + meses
    ano = inicio.year + total // 12
    mes = total % 12 + 1
    dia = min(inicio.day, calendar.monthrange(ano, mes)[1])
    return date(ano, mes, dia)


def gerar_cronograma(
    valor_total: int, total_parcelas: int, primeiro_vencimento: date
) -> list[ParcelaGerada]:
    """
    Divide o valor em parcelas mensais.

    A SOBRA VAI NA ÚLTIMA PARCELA. R$ 1.500,00 em 7 não divide exato: seis
    parcelas de R$ 214,28 e uma de R$ 214,32, somando exatamente R$ 1.500,00.

    Arredondar cada parcela isoladamente produziria um total que não bate com a
    dívida — e a diferença apareceria como centavos fantasma no painel, que é
    justamente o tipo de divergência que destrói a confiança no app.
    """
    if total_parcelas < 1:
        raise ValueError("total_parcelas precisa ser pelo menos 1")
    if total_parcelas > MAX_PARCELAS:
        raise ValueError(f"total_parcelas acima do teto de {MAX_PARCELAS}")
    if valor_total < 0:
        raise ValueError("valor_total não pode ser negativo")

    base = valor_total // total_parcelas
    sobra = valor_total - base * total_parcelas

    return [
        ParcelaGerada(
            numero=i + 1,
            total=total_parcelas,
            valor=base + (sobra if i == total_parcelas - 1 else 0),
            vencimento=somar_meses(primeiro_vencimento, i),
        )
        for i in range(total_parcelas)
    ]


def situacao_da_parcela(
    vencimento: date, paga_em: date | None, hoje: date | None = None
) -> str:
    """
    `pendente` | `paga` | `atrasada`.

    DERIVADA NO SERVIDOR, sempre. Se o cliente comparasse datas, o fuso do
    aparelho decidiria o que está atrasado — e um usuário viajando veria uma
    parcela mudar de situação sozinha.

    Parcela paga NUNCA vira atrasada, mesmo que tenha sido paga depois do
    vencimento: quem quitou já resolveu, e insistir no alarme é castigo.
    """
    if paga_em is not None:
        return "paga"
    referencia = hoje or date.today()
    return "atrasada" if vencimento < referencia else "pendente"
