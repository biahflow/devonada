from dataclasses import dataclass
from decimal import Decimal

from domain.dinheiro import decimal_para_centavos, centavos_para_decimal, bps_para_decimal
from juridico.fontes import citar

"""
Revisão de cobrança — os pontos do contrato que valem contestar.

`valorJusto` NÃO é estimativa. É subtração:

    valorJusto = valorCobrado − Σ (achados com valor)

Cada achado cita a fonte, e nenhum achado nasce sem ela. Isto é a ADR 0008, e
existe porque a leitura anterior do campo ("quanto o backend estima que a dívida
deveria custar") não tinha — nem pode ter — fonte: não há lei que diga quanto
uma dívida deveria custar. Produzir aquele número seria o `valorCobrado * 1.1`
outra vez, num campo que o usuário leva a uma negociação real.

DUAS CLASSES DE ACHADO, e a diferença entre elas é o que separa um número de um
alerta:

- COM valor: o montante é DIRETO no contrato (a multa em excesso, a tarifa, o
  prêmio do seguro). Entra na subtração.
- SEM valor: quantificar exigiria reamortizar o contrato inteiro. Aparece na
  tela, com fonte, e NÃO mexe no número. Arbitrar esse valor seria reintroduzir
  a estimativa pela porta dos fundos.

TOM, sem exceção: todo achado é convite a investigar, jamais sentença. É o mesmo
regime de `possivelPrescricao` e o guardrail 3. "Vale contestar", nunca "é
ilegal" — quem decide se houve abuso é o Judiciário, não este módulo.

Módulo PURO: sem I/O, sem ORM, sem `date.today()` implícito. A rota lê o banco e
entrega os insumos.
"""

# CDC, art. 52, §1º (redação da Lei 9.298/1996): "As multas de mora decorrentes
# do inadimplemento de obrigações no seu termo não poderão ser superiores a dois
# por cento do valor da prestação." O teto está no texto da lei e não muda por
# resolução — por isso é constante aqui, e não configuração.
TETO_MULTA_MORATORIA_BPS = 200

MODALIDADES_CONSIGNADAS = ("consignado_inss", "consignado_privado")


@dataclass(frozen=True)
class Achado:
    """
    Um ponto concreto do contrato que vale contestar.

    `valor_contestavel` nulo é o achado que aparece mas não soma. `evidencia` é
    o trecho LITERAL do contrato, presente sempre que o achado nasceu da
    extração — `limpar_campos_sem_evidencia()` garante isso antes, zerando no
    servidor todo campo sem trecho.
    """

    id: str
    titulo: str
    explicacao: str
    # OS IDS das normas no registro de `juridico/fontes.py`, não o texto delas.
    #
    # TUPLA, e não um id só: o achado do seguro prestamista sempre se apoiou em
    # DUAS — o CDC sobre venda casada e o Tema 972 do STJ sobre a escolha da
    # seguradora —, e elas viviam concatenadas numa string que nenhum código
    # conseguia separar de novo. Uma fonte por achado teria obrigado a jogar uma
    # das duas fora na primeira refatoração.
    fonte_ids: tuple[str, ...]
    como_conferir: str
    valor_contestavel: int | None = None
    evidencia: str | None = None

    @property
    def fonte(self) -> str:
        """
        A citação legível: "Norma, dispositivo", separadas por ponto e vírgula.

        DERIVADA do registro, e não mais escrita à mão em cada achado. Antes,
        cinco achados carregavam cinco strings independentes — e nada garantia
        que a citação de um batesse com a do outro nem com a docstring da regra
        logo acima. Agora existe um lugar onde a norma está escrita, e ele é o
        mesmo que a tela lê para mostrar ementa, vigência e link.
        """
        return "; ".join(citar(i) for i in self.fonte_ids)


