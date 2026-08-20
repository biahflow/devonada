from collections.abc import Sequence
from dataclasses import dataclass
from decimal import ROUND_CEILING, Decimal

from domain.dinheiro import aplicar_percentual

"""
Capacidade de pagamento: quanto sobra por mês, de verdade, para pagar dívida.

POR QUE ESTE MÓDULO EXISTE: até aqui o produto usava o MÍNIMO EXISTENCIAL como
proxy do custo de vida (`routers/simulacoes.py`). Mínimo existencial é um piso
legal de proteção contra o credor — R$ 600,00, Decreto 11.150/2022, art. 3º, na
redação do Decreto 11.567/2023. Não é o que uma pessoa gasta para viver: quem
tem aluguel, carro e moto gasta muitas vezes esse valor. Usar o piso como custo
de vida produz margem otimista, e margem otimista produz plano que a pessoa não
consegue honrar — que é pior que plano nenhum, porque ela renegocia, quebra em
três meses e volta inadimplente.

Este módulo troca o proxy pelo número real. O piso continua valendo como limite
inferior intransponível; o custo de vida real passa a determinar a capacidade.

ADR 0009: o app NÃO decide a ordem dos potes. Ele calcula e mostra; a alocação é
escolha do usuário. Nenhum coeficiente de agressividade (`× 0,5`, `× 0,7`,
`× 0,9`) existe aqui — seriam constantes sem fonte apresentadas como se
significassem algo, a mesma classe do `valorCobrado * 1.1`.

ESCOLHAS DE MÉTODO, declaradas porque não vêm de lei nenhuma:

1. DUAS CAPACIDADES, NÃO UMA. `capacidade_hoje` é o que sobra sem mudar nada de
   vida; `capacidade_maxima` é o que sobraria cortando todo o não essencial. A
   diferença entre elas é a alavanca que o usuário controla. Mostrar as duas é
   informar; escolher por ele seria mandar cortar.

2. RENDA TÍPICA É O PIOR MÊS, NÃO A MÉDIA (ver `renda_tipica`). Plano
   dimensionado pela média quebra em todo mês ruim, e quem ganha por hora tem
   mês ruim.

3. PROVISÃO DIVIDE PELOS MESES QUE FALTAM, NÃO POR 12 (ver `aporte_de_provisao`).

4. NÃO ESSENCIAL NUNCA É CORTADO POR INICIATIVA DO APP. Ele entra em
   `capacidade_hoje` como gasto real e só sai em `capacidade_maxima`, que é
   rotulada como hipótese na tela.

5. CAPACIDADE NEGATIVA NÃO É ERRO. É a informação mais importante que este
   módulo produz, e segue o precedente de `margem_disponivel`.
"""

# Janela de recebimentos considerada para a renda típica.
JANELA_RECEBIMENTOS = 6

# Abaixo disto não há amostra que descreva a variação da renda: um único mês
# ruim fixaria a renda num ponto fora da curva, e um único mês bom faria o
# oposto — que é o erro perigoso.
MINIMO_DE_AMOSTRAS = 3

ORIGEM_INFORMADA = "informada"
ORIGEM_HISTORICO = "pior_mes_registrado"

# FONTE: CDC, art. 104-A (incluído pela Lei 14.181/2021) — na repactuação de
# dívidas, o consumidor "apresentará proposta de plano de pagamento com prazo
# máximo de 5 (cinco) anos, preservados o mínimo existencial".
#
# NÃO é um limite que o app impõe à simulação: é um número da lei que ajuda o
# usuário a ler o próprio plano. Plano de 90 meses não é ilegal — mas é mais
# longo que o teto do caminho judicial, e saber disso muda a conversa com o
# credor. Quem consome exibe como informação, nunca como impedimento.
PRAZO_MAXIMO_REPACTUACAO_MESES = 60


