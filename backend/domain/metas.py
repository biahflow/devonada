"""
Metas nomeadas: quanto separar por mês, e se o aporte declarado dá conta.

FONTE: nenhuma — e isto é declarado, não esquecido. Não existe lei nem norma que
diga quanto alguém deveria guardar por mês para trocar de carro, e este módulo
não finge que existe. O que ele faz é ARITMÉTICA SOBRE NÚMEROS QUE O USUÁRIO
INFORMOU: falta tanto, faltam tantos meses, então são tantos por mês. É o mesmo
método de `caixa.aporte_de_provisao`, que divide o que falta de um IPVA pelos
meses até janeiro.

A distinção importa porque é a linha que o CLAUDE.md desenha. Dividir o que a
pessoa disse que falta pelo prazo que ela mesma escolheu não é inventar regra
financeira: é a conta que ela faria no papel, e o resultado não é afirmação sobre
o mundo. Seria invenção afirmar quanto ela DEVERIA guardar, ou projetar
rendimento que ninguém informou — e nada aqui faz isso.

Sem prazo, não há sugestão. `aporte_sugerido` devolve None, `status` devolve None,
e a tela não mostra pill: dizer "aporte baixo" sem prazo seria opinião disfarçada
de cálculo.
"""

from dataclasses import dataclass
from decimal import ROUND_CEILING, Decimal
from typing import Literal

StatusMeta = Literal["em_dia", "aporte_baixo", "atingida"]


@dataclass(frozen=True)
class MetaPendente:
    """O que basta para a conta. Sem id, sem tenant, sem banco."""

    valor_alvo: int
    saldo: int
    data_alvo: str | None
    aporte_mensal: int | None


def meses_ate(data_alvo: str, mes_atual: str) -> int:
    """
    Quantos meses faltam entre dois `AAAA-MM`, no mínimo 1.

    Piso de 1 em vez de 0 porque o divisor não pode ser zero e porque prazo já
    vencido não vira "aporte infinito": vira "o que falta, este mês". Quem passou
    da data vê o valor cheio, que é a verdade da situação.
    """
    ano_i, m_i = int(mes_atual[:4]), int(mes_atual[5:7])
    ano_f, m_f = int(data_alvo[:4]), int(data_alvo[5:7])
    return max(1, (ano_f - ano_i) * 12 + (m_f - m_i))


def aporte_sugerido(meta: MetaPendente, mes_atual: str) -> int | None:
    """
    Quanto separar por mês para chegar no prazo, em centavos.

    `None` sem `data_alvo`: sem prazo não há divisor, e inventar um ("dois anos,
    vai") seria produzir número que a pessoa levaria a sério.

    Zero quando a meta já está atingida — nunca negativo. Guardado além do alvo
    não é dívida com o futuro.

    ARREDONDA PARA CIMA, como `caixa.aporte_de_provisao`: o centavo a mais por mês
    é irrelevante, e o centavo a menos multiplicado pelos meses faz a meta não
    fechar na data — que é a única coisa que a meta precisa fazer.
    """
    if meta.data_alvo is None:
        return None

    falta = meta.valor_alvo - meta.saldo
    if falta <= 0:
        return 0

    por_mes = Decimal(falta) / Decimal(meses_ate(meta.data_alvo, mes_atual))
    return int(por_mes.quantize(Decimal(1), rounding=ROUND_CEILING))


def status(meta: MetaPendente, mes_atual: str) -> StatusMeta | None:
    """
    A pill da tela: `atingida`, `em_dia`, `aporte_baixo` — ou nada.

    `None` quando falta prazo OU falta aporte declarado. As duas ausências têm o
    mesmo efeito por motivos diferentes: sem prazo não há sugestão para comparar,
    e sem aporte declarado não há o que comparar com a sugestão. Em nenhum dos
    dois casos o app tem base para dizer que a pessoa está atrasada, então ele
    não diz.

    `atingida` vem antes de tudo e não depende de aporte: meta cumprida é meta
    cumprida, mesmo que a pessoa nunca tenha declarado quanto separava.
    """
    if meta.saldo >= meta.valor_alvo:
        return "atingida"

    sugerido = aporte_sugerido(meta, mes_atual)
    if sugerido is None or meta.aporte_mensal is None:
        return None

    return "em_dia" if meta.aporte_mensal >= sugerido else "aporte_baixo"