@dataclass(frozen=True)
class Contrato:
    """
    Os insumos da revisão, já lidos do banco pela rota.

    Tudo opcional porque tudo pode faltar: dívida cadastrada à mão não tem
    contrato lido, e campo sem trecho literal chega aqui como None. Insumo
    ausente não vira achado — nunca vira suposição.
    """

    valor_cobrado: int
    modalidade: str | None = None
    taxa_juros_mensal_bps: int | None = None
    multa_moratoria_bps: int | None = None
    tarifa_cadastro: int | None = None
    seguro_prestamista: int | None = None
    cet_anual_bps: int | None = None

    # Trechos literais, por campo. Ausente quando o dado não veio da extração.
    trecho_multa: str | None = None
    trecho_tarifa: str | None = None
    trecho_seguro: str | None = None
    trecho_taxa: str | None = None


@dataclass(frozen=True)
class Tetos:
    """
    Tetos que mudam por resolução do CNPS. Zero significa NÃO CONFIGURADO.

    Sem o teto, a regra correspondente devolve None e o achado não existe. O
    código nunca chuta um teto: um número desatualizado aqui viraria argumento
    errado numa negociação real (ADR 0008).
    """

    consignado_inss_bps: int = 0
    cartao_consignado_bps: int = 0
    vigentes_em: str = ""


@dataclass(frozen=True)
class Revisao:
    achados: list[Achado]
    valor_justo: int | None
    base_legal_vigente_em: str | None


def multa_acima_do_teto(contrato: Contrato, parcelas_atrasadas: list[int]) -> Achado | None:
    """
    Multa de atraso acima de 2% do valor da prestação.

    FONTE: CDC (Lei 8.078/1990), art. 52, §1º, na redação da Lei 9.298/1996 —
    "As multas de mora decorrentes do inadimplemento de obrigações no seu termo
    não poderão ser superiores a dois por cento do valor da prestação."

    O teto incide sobre O VALOR DA PRESTAÇÃO, não sobre o total do contrato: o
    excesso é somado parcela atrasada a parcela atrasada. Sem parcela em atraso
    não há multa cobrada, então o achado aparece SEM valor — a cláusula continua
    contestável, o dinheiro ainda não.

    Exatamente 2% não é achado: o teto é o limite permitido, não a infração.
    """
    multa = contrato.multa_moratoria_bps
    if multa is None or multa <= TETO_MULTA_MORATORIA_BPS:
        return None

    excedente_bps = multa - TETO_MULTA_MORATORIA_BPS
    excedente = bps_para_decimal(excedente_bps)
    total = sum(
        (centavos_para_decimal(v) * excedente for v in parcelas_atrasadas),
        Decimal(0),
    )
    valor = decimal_para_centavos(total) if parcelas_atrasadas else None

    return Achado(
        id="multa_acima_do_teto",
        titulo="Multa de atraso acima do limite do CDC",
        explicacao=(
            f"O contrato prevê multa de {_pct(multa)} por atraso. O Código de Defesa do "
            f"Consumidor limita a multa de mora a {_pct(TETO_MULTA_MORATORIA_BPS)} do valor da "
            "prestação. Vale contestar a diferença."
        ),
        fonte_ids=("cdc-52-1",),
        como_conferir=(
            "Procure no contrato a cláusula de multa por atraso e confira o percentual."
        ),
        valor_contestavel=valor,
        evidencia=contrato.trecho_multa,
    )


def juros_acima_do_teto(contrato: Contrato, tetos: Tetos) -> Achado | None:
    """
    Taxa contratada acima do teto do consignado.

    FONTE: resolução do Conselho Nacional de Previdência Social (CNPS), que
    define o teto e o revê periodicamente. Por isso o teto vem de configuração,
    com a data de vigência ao lado — e teto não configurado (zero) faz esta
    função devolver None.

    ACHADO SEM VALOR, por decisão declarada (ADR 0008): quantificar o excesso
    exigiria reamortizar o contrato inteiro a duas taxas, e o resultado seria
    estimativa disfarçada de apuração. O que se leva para a negociação é o
    confronto das duas taxas, e é isso que o achado entrega.
    """
    taxa = contrato.taxa_juros_mensal_bps
    modalidade = contrato.modalidade
    if taxa is None or modalidade is None:
        return None

    if modalidade in MODALIDADES_CONSIGNADAS:
        teto, rotulo = tetos.consignado_inss_bps, "empréstimo consignado"
    elif modalidade == "cartao_consignado":
        teto, rotulo = tetos.cartao_consignado_bps, "cartão consignado"
    else:
        return None

    if teto <= 0 or taxa <= teto:
        return None

    return Achado(
        id="juros_acima_do_teto",
        titulo="Juros acima do teto do consignado",
        explicacao=(
            f"A taxa contratada é de {_pct(taxa)} ao mês. O teto vigente para {rotulo} é de "
            f"{_pct(teto)} ao mês. Vale pedir a revisão da taxa."
        ),
        fonte_ids=("cnps-teto-consignado",),
        como_conferir=(
            "Confira a taxa de juros mensal no seu contrato e compare com o teto da data em "
            "que você contratou."
        ),
        valor_contestavel=None,
        evidencia=contrato.trecho_taxa,
    )