@dataclass(frozen=True)
class ProvisaoPendente:
    """Uma despesa anual conhecida, como o motor a enxerga. Sem ORM: puro."""

    descricao: str
    valor_anual: int  # centavos
    saldo_acumulado: int  # centavos já guardados
    mes_vencimento: int  # 1 a 12


@dataclass(frozen=True)
class EntradaCaixa:
    renda_bruta_tipica: int
    origem_renda: str
    imposto_bps: int | None
    essenciais: int
    nao_essenciais: int
    provisoes: tuple[ProvisaoPendente, ...]
    aporte_reserva: int
    aporte_aposentadoria: int
    comprometido_dividas: int
    minimo_existencial: int | None
    mes_atual: int  # 1 a 12

    # RESPIRO (M11, ADR 0019). `None` é "nunca declarou", e NÃO se confunde com
    # `0`, que é uma escolha legítima de quem declarou zero. Não há default:
    # um percentual de fábrica seria o coeficiente sem fonte que a ADR 0009
    # proíbe, entrando pela porta dos fundos.
    respiro: int | None = None
    # Desativar não é apagar: o valor e o saldo continuam registrados, e só a
    # linha da cascata para de valer enquanto `ativo` for `False`.
    respiro_ativo: bool | None = None
    respiro_usado_no_mes: int | None = None
    respiro_saldo_acumulado: int | None = None


@dataclass(frozen=True)
class Caixa:
    renda_bruta_tipica: int
    origem_renda: str
    imposto_reservado: int
    renda_liquida: int
    essenciais: int
    nao_essenciais: int
    provisao_mensal: int
    aporte_reserva: int
    aporte_aposentadoria: int
    comprometido_dividas: int
    capacidade_hoje: int
    capacidade_maxima: int
    aporte_maximo: int
    respiro: int | None
    respiro_ativo: bool | None
    respiro_usado_no_mes: int | None
    # Derivado a cada leitura, NUNCA persistido: valor calculado que dorme em
    # coluna é valor que envelhece errado, e este muda a cada uso registrado.
    respiro_disponivel_no_mes: int | None
    respiro_saldo_acumulado: int | None
    minimo_existencial: int | None
    abaixo_do_piso: bool | None
    nao_fecha: bool
    preenchimento: str


def renda_tipica(
    informada: int | None, recebimentos: Sequence[int]
) -> tuple[int, str]:
    """
    A renda que o plano precisa suportar quando o mês é ruim.

    ESCOLHA DE MÉTODO: é o MENOR dos últimos `JANELA_RECEBIMENTOS` recebimentos
    registrados, não a média. Quem ganha por hora tem mês fraco, e um plano
    dimensionado pela média quebra exatamente nele. Errar para baixo aqui custa
    ao usuário um plano mais lento; errar para cima custa a ele o plano inteiro.

    A janela existe para que um mês péssimo de um ano atrás não ancore a renda
    para sempre. O piso de amostras existe porque com um ou dois recebimentos
    não há variação observada — só um ponto solto.

    Sem histórico suficiente, devolve o valor informado pelo usuário e diz que
    foi ele. A origem viaja para a tela: o usuário precisa saber se o número que
    está vendo é o que ele digitou ou o que ele de fato recebeu. Mesmo espírito
    do `evolucaoSaldo`, que nasce vazio e ganha um ponto por mês de uso.
    """
    recentes = list(recebimentos)[-JANELA_RECEBIMENTOS:]
    if len(recentes) >= MINIMO_DE_AMOSTRAS:
        return min(recentes), ORIGEM_HISTORICO
    return (informada or 0), ORIGEM_INFORMADA


def meses_ate_vencimento(mes_vencimento: int, mes_atual: int) -> int:
    """
    Quantos meses faltam até a próxima ocorrência de um vencimento anual.

    Agosto (8) para janeiro (1) devolve 5, não 12. É o número que impede o erro
    do "divide por 12": quem começa a guardar em agosto tem cinco depósitos até
    o IPVA, e dividir por doze o deixa curto justamente no mês que a provisão
    existe para proteger.

    Vencimento no próprio mês devolve 1, não 0: a despesa é agora, e o que falta
    precisa sair de uma vez. Zero dividiria por zero, e doze fingiria que há um
    ano de folga.
    """
    restantes = (mes_vencimento - mes_atual) % 12
    return restantes if restantes > 0 else 1


