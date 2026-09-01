from dataclasses import dataclass

"""
O corpus jurídico do produto, tipado.

ATÉ AQUI AS FONTES ERAM STRING SOLTA — `fonte="Código de Defesa do Consumidor,
art. 52, §1º"` dentro de `domain/revisao.py`, `# FONTE:` em docstring de
`domain/prescricao.py`, `fundamentos` montado à mão na rota. Cada uma escrita
uma vez, no lugar onde a regra vive, sem ninguém para conferir se a citação de
um bate com a do outro. O M14 acrescenta a Lei 14.181/2021 a esse conjunto, e
acrescentar uma norma a um corpus que não existe é como a divergência começa.

O QUE ISTO É: um registro curado, revisado por humano, com id estável. O que ele
NÃO é — e não deve virar — é busca semântica sobre texto de lei. O guardrail 3
proíbe o assistente de gerar fundamento jurídico; toda citação que chega ao
usuário é escrita aqui e passa pelo gate de revisão por advogado que o
`roadmap.md` lista como pré-lançamento. Recuperar parágrafo por similaridade
para um modelo parafrasear é exatamente o que esse guardrail existe para
impedir.

ID ESTÁVEL, e é ele que viaja na API — não o texto. A tela pede as fontes uma
vez (`GET /v1/juridico/fontes`) e resolve os ids que vêm com cada achado e cada
trilha. Mandar o parágrafo inteiro junto de toda resposta repetiria os mesmos
textos em todo payload que o app pede o tempo todo.

TEXTO DE LEI NÃO TEM DIREITO AUTORAL (Lei 9.610/1998, art. 8º, IV), então citar
o dispositivo literalmente é livre. O que não é livre é citar ERRADO: por isso
`texto` só é preenchido onde a citação literal já estava conferida no código
deste repositório, e fica `None` onde a redação precisa ser lida na fonte. `url`
aponta o Planalto em todos os casos, e `None` em `texto` significa "vá ler",
nunca "não existe".
"""


@dataclass(frozen=True)
class Fonte:
    """
    Uma norma citável, do jeito que ela aparece para o usuário.

    `dispositivo` é o recorte exato (artigo, parágrafo, inciso) — citar "o CDC"
    inteiro não ajuda quem vai conferir. `ementa` é a nossa frase sobre o que o
    dispositivo diz, em pt-BR para leigo; `texto` é o dispositivo LITERAL, e a
    distinção entre os dois é o que impede a nossa paráfrase de ser lida como
    se fosse a lei.

    `vigencia` diz desde quando esta redação vale. Ela existe pelo mesmo motivo
    de `minimoExistencialVigenteEm` e `tetosVigentesEm` viajarem para a tela: o
    usuário vê a idade do fundamento em vez de confiar nele às cegas. E porque
    a redação MUDA — o mínimo existencial já foi 25% do salário mínimo, e usar a
    redação velha custava R$ 220,50 de piso a quem estava negociando.

    É A DATA EM QUE O DISPOSITIVO PASSOU A VALER, e não a data da lei — as duas
    divergem, e confundi-las já produziu erro aqui. O CDC é de 11/09/1990 e só
    entrou em vigor em **11/03/1991**, porque o art. 118 lhe deu 180 dias de
    vacatio; a tela dizia "vigente desde 1990" para um código que ainda não
    valia naquela data. Quando as duas divergirem e a cláusula de vigência não
    tiver sido conferida na fonte, use a data de PUBLICAÇÃO e registre a dúvida
    no pacote de revisão — publicação é, no pior caso, um limite inferior.

    FORMATO ISO (`AAAA-MM-DD`), com UMA exceção declarada: o teto do consignado
    não tem data fixa aqui, porque ele vem de config datada. Ela está na lista
    `SEM_DATA_FIXA` abaixo, e há teste que falha se uma segunda aparecer sem
    decisão — a tela renderiza "vigente desde {vigencia}", e uma frase nesse
    lugar viraria copy quebrada.
    """

    id: str
    norma: str
    dispositivo: str
    ementa: str
    vigencia: str
    url: str
    texto: str | None = None


_PLANALTO_CDC = "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm"
_PLANALTO_CC = "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm"
_PLANALTO_11150 = "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/decreto/d11150.htm"
_PLANALTO_14181 = "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14181.htm"


# ---------------------------------------------------------------------------
# O que já era citado antes do M14, agora com id
# ---------------------------------------------------------------------------

