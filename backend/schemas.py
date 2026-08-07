from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

"""
Contrato de API. Espelha docs/api-contract.md e src/api/types.ts.

Os nomes de campo são camelCase de propósito: é o que o cliente TypeScript
espera, e traduzir na borda evita um mapeamento manual em toda rota.

UNIDADES, sem exceção: dinheiro em CENTAVOS inteiros, taxa e percentual em
BASIS POINTS inteiros (250 = 2,50%).
"""

CriticidadeTipo = Literal["essencial", "com_garantia", "juros_abusivos", "consumo"]
SituacaoDivida = Literal["ativa", "quitada", "renegociada"]
StatusExtracao = Literal["processando", "concluida", "falhou"]
Confianca = Literal["alta", "media", "baixa"]

# A MODALIDADE do crédito, que é coisa diferente de `CriticidadeTipo`: aquele
# classifica pela consequência de não pagar, este diz que produto é. A revisão
# de cobrança (M6) precisa do segundo — teto de juros de consignado só se aplica
# a consignado, e nada em `Divida` dizia isso antes.
ModalidadeCredito = Literal[
    "consignado_inss",
    "consignado_privado",
    "cartao_consignado",
    "pessoal",
    "rotativo",
    "financiamento",
]


class Camel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class NovaDivida(Camel):
    credor: str = Field(min_length=1, max_length=200)
    valorCobrado: int = Field(gt=0)
    dataOrigem: date
    tipo: CriticidadeTipo
    taxaJurosMensal: int | None = Field(default=None, ge=0)
    extracaoId: str | None = None

    # Os dois andam juntos: com ambos, o backend gera o cronograma. Com só um,
    # a requisição é rejeitada — gerar parcelas sem data, ou guardar uma data
    # sem cronograma, produz meia informação.
    totalParcelas: int | None = Field(default=None, gt=0, le=480)
    primeiroVencimento: date | None = None


class PatchDivida(Camel):
    credor: str | None = Field(default=None, min_length=1, max_length=200)
    valorCobrado: int | None = Field(default=None, gt=0)
    dataOrigem: date | None = None
    tipo: CriticidadeTipo | None = None
    taxaJurosMensal: int | None = Field(default=None, ge=0)


class QuitacaoInput(Camel):
    dataQuitacao: date
    valorPago: int = Field(ge=0)


class Divida(Camel):
    id: str
    credor: str
    valorCobrado: int
    dataOrigem: date
    tipo: CriticidadeTipo

    # Ausente significa "não calculado", jamais zero. É o que o front exibe
    # como "ainda não calculado".
    valorCorrigido: int | None = None
    possivelPrescricao: bool | None = None

    situacao: SituacaoDivida = "ativa"
    saldoDevedor: int | None = None
    taxaJurosMensal: int | None = None
    totalParcelas: int | None = None
    parcelasPagas: int | None = None
    proximoVencimento: date | None = None


class ListaDividas(Camel):
    dividas: list[Divida]


class RespostaDivida(Camel):
    divida: Divida


SituacaoParcela = Literal["pendente", "paga", "atrasada"]


class Parcela(Camel):
    id: str
    numero: int
    total: int
    valor: int
    vencimento: date
    # Derivada NO BACKEND. O fuso do aparelho não decide o que está atrasado.
    situacao: SituacaoParcela
    pagoEm: date | None = None
    valorPago: int | None = None


class ListaParcelas(Camel):
    parcelas: list[Parcela]


class RespostaParcela(Camel):
    parcela: Parcela


class PagamentoInput(Camel):
    pagoEm: date
    valorPago: int = Field(ge=0)


class RenegociacaoInput(Camel):
    novoValor: int = Field(gt=0)
    novoTotalParcelas: int = Field(gt=0, le=480)
    novaTaxaJurosMensal: int | None = Field(default=None, ge=0)
    primeiroVencimento: date
    observacao: str | None = Field(default=None, max_length=500)


class Lembrete(Camel):
    """
    Um aviso a agendar no aparelho.

    `dataLembrete` é DATA, não instante: o servidor decide o QUE e o QUAL DIA;
    o aparelho compõe a hora local a partir da preferência do usuário. Mandar
    um instante UTC daqui faria a notificação tocar na hora errada para
    qualquer fuso diferente do servidor.

    `titulo` e `corpo` vêm prontos para não haver formatação de moeda duplicada
    entre servidor e cliente.
    """

    id: str
    dividaId: str
    parcelaId: str
    titulo: str
    corpo: str
    dataLembrete: date