def tarifa_de_cadastro_repetida(
    contrato: Contrato, credor_ja_tinha_divida_anterior: bool
) -> Achado | None:
    """
    Tarifa de cadastro cobrada fora do início do relacionamento.

    FONTE: STJ, Súmula 566 — "Nos contratos bancários posteriores ao início da
    vigência da Resolução-CMN n. 3.518/2007, em 30/4/2008, pode ser cobrada a
    tarifa de cadastro NO INÍCIO DO RELACIONAMENTO entre o consumidor e a
    instituição financeira."

    O indício, e sua limitação: só sabemos que houve relacionamento anterior
    quando existe outra dívida do MESMO credor com data de origem mais antiga no
    app. "Relacionamento" é mais amplo do que isso — por isso o achado declara o
    indício que o gerou e devolve a conclusão ao usuário, condicionada.
    """
    tarifa = contrato.tarifa_cadastro
    if not tarifa or not credor_ja_tinha_divida_anterior:
        return None

    return Achado(
        id="tarifa_cadastro_repetida",
        titulo="Tarifa de cadastro em contrato que não é o primeiro",
        explicacao=(
            "Este contrato cobra tarifa de cadastro, e encontramos outra dívida sua com este "
            "mesmo credor, mais antiga. O STJ admite a tarifa de cadastro no início do "
            "relacionamento com a instituição. Se este não foi seu primeiro contrato com ela, "
            "vale contestar."
        ),
        fonte_ids=("stj-sumula-566",),
        como_conferir=(
            "Este foi seu primeiro contrato com este credor? Se você já era cliente, procure a "
            "linha da tarifa de cadastro no contrato."
        ),
        valor_contestavel=tarifa,
        evidencia=contrato.trecho_tarifa,
    )


def seguro_prestamista_embutido(contrato: Contrato) -> Achado | None:
    """
    Seguro prestamista embutido no contrato.

    FONTE: CDC, art. 39, I — é vedado ao fornecedor "condicionar o fornecimento
    de produto ou de serviço ao fornecimento de outro produto ou serviço".
    STJ, Tema 972 (REsp 1.639.320/SP e REsp 1.639.259/SP) — "Nos contratos
    bancários em geral, o consumidor não pode ser compelido a contratar seguro
    com a instituição financeira ou com seguradora por ela indicada."

    A presença do seguro NÃO PROVA venda casada: contratar seguro junto do
    financiamento é lícito, e o que a tese proíbe é o consumidor ser compelido.
    Só o usuário sabe se lhe foi dada a escolha. Então o achado nomeia o valor em
    jogo e devolve a ele a pergunta de fato — em vez de afirmar um abuso que este
    módulo não tem como constatar.
    """
    premio = contrato.seguro_prestamista
    if not premio:
        return None

    return Achado(
        id="seguro_prestamista_embutido",
        titulo="Seguro prestamista embutido no contrato",
        explicacao=(
            "O contrato inclui um seguro prestamista. Contratar o seguro junto do empréstimo é "
            "permitido, mas o consumidor não pode ser obrigado a contratá-lo, nem obrigado a "
            "aceitar a seguradora indicada pelo banco. Se você não teve essa escolha, vale "
            "contestar o valor."
        ),
        fonte_ids=("cdc-39-i", "stj-tema-972"),
        como_conferir=(
            "Na contratação, foi oferecida a opção de não contratar o seguro? Você pôde escolher "
            "a seguradora?"
        ),
        valor_contestavel=premio,
        evidencia=contrato.trecho_seguro,
    )