_ANTES_DO_M14: tuple[Fonte, ...] = (
    Fonte(
        id="cdc-52-1",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 52, § 1º",
        ementa="A multa por atraso não pode passar de 2% do valor da prestação.",
        # Citação literal já conferida em `domain/revisao.py`, onde o teto de
        # 200 bps é constante justamente porque está no texto e não em resolução.
        texto=(
            "As multas de mora decorrentes do inadimplemento de obrigações no seu termo não "
            "poderão ser superiores a dois por cento do valor da prestação."
        ),
        vigencia="1996-08-02",
        url=_PLANALTO_CDC,
    ),
    Fonte(
        id="cdc-52-ii",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 52, II",
        ementa=(
            "No fornecimento de crédito, o consumidor tem de ser informado antes da "
            "contratação sobre os juros de mora e a taxa efetiva anual — o CET."
        ),
        vigencia="1991-03-11",
        url=_PLANALTO_CDC,
    ),
    Fonte(
        id="cdc-39-i",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 39, I",
        ementa=(
            "Condicionar a venda de um produto ou serviço à compra de outro é prática abusiva — "
            "é a chamada venda casada."
        ),
        vigencia="1991-03-11",
        url=_PLANALTO_CDC,
    ),
    Fonte(
        id="stj-sumula-566",
        norma="Superior Tribunal de Justiça",
        dispositivo="Súmula 566",
        ementa=(
            "Nos contratos bancários posteriores a 30/04/2008 (início da vigência da "
            "Resolução-CMN 3.518/2007), a tarifa de cadastro pode ser cobrada no INÍCIO do "
            "relacionamento entre o consumidor e a instituição financeira."
        ),
        # A redação anterior desta ementa citava a MP 1.963-17/2000, que é a norma
        # da Súmula 539 (capitalização de juros) — não desta. Erro conferido
        # contra o enunciado do STJ e corrigido em 01/09/2026; ver
        # `docs/legal/pacote-de-revisao-juridica.md`, achado F1.
        vigencia="2016-02-24",
        url="https://www.stj.jus.br/sites/portalp/Jurisprudencia/Sumulas",
    ),
    Fonte(
        id="stj-tema-972",
        norma="Superior Tribunal de Justiça",
        dispositivo="Tema 972",
        ementa=(
            "Na contratação de seguro junto com o financiamento, o consumidor precisa poder "
            "escolher a seguradora — impor a do banco é venda casada."
        ),
        vigencia="2018-12-12",
        url="https://processo.stj.jus.br/repetitivos/temas_repetitivos/",
    ),
    Fonte(
        id="cnps-teto-consignado",
        norma="Conselho Nacional de Previdência Social",
        dispositivo="Resolução vigente sobre o teto de juros do consignado do INSS",
        ementa=(
            "O CNPS fixa o teto de juros do empréstimo e do cartão consignados de beneficiário "
            "do INSS, e o revê periodicamente."
        ),
        # SEM DATA CRAVADA aqui de propósito: o teto vem de config datada
        # (`tetos_vigentes_em`), e uma data escrita nesta linha envelheceria em
        # silêncio na primeira resolução nova, contradizendo a config.
        vigencia="ver `tetosVigentesEm` na resposta da revisão",
        url="https://www.gov.br/previdencia/pt-br/assuntos/previdencia-social/conselhos-e-orgaos-colegiados/cnps",
    ),
    Fonte(
        id="cc-206-5-i",
        norma="Código Civil",
        dispositivo="art. 206, § 5º, I",
        ementa=(
            "Prescreve em cinco anos a cobrança de dívidas líquidas constantes de instrumento "
            "público ou particular."
        ),
        vigencia="2003-01-11",
        url=_PLANALTO_CC,
    ),
    Fonte(
        id="decreto-11150-3",
        norma="Decreto 11.150/2022",
        dispositivo="art. 3º (redação do Decreto 11.567/2023)",
        ementa=(
            "O mínimo existencial é a renda mensal de R$ 600,00 — valor fixo, que deixou de ser "
            "um percentual do salário mínimo."
        ),
        vigencia="2023-06-19",
        url=_PLANALTO_11150,
    ),
    Fonte(
        id="decreto-11150-4",
        norma="Decreto 11.150/2022",
        dispositivo="art. 4º",
        ementa=(
            "A aferição do mínimo existencial não alcança dívidas de crédito com garantia real, "
            "de financiamento imobiliário, de crédito rural e de crédito consignado."
        ),
        vigencia="2022-07-27",
        url=_PLANALTO_11150,
    ),
)


# ---------------------------------------------------------------------------
# Lei 14.181/2021 — o que o M14 acrescenta
# ---------------------------------------------------------------------------
#
# A lei não criou um capítulo solto: ela ALTEROU o CDC. Por isso os ids abaixo
# são `cdc-*` e não `lei-14181-*` — quem for conferir procura o artigo no CDC,
# e um id que apontasse para a lei alteradora mandaria essa pessoa para o texto
# que diz "acrescente-se o art. 54-A", não para o artigo.
#
# NENHUM DESTES DISPOSITIVOS PRODUZ NÚMERO. Eles nomeiam um caminho — a
# repactuação — e dizem quem o conduz. É deliberado: a lei define
# superendividamento por critérios (boa-fé, dívida de consumo) que software não
# apura, e é por isso que nenhuma regra de `domain/` recebeu um limiar novo.