class ListaLembretes(Camel):
    lembretes: list[Lembrete]
    horaLembrete: str


class PerfilFinanceiro(Camel):
    rendaMensal: int | None = Field(default=None, ge=0)
    dependentes: int | None = Field(default=None, ge=0)
    horaLembrete: str = Field(default="09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    diasAntecedenciaLembrete: int = Field(default=3, ge=0, le=30)


class RespostaPerfil(Camel):
    perfil: PerfilFinanceiro


class TotalPorCriticidade(Camel):
    tipo: CriticidadeTipo
    total: int
    quantidade: int


class VencimentoProximo(Camel):
    dividaId: str
    credor: str
    valor: int
    vencimento: date
    situacao: Literal["pendente", "paga", "atrasada"]


class PontoEvolucao(Camel):
    mes: str
    saldo: int


class ResumoDividas(Camel):
    totalDevido: int
    totalQuitadoNoAno: int
    quantidadeDividas: int
    custoMedioJurosMensal: int | None = None

    rendaMensal: int | None = None
    comprometimentoRenda: int | None = None
    minimoExistencial: int | None = None
    margemDisponivel: int | None = None

    porCriticidade: list[TotalPorCriticidade]
    proximosVencimentos: list[VencimentoProximo]
    evolucaoSaldo: list[PontoEvolucao]


class RespostaResumo(Camel):
    resumo: ResumoDividas


EstrategiaQuitacao = Literal["avalanche", "bola_de_neve"]


class SimulacaoInput(Camel):
    aporteExtraMensal: int = Field(ge=0)
    # O front sempre pede as duas: a comparação é a mensagem da tela.
    estrategias: list[EstrategiaQuitacao] = Field(min_length=1, max_length=2)
    # None significa todas as dívidas ativas.
    dividasIds: list[str] | None = None


class ItemOrdemPagamento(Camel):
    dividaId: str
    credor: str
    posicao: int
    quitadaEm: str  # YYYY-MM
    jurosPagos: int


class Simulacao(Camel):
    estrategia: EstrategiaQuitacao
    mesesAteQuitacao: int
    dataLiberdade: str  # YYYY-MM
    totalJurosPagos: int
    totalPago: int
    # Nulo quando o cenário de pagar só o mínimo não quita dentro do teto: sem
    # o outro lado da comparação, não há economia a afirmar.
    economiaVsMinimo: int | None = None
    ordemPagamento: list[ItemOrdemPagamento]
    evolucaoSaldo: list[PontoEvolucao]


class ComparacaoEstrategias(Camel):
    """
    A diferença entre as duas estratégias, CALCULADA AQUI de propósito.

    Se o front subtraísse `totalJurosPagos` de uma simulação da outra, teria
    replicado uma regra de negócio — e a diferença é justamente a mensagem
    central da tela. Ela precisa ter uma única origem.
    """

    melhorEstrategia: EstrategiaQuitacao
    diferencaJuros: int
    diferencaMeses: int


class DividaSemTaxa(Camel):
    """
    Dívida que entrou na simulação sem taxa conhecida.

    Ela é amortizada normalmente, mas NENHUM juro é projetado sobre ela, e na
    avalanche vai para o fim da fila. A tela nomeia essas dívidas: um prazo
    calculado sem os juros de parte do endividamento é otimista, e o usuário
    tem de saber disso para decidir se completa o cadastro.
    """

    dividaId: str
    credor: str


class RespostaSimulacao(Camel):
    simulacoes: list[Simulacao]
    comparacao: ComparacaoEstrategias | None = None
    dividasSemTaxa: list[DividaSemTaxa]


class CampoExtraido[T](Camel):
    """
    Todo campo extraído carrega a evidência que o sustenta.

    `valor` nulo significa "não encontrei". Campo com valor e SEM `trecho` é
    zerado antes de sair da rota (guardrail 8.1): número sem evidência citável
    é palpite do modelo, e o front o descartaria de qualquer forma.
    """

    valor: T | None = None
    confianca: Confianca = "baixa"
    trecho: str | None = None
    pagina: int | None = None


class CamposContrato(Camel):
    credor: CampoExtraido[str]
    valorCobrado: CampoExtraido[int]
    dataOrigem: CampoExtraido[date]
    tipo: CampoExtraido[CriticidadeTipo]
    taxaJurosMensal: CampoExtraido[int]
    totalParcelas: CampoExtraido[int]
    cet: CampoExtraido[int]

    # Os ENCARGOS, que existem para a revisão de cobrança (M6): é neles que mora
    # a cobrança contestável de um consignado. Como todo campo daqui é
    # `CampoExtraido`, `limpar_campos_sem_evidencia()` os alcança de graça — e o
    # achado derivado deles nasce, portanto, com trecho literal do contrato.
    # `default_factory` e não default direto: instância de modelo compartilhada
    # entre objetos seria estado mutável comum. E ter default é o que faz um
    # `campos_json` gravado ANTES do M6 continuar carregando — a coluna é texto,
    # e extração antiga não tem estes campos.
    modalidade: CampoExtraido[ModalidadeCredito] = Field(
        default_factory=CampoExtraido[ModalidadeCredito]
    )
    tarifaCadastro: CampoExtraido[int] = Field(default_factory=CampoExtraido[int])
    seguroPrestamista: CampoExtraido[int] = Field(default_factory=CampoExtraido[int])
    iof: CampoExtraido[int] = Field(default_factory=CampoExtraido[int])
    multaMoratoriaMensal: CampoExtraido[int] = Field(default_factory=CampoExtraido[int])


class AlertaContrato(Camel):
    id: str
    titulo: str
    explicacao: str
    trecho: str | None = None
    pagina: int | None = None


class ExtracaoContrato(Camel):
    id: str
    status: StatusExtracao
    erro: str | None = None
    campos: CamposContrato | None = None
    alertas: list[AlertaContrato] | None = None


class RespostaExtracao(Camel):
    extracao: ExtracaoContrato


class Achado(Camel):
    """
    Um ponto do contrato que vale contestar, com a fonte que o sustenta.

    `valorContestavel` nulo é o achado que aparece na tela e NÃO entra na
    subtração de `valorJusto` — quantificá-lo exigiria reamortizar o contrato,
    o que seria estimativa disfarçada de apuração (ADR 0008).
    `evidencia` é o trecho literal do contrato, ausente quando o achado não
    nasceu da extração.
    """

    id: str
    titulo: str
    explicacao: str
    fonte: str
    comoConferir: str
    valorContestavel: int | None = None
    evidencia: str | None = None


class RevisaoCobranca(Camel):
    """
    `valorJusto` é `valorCobrado` menos a soma dos achados COM valor.

    Nulo quando nenhum achado tem valor — nunca igual a `valorCobrado`, porque
    isso diria "conferimos e está tudo certo", afirmação que não temos como
    fazer. `economia` não viaja: o cliente a calcula, e é a única subtração que
    o guardrail 1.2 lhe permite.
    """

    dividaId: str
    credor: str
    valorCobrado: int
    valorJusto: int | None = None
    achados: list[Achado]
    script: str | None = None
    fundamentos: list[str]
    baseLegalVigenteEm: str | None = None


class RespostaRevisao(Camel):
    revisao: RevisaoCobranca


class SendMessageRequest(Camel):
    content: str


class DividaResumoCard(Camel):
    """
    Retrato de uma dívida dentro da conversa.

    TODO valor aqui é preenchido pela rota, a partir do banco. O assistente
    escolheu qual dívida mostrar; ele não escreveu nenhum destes números.
    """

    kind: Literal["divida_resumo"] = "divida_resumo"
    dividaId: str
    credor: str
    saldoDevedor: int | None = None
    proximoVencimento: date | None = None
    situacao: SituacaoDivida
    criticidade: CriticidadeTipo


class ValorJustoCard(Camel):
    """
    Os pontos contestáveis de uma dívida, dentro da conversa.

    Mesmo regime do `divida_resumo`: o assistente escolheu QUAL dívida; quem
    preenche os valores é a rota, chamando `domain/revisao.py`. A rota só emite
    este card quando existe achado COM valor — sem `valorJusto` não há o que
    mostrar aqui, e o card não sai (ADR 0008).

    `dividaId` existe para o deep link até a tela de revisão, por campo tipado —
    nunca id extraído do texto.
    """

    kind: Literal["valor_justo"] = "valor_justo"
    dividaId: str
    credor: str
    valorCobrado: int
    valorJusto: int
    script: str
    fundamentos: list[str]


class PlanoSugeridoCard(Camel):
    """Plano de quitação na conversa. Os números vêm de domain/simulacao.py."""

    kind: Literal["plano_sugerido"] = "plano_sugerido"
    estrategia: EstrategiaQuitacao
    aporteExtraMensal: int
    mesesAteQuitacao: int
    dataLiberdade: str
    economia: int | None = None


class DividaPropostaCard(Camel):
    """
    Rascunho de cadastro ou de alteração, para a pessoa confirmar na tela.

    ÚNICO card cujos valores NÃO vêm do banco — vêm da fala dela na conversa
    (guardrail 7.2: escrita reversível exige o formulário preenchido e o toque
    dela). Nada aqui é afirmação do assistente, e nada aqui foi gravado.

    `dividaId` ausente é cadastro novo; presente é alteração daquela dívida.
    Todo campo é opcional: ausente significa "ela não disse", nunca zero.
    """

    kind: Literal["divida_proposta"] = "divida_proposta"
    dividaId: str | None = None
    # Nome ATUAL da dívida no banco, só na alteração. Serve para o card dizer
    # qual dívida vai mudar — separado de `credor`, que é o valor PROPOSTO e
    # pode ser justamente a correção do nome.
    dividaCredor: str | None = None
    credor: str | None = Field(default=None, min_length=1, max_length=200)
    valorCobrado: int | None = Field(default=None, gt=0)
    dataOrigem: date | None = None
    tipo: CriticidadeTipo | None = None
    taxaJurosMensal: int | None = Field(default=None, gt=0)
    totalParcelas: int | None = Field(default=None, gt=0, le=480)
    primeiroVencimento: date | None = None


class MensagemChat(Camel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    cards: list[DividaResumoCard | PlanoSugeridoCard | DividaPropostaCard] = Field(
        default_factory=list
    )
    createdAt: datetime


class RespostaMensagem(Camel):
    message: MensagemChat


class HistoricoChat(Camel):
    mensagens: list[MensagemChat]


class Erro(Camel):
    """
    Formato de erro que o cliente sabe ler. `message` é exibida DIRETO ao
    usuário (src/api/client.ts), então é pt-BR, para leigo, e nunca carrega
    valor, credor ou qualquer dado sensível.
    """

    message: str
    campo: str | None = None


# --- Módulo de caixa (M7) ----------------------------------------------------

TipoFonteRenda = Literal["pj_hora", "clt", "autonomo", "beneficio", "aluguel", "outro"]
CategoriaGasto = Literal[
    "moradia", "alimentacao", "transporte", "contas", "saude", "dependentes", "outros"
]
OrigemRenda = Literal["informada", "pior_mes_registrado"]
NivelPreenchimento = Literal["vazio", "nivel_0", "nivel_1"]


class Caixa(Camel):
    """
    A cascata inteira, calculada em `domain/caixa.py`. O cliente formata e
    exibe; não soma nada (ADR 0003).
    """

    rendaBrutaTipica: int
    origemRenda: OrigemRenda
    impostoReservado: int
    rendaLiquida: int
    essenciais: int
    naoEssenciais: int
    provisaoMensal: int
    aporteReserva: int
    aporteAposentadoria: int
    comprometidoDividas: int
    # Podem ser NEGATIVAS, e o negativo é a informação — sem `ge=0` de propósito.
    capacidadeHoje: int
    capacidadeMaxima: int
    aporteMaximo: int
    minimoExistencial: int | None = None
    minimoExistencialVigenteEm: str | None = None
    # `None` quando não há piso configurado: um `False` diria "conferimos e está
    # tudo bem", que é afirmação diferente de "não sabemos".
    abaixoDoPiso: bool | None = None
    # FATO ARITMÉTICO, não diagnóstico. Nunca se chama `superendividado`: a
    # definição legal (CDC art. 54-A, § 1º) exige boa-fé e dívida de consumo, e
    # nenhum dos dois é apurável por software.
    naoFecha: bool
    preenchimento: NivelPreenchimento


class RespostaCaixa(Camel):
    caixa: Caixa


class NovaFonteRenda(Camel):
    nome: str = Field(min_length=1, max_length=120)
    tipo: TipoFonteRenda
    valorTipicoInformado: int | None = Field(default=None, ge=0)
    variavel: bool = False
    ativo: bool = True


class FonteRendaPatch(Camel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    tipo: TipoFonteRenda | None = None
    valorTipicoInformado: int | None = Field(default=None, ge=0)
    variavel: bool | None = None
    ativo: bool | None = None


class FonteRenda(NovaFonteRenda):
    id: str


class RespostaFonteRenda(Camel):
    fonte: FonteRenda


class ListaFontesRenda(Camel):
    fontes: list[FonteRenda]


class NovoRecebimento(Camel):
    mes: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    valor: int = Field(ge=0)


class Recebimento(NovoRecebimento):
    id: str


class RespostaRecebimento(Camel):
    recebimento: Recebimento


class NovoGasto(Camel):
    descricao: str = Field(min_length=1, max_length=120)
    categoria: CategoriaGasto
    # Quem classifica é o USUÁRIO: o que é cortável na vida de alguém não é
    # decisão do app.
    essencial: bool = True
    fixo: bool = True
    valorMensal: int = Field(ge=0)
    ativo: bool = True


class GastoPatch(Camel):
    descricao: str | None = Field(default=None, min_length=1, max_length=120)
    categoria: CategoriaGasto | None = None
    essencial: bool | None = None
    fixo: bool | None = None
    valorMensal: int | None = Field(default=None, ge=0)
    ativo: bool | None = None


class Gasto(NovoGasto):
    id: str


class RespostaGasto(Camel):
    gasto: Gasto


class ListaGastos(Camel):
    gastos: list[Gasto]


class NovaProvisao(Camel):
    descricao: str = Field(min_length=1, max_length=120)
    valorAnual: int = Field(ge=0)
    mesVencimento: int = Field(ge=1, le=12)
    saldoAcumulado: int = Field(default=0, ge=0)
    ativa: bool = True


class ProvisaoPatch(Camel):
    descricao: str | None = Field(default=None, min_length=1, max_length=120)
    valorAnual: int | None = Field(default=None, ge=0)
    mesVencimento: int | None = Field(default=None, ge=1, le=12)
    saldoAcumulado: int | None = Field(default=None, ge=0)
    ativa: bool | None = None


class Provisao(NovaProvisao):
    id: str
    # DERIVADOS no servidor: o aporte divide o que falta pelos meses que faltam
    # até o vencimento, nunca por 12 fixo.
    aporteMensal: int
    mesesRestantes: int


class RespostaProvisao(Camel):
    provisao: Provisao


class ListaProvisoes(Camel):
    provisoes: list[Provisao]


class MetasCaixa(Camel):
    """
    Todos opcionais, e a ausência é significativa em cada um (ADR 0009):
    sem `impostoBps` nada é reservado e a tela diz isso; sem
    `rendimentoEsperadoBps` nenhuma comparação dívida × investimento aparece.
    """

    impostoBps: int | None = Field(default=None, ge=0, le=10000)
    reservaMetaMeses: int | None = Field(default=None, ge=0, le=60)
    reservaSaldo: int | None = Field(default=None, ge=0)
    # O único dos três de reserva que entra na cascata: saldo é o que já existe,
    # meta é aonde se quer chegar, aporte é o que sai do mês.
    reservaAporte: int | None = Field(default=None, ge=0)
    aposentadoriaAporte: int | None = Field(default=None, ge=0)
    rendimentoEsperadoBps: int | None = Field(default=None, ge=0, le=10000)


class RespostaMetas(Camel):
    metas: MetasCaixa


class SnapshotCaixa(Camel):
    id: str
    calculadoEm: datetime
    rendaBrutaTipica: int
    rendaLiquida: int
    essenciais: int
    capacidadeHoje: int
    capacidadeMaxima: int
    aporteMaximo: int
    naoFecha: bool


class HistoricoCaixa(Camel):
    snapshots: list[SnapshotCaixa]
