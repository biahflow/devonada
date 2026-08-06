from dataclasses import dataclass
from decimal import Decimal

from domain.dinheiro import bps_para_decimal, centavos_para_decimal, decimal_para_centavos

"""
Simulação de quitação: avalanche e bola de neve.

Este módulo é a razão de existir do ADR 0003. Rodar esta matemática no
aplicativo seria a tentação mais forte do produto inteiro, e o guardrail 1.2 a
proíbe pelo nome: duas implementações da mesma amortização divergem no
arredondamento, e o número divergente vira argumento numa negociação real.

ESCOLHAS DE MÉTODO, declaradas porque não vêm de lei nenhuma — vêm da definição
corrente das duas estratégias:

1. ORÇAMENTO CONSTANTE COM ROLAGEM. O usuário paga, todo mês, a soma das
   parcelas mínimas INICIAIS mais o aporte extra. Quando uma dívida quita, o
   mínimo que ela consumia não vira folga: rola para a próxima da fila. É o que
   define as duas estratégias — sem a rolagem, elas terminam quase no mesmo mês
   e a comparação não teria o que comparar.

2. DÍVIDA SEM TAXA CONHECIDA NÃO RECEBE JUROS PROJETADOS. O principal é
   amortizado normalmente, mas nenhum juro é inventado sobre ela, e na avalanche
   ela vai para o FIM da fila: taxa desconhecida não justifica prioridade. Quem
   consome esta função precisa avisar o usuário de quais dívidas entraram assim
   — a rota devolve a lista, e a tela a exibe.

3. A ORDEM É FIXADA PELO ESTADO INICIAL. Reordenar a cada mês faria a sugestão
   mudar de forma imprevisível para o usuário; e como a fila é sempre atacada
   pela frente, o resultado é o mesmo na esmagadora maioria dos casos.
"""

TETO_MESES = 600  # 50 anos. Além disso, o plano não quita — e isso é a informação.


@dataclass(frozen=True)
class DividaSimulavel:
    """
    Uma dívida como o motor a enxerga. Sem ORM de propósito: o motor é puro e
    testável sem banco.
    """

    divida_id: str
    credor: str
    saldo: int  # centavos
    taxa_mensal_bps: int | None  # None = taxa desconhecida
    parcela_minima: int  # centavos; 0 quando não há cronograma cadastrado


@dataclass(frozen=True)
class QuitacaoDeDivida:
    divida_id: str
    credor: str
    posicao: int
    quitada_em: str  # YYYY-MM
    juros_pagos: int


@dataclass(frozen=True)
class PontoDeSaldo:
    mes: str  # YYYY-MM
    saldo: int


@dataclass(frozen=True)
class ResultadoSimulacao:
    meses_ate_quitacao: int
    data_liberdade: str  # YYYY-MM
    total_juros_pagos: int
    total_pago: int
    ordem_pagamento: list[QuitacaoDeDivida]
    evolucao_saldo: list[PontoDeSaldo]


def _proximo_mes(mes: str) -> str:
    """`YYYY-MM` + 1. String em vez de date porque o mês é o que sai no contrato."""
    ano, m = int(mes[:4]), int(mes[5:7])
    return f"{ano + m // 12}-{m % 12 + 1:02d}"


def ordenar(dividas: list[DividaSimulavel], estrategia: str) -> list[DividaSimulavel]:
    """
    A fila de ataque.

    `avalanche`: maior taxa primeiro — matematicamente ótima, gera a maior
    economia de juros. Dívida SEM TAXA vai por último (regra 2 do cabeçalho);
    empate resolve pelo menor saldo, para a ordem ser determinística.

    `bola_de_neve`: menor saldo primeiro — pior no papel, melhor na prática para
    quem precisa ver uma dívida encerrar para não abandonar o plano
    (docs/domain.md, seção 4). Empate resolve pela maior taxa.
    """
    if estrategia == "avalanche":
        return sorted(
            dividas,
            key=lambda d: (
                d.taxa_mensal_bps is None,  # False (0) antes de True (1)
                -(d.taxa_mensal_bps or 0),
                d.saldo,
            ),
        )
    if estrategia == "bola_de_neve":
        return sorted(dividas, key=lambda d: (d.saldo, -(d.taxa_mensal_bps or 0)))
    raise ValueError(f"estratégia desconhecida: {estrategia}")