def cet_nao_informado(contrato: Contrato) -> Achado | None:
    """
    Taxa efetiva anual ausente do contrato.

    FONTE: CDC, art. 52, II — no fornecimento de crédito, o fornecedor deverá
    informar prévia e adequadamente sobre "montante dos juros de mora e da taxa
    efetiva anual de juros".

    ACHADO SEM VALOR: a ausência da informação não é, ela mesma, uma quantia
    cobrada a mais. Só é produzido quando o contrato FOI lido e mesmo assim o CET
    não apareceu — dívida sem contrato lido não gera este achado, senão ele
    apareceria para todo mundo e não significaria nada.
    """
    if contrato.cet_anual_bps is not None or contrato.modalidade is None:
        return None

    return Achado(
        id="cet_nao_informado",
        titulo="Custo Efetivo Total não localizado no contrato",
        explicacao=(
            "Não encontramos o Custo Efetivo Total (CET) no contrato que você enviou. O CDC "
            "exige que a taxa efetiva anual seja informada antes da contratação. Vale pedir "
            "esse demonstrativo ao credor."
        ),
        fonte_ids=("cdc-52-ii",),
        como_conferir=(
            "Procure no contrato por 'CET' ou 'Custo Efetivo Total'. Se não houver, peça ao "
            "credor por escrito."
        ),
        valor_contestavel=None,
        evidencia=None,
    )


def revisar(
    contrato: Contrato,
    tetos: Tetos,
    parcelas_atrasadas: list[int],
    credor_ja_tinha_divida_anterior: bool = False,
) -> Revisao:
    """
    Compõe os achados e faz a subtração.

    `valor_justo` é None quando NENHUM achado tem valor — nunca igual ao valor
    cobrado. Um `valorJusto` igual ao cobrado diria "conferimos e está tudo
    certo", que é uma afirmação que não temos como fazer.
    """
    achados = [
        a
        for a in (
            multa_acima_do_teto(contrato, parcelas_atrasadas),
            juros_acima_do_teto(contrato, tetos),
            tarifa_de_cadastro_repetida(contrato, credor_ja_tinha_divida_anterior),
            seguro_prestamista_embutido(contrato),
            cet_nao_informado(contrato),
        )
        if a is not None
    ]

    com_valor = [a.valor_contestavel for a in achados if a.valor_contestavel]
    total = sum(com_valor)

    # Soma que alcança ou ultrapassa o valor cobrado NÃO vira zero nem número
    # negativo: "esta dívida deveria custar nada" é conclusão que não temos como
    # sustentar, e quase sempre indica encargo lido errado na extração. Os
    # achados continuam na tela, com seus valores; o número de destaque não sai.
    valor_justo = contrato.valor_cobrado - total if 0 < total < contrato.valor_cobrado else None

    # A data de vigência só acompanha a resposta quando algum achado REALMENTE
    # dependeu de um teto configurado. Exibi-la sempre sugeriria que todos os
    # achados envelhecem juntos, e a multa do CDC não envelhece.
    vigente_em = (
        tetos.vigentes_em or None
        if any(a.id == "juros_acima_do_teto" for a in achados)
        else None
    )

    return Revisao(achados=achados, valor_justo=valor_justo, base_legal_vigente_em=vigente_em)


def _pct(bps: int) -> str:
    """
    Basis points → percentual legível em pt-BR. 250 → '2,5%'.

    `Decimal` mesmo sendo só rótulo: aqui não há conta de dinheiro, mas deixar um
    `float` num módulo de domínio convida o próximo a usá-lo onde há.
    """
    texto = f"{Decimal(bps) / 100:.2f}".rstrip("0").rstrip(".")
    return f"{texto.replace('.', ',')}%"