def aporte_de_provisao(provisao: ProvisaoPendente, mes_atual: int) -> int:
    """
    Quanto separar este mês para esta despesa anual, em centavos.

    ARREDONDA PARA CIMA. O centavo a mais por mês é irrelevante; o centavo a
    menos, multiplicado pelos meses, faz o fundo não fechar no vencimento — e o
    fundo existe exatamente para fechar no vencimento.

    Já guardado além do necessário devolve zero, nunca negativo: provisão
    sobrando não vira renda.
    """
    falta = provisao.valor_anual - provisao.saldo_acumulado
    if falta <= 0:
        return 0

    meses = meses_ate_vencimento(provisao.mes_vencimento, mes_atual)
    por_mes = Decimal(falta) / Decimal(meses)
    return int(por_mes.quantize(Decimal(1), rounding=ROUND_CEILING))


def provisao_mensal(
    provisoes: Sequence[ProvisaoPendente], mes_atual: int
) -> int:
    """A soma dos aportes de todas as provisões ativas."""
    return sum(aporte_de_provisao(p, mes_atual) for p in provisoes)


def meses_entre(mes_inicial: str, mes_final: str) -> int:
    """
    Distância em meses entre dois `AAAA-MM`.

    String em vez de `date` pelo mesmo motivo de `simulacao._proximo_mes`: o mês
    é a unidade que o usuário informa e a que está persistida. Nunca negativo —
    mês futuro devolve 0, porque "o fechamento é do mês que vem" não é uma
    defasagem, é dado inconsistente, e um número negativo viajaria para a tela.
    """
    ano_i, m_i = int(mes_inicial[:4]), int(mes_inicial[5:7])
    ano_f, m_f = int(mes_final[:4]), int(mes_final[5:7])
    distancia = (ano_f - ano_i) * 12 + (m_f - m_i)
    return max(0, distancia)


# ESCOLHA DE MÉTODO, não regra de lei: a partir de quantos meses os números do
# caixa deixam de descrever o mês que a pessoa está vivendo.
#
# Dois, e não um, porque UM mês de atraso é o estado normal entre fechamentos:
# quem fecha março o faz durante abril, e sinalizar isso como problema treinaria
# o usuário a ignorar o aviso. Dois meses significam que um fechamento inteiro
# foi pulado.
MESES_ATE_DEFASAR = 2


def caixa_defasado(meses_desde_fechamento: int | None) -> bool | None:
    """
    Se a capacidade está sendo calculada sobre número velho.

    Devolve `None` quando NUNCA houve fechamento — que não é a mesma coisa que
    estar defasado, e a tela precisa poder dizer "ainda não fechado" em vez de
    acusar um atraso que não existe. Mesmo espírito do "ainda não calculado".

    Por que isso importa: a capacidade alimenta o aporte do simulador, e o
    simulador alimenta o que o usuário leva a uma negociação real. Um número de
    três meses atrás apresentado como se fosse de hoje é o tipo de erro que o
    produto inteiro existe para evitar — e o app não tem como saber sozinho que
    a renda mudou.
    """
    if meses_desde_fechamento is None:
        return None
    return meses_desde_fechamento >= MESES_ATE_DEFASAR