def simular(
    dividas: list[DividaSimulavel],
    aporte_extra_mensal: int,
    estrategia: str,
    mes_inicial: str,
) -> ResultadoSimulacao | None:
    """
    Amortiza mês a mês até zerar tudo.

    Devolve None quando o plano NÃO QUITA dentro do teto — pagamento menor que
    os juros do mês é um laço que nunca termina, e o chamador precisa dizer isso
    ao usuário em vez de exibir um prazo inventado.

    O mês corre assim: primeiro os juros incidem sobre o saldo remanescente,
    depois o orçamento é distribuído pela fila. Essa ordem é a do mundo real —
    o credor cobra juros sobre o que estava devendo, não sobre o que sobrou
    depois do pagamento.
    """
    fila = ordenar(dividas, estrategia)
    # Nada a amortizar: sem dívida, ou todas já zeradas. Zero mês é a resposta
    # honesta, e é diferente de "não quita" (None).
    if not fila or all(d.saldo <= 0 for d in fila):
        return ResultadoSimulacao(
            meses_ate_quitacao=0,
            data_liberdade=mes_inicial,
            total_juros_pagos=0,
            total_pago=0,
            ordem_pagamento=[],
            evolucao_saldo=[],
        )

    # Saldos em Decimal de REAIS durante o laço: os juros de um mês raramente
    # caem em centavo inteiro, e arredondar a cada mês acumularia o erro por
    # dezenas de iterações. A conversão para centavos acontece só na saída.
    saldos = {d.divida_id: centavos_para_decimal(d.saldo) for d in fila}
    juros_por_divida = {d.divida_id: Decimal(0) for d in fila}
    quitacoes: list[QuitacaoDeDivida] = []
    evolucao: list[PontoDeSaldo] = []

    # Regra 1: o orçamento não encolhe quando uma dívida quita.
    orcamento = centavos_para_decimal(sum(d.parcela_minima for d in fila) + aporte_extra_mensal)

    total_juros = Decimal(0)
    total_pago = Decimal(0)
    mes = mes_inicial
    decorridos = 0

    while decorridos < TETO_MESES:
        # A fila encolhe conforme as dívidas quitam; o orçamento, não.
        vivas = [d for d in fila if saldos[d.divida_id] > 0]
        saldo_no_inicio = sum(saldos.values())

        for d in vivas:
            if d.taxa_mensal_bps:  # None e 0 não geram juros
                juros = saldos[d.divida_id] * bps_para_decimal(d.taxa_mensal_bps)
                saldos[d.divida_id] += juros
                juros_por_divida[d.divida_id] += juros
                total_juros += juros

        disponivel = orcamento
        for d in vivas:
            if disponivel <= 0:
                break
            # Paga no máximo o que ainda deve: a sobra segue para a próxima da
            # fila no mesmo mês, que é o efeito de acelerar que o usuário sente.
            pagamento = min(disponivel, saldos[d.divida_id])
            saldos[d.divida_id] -= pagamento
            disponivel -= pagamento
            total_pago += pagamento

        decorridos += 1

        # O mês não reduziu a dívida: o orçamento não cobre nem os juros. Como
        # ele é constante e os saldos só cresceriam, nenhum mês seguinte seria
        # diferente. Parar aqui em vez de iterar até o teto evita, além do
        # trabalho inútil, um saldo que estoura a precisão do Decimal e
        # devolveria número sem sentido.
        if sum(saldos.values()) >= saldo_no_inicio:
            return None

        for d in vivas:
            if saldos[d.divida_id] <= 0 and all(q.divida_id != d.divida_id for q in quitacoes):
                quitacoes.append(
                    QuitacaoDeDivida(
                        divida_id=d.divida_id,
                        credor=d.credor,
                        posicao=len(quitacoes) + 1,
                        quitada_em=mes,
                        juros_pagos=decimal_para_centavos(juros_por_divida[d.divida_id]),
                    )
                )

        evolucao.append(
            PontoDeSaldo(mes=mes, saldo=decimal_para_centavos(sum(saldos.values())))
        )
        mes_encerrado = mes
        mes = _proximo_mes(mes)

        if all(s <= 0 for s in saldos.values()):
            return ResultadoSimulacao(
                meses_ate_quitacao=decorridos,
                data_liberdade=mes_encerrado,
                total_juros_pagos=decimal_para_centavos(total_juros),
                total_pago=decimal_para_centavos(total_pago),
                ordem_pagamento=quitacoes,
                evolucao_saldo=evolucao,
            )

    return None


def economia_vs_minimo(
    dividas: list[DividaSimulavel],
    aporte_extra_mensal: int,
    estrategia: str,
    mes_inicial: str,
) -> int | None:
    """
    Quanto de juros o aporte extra poupa, comparado a pagar só o mínimo.

    É o número que justifica o esforço para o usuário. Devolve None quando o
    cenário mínimo não quita dentro do teto — sem o outro lado da comparação,
    não há economia a afirmar, e o app exibe "ainda não calculado".
    """
    com_aporte = simular(dividas, aporte_extra_mensal, estrategia, mes_inicial)
    so_minimo = simular(dividas, 0, estrategia, mes_inicial)
    if com_aporte is None or so_minimo is None:
        return None
    return so_minimo.total_juros_pagos - com_aporte.total_juros_pagos
