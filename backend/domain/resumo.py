from collections.abc import Sequence
from decimal import Decimal

from domain.dinheiro import (
    DEZ_MIL,
    bps_para_decimal,
    centavos_para_decimal,
    decimal_para_bps,
    decimal_para_centavos,
)

"""
Agregados do painel.

Tudo aqui existe porque o cliente NÃO pode calcular (ADR 0003). Se o front
precisar somar algo para exibir, é sinal de que uma função deste módulo está
faltando.
"""

# Mês comercial. NÃO vem de lei nenhuma — é escolha de método, e `custo_diario_juros`
# declara no docstring por que ela é aceitável e o que ela custa.
DIAS_DO_MES_COMERCIAL = Decimal(30)


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


def custo_diario_juros(itens: Sequence[ParcelaEstimada]) -> int | None:
    """
    Quanto o endividamento cresce POR DIA, em centavos. None sem taxa nenhuma.

    NÃO EXISTE FONTE LEGAL AQUI, e não deveria existir: nenhuma lei fixa um
    custo diário. O que existe é a taxa MENSAL do contrato do próprio usuário, e
    este número é uma decomposição dela. As três escolhas abaixo são de MÉTODO —
    nossas, não do contrato dele e não da lei — e ficam declaradas para que
    ninguém as leia como regra financeira do usuário, no mesmo regime de
    `domain/simulacao.py`.

    1. DIVISOR 30, MÊS COMERCIAL, E DIVISÃO SIMPLES. O contrato fixa juro
       mensal; dividi-lo por 30 é decomposição, não regra nova. Mas o 30 é
       ESCOLHA: 31, 28 ou 30,44 (a média do ano) dariam outro número, e a taxa
       diária EQUIVALENTE composta — (1+i)^(1/30) − 1 — daria um número menor
       ainda. O resultado é ORDEM DE GRANDEZA, para a pessoa sentir o tamanho do
       que corre enquanto ela decide. Não é valor exigível, não é o que o credor
       cobra por um dia de atraso, e não deve ser levado a uma negociação como
       se fosse.

    2. BASE = O MESMO `saldo` QUE `custo_medio_juros_mensal` LÊ, que a rota do
       resumo hoje preenche com `valor_cobrado`. Ler o mesmo atributo que a
       função gêmea lê é o que impede o mesmo payload de sair com dois números
       de juros sobre bases diferentes, e é o que impede uma TERCEIRA derivação
       de saldo de nascer ao lado das duas que o backend já tem
       (`routers/dividas.py` e `leitura.py`).

    3. AGREGADO, NÃO POR DÍVIDA. O campo vive no resumo e soma as ativas COM
       taxa conhecida. Dívida sem taxa é IGNORADA, nunca tratada como zero:
       tratá-la como 0% afirmaria que ela não cresce. O preço é que o agregado
       SUBESTIMA quando falta taxa — e por isso ele não viaja sozinho.
       `dividas_sem_taxa` conta quantas ficaram de fora, a rota manda a contagem
       junto e a tela só diz a frase sabendo se o número é total ou piso. É a
       mesma disciplina do M4, que nomeia a dívida sem taxa em vez de esconder
       que o prazo saiu otimista.

    A soma corre inteira em `Decimal` e só vira centavo no fim, como o motor da
    simulação: arredondar dívida a dívida somaria dez erros de meio centavo
    antes de o número chegar à tela.

    ZERO É RESPOSTA POSSÍVEL E VERDADEIRA — taxa zero informada, ou juros que
    não chegam a um centavo por dia. É diferente de None, que continua
    significando "não há taxa nenhuma para calcular". Quem exibe decide se uma
    frase sobre R$ 0,00 por dia diz alguma coisa; aqui, mentir não é opção nem
    para cima nem para baixo.
    """
    com_taxa = [i for i in itens if i.taxa_juros_mensal is not None and i.saldo > 0]
    if not com_taxa:
        return None

    soma = sum(
        centavos_para_decimal(i.saldo) * bps_para_decimal(i.taxa_juros_mensal or 0)
        for i in com_taxa
    )
    return decimal_para_centavos(Decimal(soma) / DIAS_DO_MES_COMERCIAL)