def respiro_invade_o_piso(
    liquida: int, essenciais: int, respiro: int, minimo: int | None
) -> bool | None:
    """
    Se o respiro declarado empurra o que resta abaixo do mínimo existencial.

    FONTE: Decreto 11.150/2022, art. 3º, na redação do Decreto 11.567/2023 — o
    mínimo existencial é piso legal de proteção do devedor, e nenhuma alocação
    voluntária o atravessa. É a mesma lei de `domain/minimo_existencial.py` e do
    `abaixo_do_piso` desta cascata.

    A ESCOLHA É DO USUÁRIO; O PISO É DA LEI (ADR 0019, item 6). Esta função não
    diz quanto respiro alguém deveria ter — ela só responde se o valor que a
    pessoa declarou cabe acima do piso.

    Devolve `None` quando não há piso configurado, no mesmo espírito de
    `abaixo_do_piso`: um `False` diria "conferimos e está tudo bem", que é
    afirmação diferente de "não sabemos".
    """
    if minimo is None:
        return None
    return (liquida - essenciais - respiro) < minimo


def _preenchimento(entrada: EntradaCaixa) -> str:
    """
    Em que nível de captura o usuário está — é o que a tela usa para escolher
    entre o convite e o conteúdo.

    Existe porque quem está endividado e com medo não preenche formulário: o
    Nível 0 são dois campos e devolve a capacidade na hora, e é o valor imediato
    que compra o Nível 1.
    """
    if entrada.renda_bruta_tipica <= 0 and entrada.essenciais <= 0:
        return "vazio"

    detalhou = (
        bool(entrada.provisoes)
        or entrada.nao_essenciais > 0
        or entrada.aporte_reserva > 0
        or entrada.aporte_aposentadoria > 0
        or entrada.imposto_bps is not None
    )
    return "nivel_1" if detalhou else "nivel_0"