_LEI_14181: tuple[Fonte, ...] = (
    Fonte(
        id="cdc-54a-1",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 54-A, § 1º (incluído pela Lei 14.181/2021)",
        ementa=(
            "Superendividamento é a impossibilidade manifesta de a pessoa natural de boa-fé "
            "pagar a totalidade das suas dívidas de consumo sem comprometer o mínimo "
            "existencial. Boa-fé e natureza de consumo são apuradas caso a caso — não por "
            "software."
        ),
        vigencia="2021-07-02",
        url=_PLANALTO_14181,
    ),
    Fonte(
        id="cdc-54a-3",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 54-A, § 3º (incluído pela Lei 14.181/2021)",
        ementa=(
            "O tratamento do superendividamento não alcança dívidas contraídas com fraude ou "
            "má-fé, nem as de produtos e serviços de luxo de alto valor."
        ),
        vigencia="2021-07-02",
        url=_PLANALTO_14181,
    ),
    Fonte(
        id="cdc-104a",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 104-A (incluído pela Lei 14.181/2021)",
        ementa=(
            "A pessoa superendividada pode pedir a repactuação das dívidas: uma audiência com "
            "TODOS os credores de uma vez, em que ela apresenta um plano de pagamento de até "
            "cinco anos, preservado o mínimo existencial."
        ),
        vigencia="2021-07-02",
        url=_PLANALTO_14181,
    ),
    Fonte(
        id="cdc-104a-1",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 104-A, § 1º (incluído pela Lei 14.181/2021)",
        ementa=(
            "Ficam de fora da repactuação as dívidas de crédito com garantia real, de "
            "financiamento imobiliário e de crédito rural."
        ),
        vigencia="2021-07-02",
        url=_PLANALTO_14181,
    ),
    Fonte(
        id="cdc-104c",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 104-C (incluído pela Lei 14.181/2021)",
        ementa=(
            "A fase conciliatória da repactuação também corre nos órgãos públicos de defesa do "
            "consumidor, como o Procon — não é preciso começar pelo Judiciário."
        ),
        vigencia="2021-07-02",
        url=_PLANALTO_14181,
    ),
    Fonte(
        id="cdc-6-xi",
        norma="Código de Defesa do Consumidor",
        dispositivo="art. 6º, XI (incluído pela Lei 14.181/2021)",
        ementa=(
            "É direito básico do consumidor a prevenção e o tratamento do superendividamento, "
            "preservado o mínimo existencial, inclusive pela revisão e repactuação da dívida."
        ),
        vigencia="2021-07-02",
        url=_PLANALTO_14181,
    ),
)


# As fontes cuja vigência NÃO é uma data — a exceção declarada de `Fonte.vigencia`.
# Uma lista, e não um `if` espalhado: a tela precisa saber que ali não cabe o
# prefixo "vigente desde", e o teste precisa saber que a exceção foi decidida.
SEM_DATA_FIXA = frozenset({"cnps-teto-consignado"})


# O REGISTRO É EXATAMENTE O QUE ALGUMA REGRA CITA, e nada além. Fonte guardada
# "porque um dia serve" é convite a citá-la sem que ninguém tenha decidido que
# ela se aplica — e o custo de acrescentar uma quando a regra existir é uma
# entrada. `tests/test_juridico.py` falha se alguma ficar órfã.
FONTES: dict[str, Fonte] = {f.id: f for f in (*_ANTES_DO_M14, *_LEI_14181)}


class FonteDesconhecida(KeyError):
    """
    Id que não existe no registro.

    ESTOURA, e não devolve `None`: um id inválido é erro de programação nosso,
    não dado faltando do usuário. Engolir devolveria ao app um achado sem
    fundamento — exatamente o que o registro existe para tornar impossível, e o
    tipo de defeito que só apareceria na tela de alguém.
    """


def obter(id_da_fonte: str) -> Fonte:
    try:
        return FONTES[id_da_fonte]
    except KeyError as e:
        raise FonteDesconhecida(id_da_fonte) from e


def citar(id_da_fonte: str) -> str:
    """
    A fonte como ela aparecia antes deste módulo: "Norma, dispositivo".

    Existe para o campo `fonte` de `Achado` continuar sendo string legível para
    todo cliente já instalado. O id viaja ao lado, em `fonteId`, e é ele que a
    tela nova usa — o texto continua sendo o que ela mostra quando ainda não
    carregou o registro.
    """
    f = obter(id_da_fonte)
    return f"{f.norma}, {f.dispositivo}"