def dividas_sem_taxa(itens: Sequence[ParcelaEstimada]) -> int:
    """
    Quantas das dívidas recebidas estão sem taxa conhecida.

    Companheiro OBRIGATÓRIO de `custo_diario_juros`: ele soma só as que têm
    taxa, então esta contagem é o tamanho do que ficou de fora. Maior que zero
    ⇒ o custo diário é PISO, não total, e a tela precisa dizer isso.

    Contagem, e não a lista de credores como em `RespostaSimulacao`: o resumo é
    agregado, e quem quer os nomes já tem a lista de dívidas.
    """
    return sum(1 for i in itens if i.taxa_juros_mensal is None)


def comprometimento_mensal(
    itens: Sequence[ParcelaEstimada], parcelas_do_mes: Sequence[int] | None = None
) -> int:
    """
    Quanto sai por mês para pagar dívida, em centavos.

    Quando há PARCELAS REAIS (M3), soma-as — é o número verdadeiro. A
    aproximação `valorCobrado / totalParcelas` fica só para dívida cadastrada
    sem cronograma, e dívida sem nenhum dos dois continua ignorada: chutar
    prazo produziria justamente o número que o usuário leva a sério.

    `parcelas_do_mes` são os valores das parcelas pendentes que vencem no mês
    consultado.
    """
    if parcelas_do_mes:
        return sum(parcelas_do_mes)

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


def rota_percorrida_bps(saldo_inicial: int | None, total_devido: int) -> int | None:
    """
    Quanto da rota de quitação já foi percorrido, em basis points, com piso em zero.

    ESCOLHA DE MÉTODO, não regra de lei: `saldo_inicial` é o MAIOR saldo já
    registrado em `saldo_snapshot` para o tenant — não o primeiro ponto da série
    que `evolucaoSaldo` exibe (ADR 0019, item 4). A série de exibição é
    recortada pelo mês selecionado e pelos últimos 12 pontos (docs/api-contract.md
    3.13); usar o mesmo recorte aqui faria a linha de base andar para trás
    quando o usuário troca o mês consultado — o defeito que esta função existe
    para corrigir. É a mesma disciplina de `custo_diario_juros`: a escolha é
    nossa, e fica declarada para não ser lida como regra financeira do usuário.

    None SEM HISTÓRICO (`saldo_inicial` ausente ou zero): "0% percorrido" no
    primeiro dia seria desanimador e falso — a pessoa não deixou de andar, ela
    acabou de chegar. Quem decide o que conta como histórico é o chamador, e a
    régua dele é MÊS ANTERIOR, não "existe linha na tabela": a foto do mês
    corrente é reescrita a cada leitura, e tratá-la como histórico faria a
    segunda leitura do dia devolver 0% a quem acabou de cadastrar a primeira
    dívida.

    NUNCA NEGATIVO: cadastrar uma dívida nova pode fazer `total_devido` superar
    a base histórica — a rota não anda para trás, ela para em zero. Isso inclui
    a limitação conhecida e aceita (PF-3 do plano F-010): `saldo_snapshot` tem
    PK composta `(tenant_id, mes)` e o mês corrente é reescrito a cada leitura,
    então `MAX(saldo)` só é monotônico ENTRE meses, não dentro do mês corrente.
    A proteção real contra essa janela é o marco ser evento persistido (T4), não
    esta função.
    """
    if saldo_inicial is None or saldo_inicial <= 0:
        return None
    if total_devido >= saldo_inicial:
        return 0
    andado = Decimal(saldo_inicial - total_devido)
    return decimal_para_bps(andado / Decimal(saldo_inicial))