def calcular_caixa(entrada: EntradaCaixa) -> Caixa:
    """
    A cascata inteira, em centavos inteiros.

        imposto_reservado = renda_bruta_tipica × imposto_bps
        renda_liquida     = renda_bruta_tipica − imposto_reservado
        sobra_operacional = renda_liquida − essenciais − provisao_mensal
        capacidade_maxima = sobra_operacional − reserva − aposentadoria − respiro
        capacidade_hoje   = capacidade_maxima − nao_essenciais
        aporte_maximo     = capacidade_hoje − comprometido_dividas

    O RESPIRO ENTRA ANTES DO CORTE, E É ISSO QUE O DEFINE (ADR 0019).
    `capacidade_maxima` é, literalmente, o cenário em que todo o não essencial
    foi cortado. Descontar o respiro depois dele faria dele a sobra que some
    quando aperta — exatamente o que ele existe para não ser. Antes, ele é
    imune ao corte por construção, e não por disciplina de quem escreve a tela.

    O VALOR DO RESPIRO NÃO É REGRA FINANCEIRA: É DADO DO USUÁRIO. Ele não tem
    FONTE no sentido de `docs/backend.md` porque não é derivado de lei, contrato
    nem estudo — é declarado, como um gasto ou um pote, e o app responde apenas
    com o que sabe de verdade: quantos meses a mais de quitação aquela escolha
    custa. Nenhum coeficiente é arbitrado aqui: a faixa "5 a 8% da capacidade"
    que a concepção trazia não sobe a documento canônico, porque não tem fonte
    (ADR 0009). Consequência aceita: QUEM NÃO DECLARA NÃO TEM RESPIRO, e
    `respiro = None` produz a cascata idêntica à de antes desta linha existir.

    IMPOSTO SAI PRIMEIRO, e sai do bruto. Quem é PJ recebe dinheiro que em parte
    não é dele; tratá-lo como renda faz a pessoa gastar o que vai faltar na
    apuração. Sem `imposto_bps` informado, NADA é reservado e quem consome tem
    de dizer ao usuário que não está reservando — estimar alíquota de
    enquadramento tributário seria inventar regra (ADR 0009).

    AS PARCELAS DE DÍVIDA NÃO ENTRAM NA CASCATA. A capacidade é o total que pode
    ir para dívida, e as parcelas atuais já são dívida — descontá-las aqui as
    contaria duas vezes. Quem precisa do teto do aporte EXTRA usa
    `aporte_maximo`, que é a capacidade menos o que já está comprometido.
    """
    bruta = entrada.renda_bruta_tipica
    imposto = aplicar_percentual(bruta, entrada.imposto_bps) if entrada.imposto_bps else 0
    liquida = bruta - imposto

    provisao = provisao_mensal(entrada.provisoes, entrada.mes_atual)
    sobra_operacional = liquida - entrada.essenciais - provisao

    # O `or 0` mora na ARITMÉTICA, e nunca no campo devolvido: `Caixa.respiro`
    # continua `None` para quem nunca declarou. Ausência que vira zero apagaria
    # a distinção entre não ter escolhido e ter escolhido zero.
    #
    # Desativado sai da cascata sem apagar nada — `ativo: false` preserva valor
    # e saldo acumulado (ADR 0019, item 5).
    respiro_na_cascata = 0 if entrada.respiro_ativo is False else (entrada.respiro or 0)

    capacidade_maxima = (
        sobra_operacional
        - entrada.aporte_reserva
        - entrada.aporte_aposentadoria
        - respiro_na_cascata
    )
    capacidade_hoje = capacidade_maxima - entrada.nao_essenciais

    # Piso em zero: quem usou mais do que declarou não fica com disponível
    # negativo, que na tela viraria dívida de lazer — o oposto do que a linha
    # existe para fazer (guardrail 4.1). Derivado aqui, nunca persistido.
    respiro_disponivel = None
    if entrada.respiro is not None:
        respiro_disponivel = max(
            0, entrada.respiro - (entrada.respiro_usado_no_mes or 0)
        )

    # O piso é da lei e não se negocia; a alocação acima dele é do usuário.
    # Sem piso configurado o sinal é ausente, nunca `False`: um `False` diria
    # "conferimos e está tudo bem", que é afirmação diferente de "não sabemos".
    abaixo_do_piso = None
    if entrada.minimo_existencial is not None:
        abaixo_do_piso = (liquida - entrada.essenciais) < entrada.minimo_existencial

    return Caixa(
        renda_bruta_tipica=bruta,
        origem_renda=entrada.origem_renda,
        imposto_reservado=imposto,
        renda_liquida=liquida,
        essenciais=entrada.essenciais,
        nao_essenciais=entrada.nao_essenciais,
        provisao_mensal=provisao,
        aporte_reserva=entrada.aporte_reserva,
        aporte_aposentadoria=entrada.aporte_aposentadoria,
        comprometido_dividas=entrada.comprometido_dividas,
        capacidade_hoje=capacidade_hoje,
        capacidade_maxima=capacidade_maxima,
        # Teto do aporte extra do simulador. Pode ser negativo, e negativo aqui
        # significa que as parcelas atuais já não cabem.
        aporte_maximo=capacidade_hoje - entrada.comprometido_dividas,
        respiro=entrada.respiro,
        respiro_ativo=entrada.respiro_ativo,
        respiro_usado_no_mes=entrada.respiro_usado_no_mes,
        respiro_disponivel_no_mes=respiro_disponivel,
        respiro_saldo_acumulado=entrada.respiro_saldo_acumulado,
        minimo_existencial=entrada.minimo_existencial,
        abaixo_do_piso=abaixo_do_piso,
        # FATO ARITMÉTICO, NÃO DIAGNÓSTICO. As parcelas mínimas não cabem nem
        # cortando todo o não essencial. NÃO é o mesmo que superendividamento:
        # o CDC art. 54-A, § 1º exige boa-fé e dívida de consumo, e o art. 4º do
        # Decreto 11.150 exclui da aferição consignado, imobiliário, garantia
        # real e crédito rural. Nada disso é apurável por software. Quem consome
        # este campo diz que os números não fecham e convida a investigar a
        # repactuação — nunca afirma que o usuário está superendividado.
        nao_fecha=entrada.comprometido_dividas > capacidade_maxima,
        preenchimento=_preenchimento(entrada),
    )
