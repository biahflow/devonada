from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

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


# --- Negociação por canal e registro de resultado (M12, F-012, ADR 0021) -----
#
# `Canal` é o mesmo conceito do módulo `domain/script.py`, redeclarado aqui pelo
# mesmo motivo de `TipoDeMarco` mais abaixo: o contrato de API não importa do
# domínio, e o domínio não conhece o Pydantic. São três valores e o mesmo motor
# de valor justo produz os três — muda o formato, nunca o número (docs/domain.md,
# verbete `canal`).
Canal = Literal["telefone", "chat", "email"]

# O DESFECHO da conversa, e não do contrato: `acordo` é o único que mexe nas
# parcelas (por `Renegociacao`); `recusa`, `contraproposta` e `sem_resposta` são
# metade da informação do benchmark, e hoje não têm onde ser registrados
# (ADR 0021, item 6).
DesfechoNegociacao = Literal["acordo", "recusa", "contraproposta", "sem_resposta"]


class RegistroNegociacaoInput(Camel):
    """
    O que aconteceu na conversa com o credor.

    `valorProposto` e `valorObtido` são OPCIONAIS de propósito: registrar uma
    recusa ou um silêncio não pode exigir preencher valor de acordo — obrigar
    valor recriaria o viés que a entidade nova existe para desfazer ("o dado de
    benchmark nasce enviesado se só o acordo fechado for registrado").

    `renegociacaoId` só faz sentido no `acordo`, ligando esta conversa ao acordo
    que ela produziu (`POST /v1/dividas/{id}/renegociacao`, que reescreve as
    parcelas). Nos demais desfechos ele é recusado: apontar um acordo num
    resultado que não teve acordo seria dado contraditório.
    """

    canal: Canal
    desfecho: DesfechoNegociacao
    valorProposto: int | None = Field(default=None, ge=0)
    valorObtido: int | None = Field(default=None, ge=0)
    renegociacaoId: str | None = Field(default=None, max_length=36)
    observacao: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _renegociacao_so_no_acordo(self) -> "RegistroNegociacaoInput":
        if self.renegociacaoId is not None and self.desfecho != "acordo":
            raise ValueError(
                "renegociacaoId só pode ser informado quando o desfecho é acordo."
            )
        return self


class ResultadoNegociacao(Camel):
    """Um resultado de negociação registrado, como sai da rota de leitura."""

    id: str
    dividaId: str
    canal: Canal
    desfecho: DesfechoNegociacao
    valorProposto: int | None = None
    valorObtido: int | None = None
    renegociacaoId: str | None = None
    observacao: str | None = None
    registradoEm: datetime


class RespostaResultadoNegociacao(Camel):
    resultado: ResultadoNegociacao


class ListaResultadosNegociacao(Camel):
    """
    O histórico de negociações — da dívida ou do tenant inteiro.

    É a leitura que hoje NÃO existe: `orm.Renegociacao` nunca teve schema de
    saída, e sem leitura não há benchmark. Este contrato devolve o dado do
    PRÓPRIO tenant; agregar entre tenants é decisão de produto e de privacidade
    que ninguém tomou (fora de escopo por contrato).
    """

    resultados: list[ResultadoNegociacao]


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
    # Dia do mês do lembrete de fechamento. `None` é desligado. Limitado a 28
    # porque 29, 30 e 31 não existem em todo mês, e um lembrete que some em
    # fevereiro é pior que um lembrete um dia antes.
    fechamentoDiaDoMes: int | None = Field(default=None, ge=1, le=28)


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

    # Centavos POR DIA. Ausente enquanto nenhuma ativa tem taxa — nunca zero por
    # falta de dado, que afirmaria que a dívida não cresce. Zero só sai quando a
    # conta deu zero: taxa zero informada, ou juros abaixo de um centavo ao dia.
    custoDiarioJuros: int | None = None
    # Quantas ativas estão sem taxa conhecida. Maior que zero ⇒ `custoDiarioJuros`
    # é PISO, não total. Os dois viajam juntos de propósito: um piso apresentado
    # como total é subestimação silenciosa, que é o que este par existe para
    # impedir (mesma disciplina de `dividasSemTaxa` na simulação).
    quantidadeDividasSemTaxa: int = 0

    rendaMensal: int | None = None
    comprometimentoRenda: int | None = None
    minimoExistencial: int | None = None
    margemDisponivel: int | None = None

    porCriticidade: list[TotalPorCriticidade]
    proximosVencimentos: list[VencimentoProximo]
    evolucaoSaldo: list[PontoEvolucao]

    # O MAIOR saldo já registrado em `saldo_snapshot` para o tenant — não
    # `evolucaoSaldo[0]`, que é recortada pelo mês selecionado e pelos últimos
    # 12 pontos. É a base que não anda para trás quando o usuário cadastra uma
    # dívida nova ou troca o mês consultado (ADR 0019, item 4). `None` sem
    # histórico.
    saldoInicialDaRota: int | None = None
    # `saldoInicialDaRota` percorrido, em basis points, com piso em zero.
    # `None` sem histórico; nunca negativo (`domain/resumo.rota_percorrida_bps`).
    rotaPercorridaBps: int | None = None


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
    # O plano passa dos 5 anos que o CDC, art. 104-A, fixa como prazo máximo do
    # plano apresentado numa repactuação judicial. É INFORMAÇÃO, não impedimento:
    # plano mais longo não é ilegal, mas saber que existe um teto legal para o
    # caminho judicial muda a conversa com o credor.
    acimaDoPrazoDeRepactuacao: bool = False
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


# --- Script de negociação por canal (M12, F-012, ADR 0021) -------------------
#
# O script deixou de ser uma STRING ÚNICA e virou blocos tipados por canal. A
# forma é espelho de `domain/script.BlocoScript`, redeclarada aqui pelo mesmo
# motivo de `Canal` e `TipoDeMarco`: o contrato não importa do domínio. O
# `momento` é o que a tela usa para separar VISUALMENTE segurança de contestação
# — texto de alerta e texto de argumento mal separados leem como "a dívida tem
# problema" quando ninguém disse isso.
MomentoScript = Literal["abertura", "argumento", "oferta", "fechamento"]


class BlocoScript(Camel):
    """
    Um pedaço do script. `copiavel` é `True` só nos canais escritos, onde cada
    bloco tem botão de copiar próprio (guardrail 1.2): a tela nunca entrega um
    texto único que alguém precise fatiar à mão para mandar em mensagens
    separadas.
    """

    id: str
    titulo: str | None = None
    texto: str
    momento: MomentoScript
    copiavel: bool


class ScriptNegociacao(Camel):
    """
    O script inteiro para um canal: os blocos, na ordem em que se falam ou se
    mandam, mais o canal que os produziu. O `valorJusto` e os achados são
    IDÊNTICOS nos três canais — só o formato e o momento da oferta mudam
    (ADR 0021, item 5).
    """

    canal: Canal
    blocos: list[BlocoScript]


class RevisaoCobranca(Camel):
    """
    `valorJusto` é `valorCobrado` menos a soma dos achados COM valor.

    Nulo quando nenhum achado tem valor — nunca igual a `valorCobrado`, porque
    isso diria "conferimos e está tudo certo", afirmação que não temos como
    fazer. `economia` não viaja: o cliente a calcula, e é a única subtração que
    o guardrail 1.2 lhe permite.

    `script` NÃO é mais nulável: `montar_script` deixou de devolver `None` sem
    achado, porque a validação de canal é SEGURANÇA, não argumento de negociação
    — quem cadastrou a dívida na mão recebe o script mínimo de segurança (alerta
    + regra de pagamento), sem nenhuma afirmação sobre valor (ADR 0021).
    """

    dividaId: str
    credor: str
    valorCobrado: int
    valorJusto: int | None = None
    achados: list[Achado]
    script: ScriptNegociacao
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
    script: ScriptNegociacao
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
    # RESPIRO (M11, ADR 0019). `None` é "nunca declarou", e NÃO se confunde com
    # `0`: zero declarado é escolha legítima, e não existe default — um
    # percentual de fábrica seria o coeficiente sem fonte que a ADR 0009 proíbe.
    respiro: int | None = None
    # Desativar não é apagar: `False` tira a linha da cascata e preserva o valor
    # e o saldo acumulado.
    respiroAtivo: bool | None = None
    # Com respiro declarado e nada usado é `0`, e o zero AQUI é fato, não
    # ausência.
    respiroUsadoNoMes: int | None = None
    # DERIVADO a cada leitura, nunca persistido: `respiro − usado`, com piso em
    # zero. Valor calculado que dorme em coluna é valor que envelhece errado.
    respiroDisponivelNoMes: int | None = None
    # PERSISTIDO, no molde de `provisao_anual.saldoAcumulado`: respiro não usado
    # acumula em silêncio, sem notificação e sem pergunta (guardrail 4.1).
    respiroSaldoAcumulado: int | None = None
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
    # Quando o usuário confirmou os números pela última vez. `None` nos dois
    # significa que ele nunca fechou um mês — que NÃO é o mesmo que estar
    # atrasado, e por isso `caixaDefasado` também é `None` nesse caso.
    ultimoFechamentoMes: str | None = None
    mesesDesdeFechamento: int | None = None
    caixaDefasado: bool | None = None


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


# --- Respiro (M11, ADR 0019) -------------------------------------------------


class RespiroInput(Camel):
    """
    O valor que o USUÁRIO declara — a fatia para viver enquanto paga.

    SEM DEFAULT, SEM FAIXA E SEM SUGESTÃO. Quem diz o tamanho da fatia é o
    usuário (ADR 0019, item 2); um percentual de fábrica seria o coeficiente de
    alocação sem fonte que a ADR 0009 proíbe pelo nome.

    Sem `ge=0` de propósito: valor negativo é recusado no router, com uma frase
    que diz o que aconteceu. A mensagem genérica do Pydantic ("Confira os dados
    enviados") não diria.
    """

    valorMensal: int
    ativo: bool = True


class Respiro(Camel):
    """
    A linha gravada. `saldoAcumulado` é persistido; o disponível do mês não —
    ele é derivado a cada leitura e viaja em `Caixa`.
    """

    valorMensal: int
    ativo: bool
    saldoAcumulado: int


class RespostaRespiro(Camel):
    respiro: Respiro
    # O PREÇO DA ESCOLHA, em meses a mais de quitação — a única coisa que o app
    # sabe de verdade sobre o valor que a pessoa escolheu. `None` quando não há
    # dívida com dado suficiente para simular: a tela grava sem preço, em vez de
    # exibir palpite.
    custoEmMeses: int | None = None


class NovoUsoDeRespiro(Camel):
    """
    Um gasto de respiro — o sorvete, o cinema, as unhas.

    `descricao` é OPCIONAL E LIVRE: ninguém deve prestação de contas do próprio
    lazer, e o registro existe para a pessoa saber quanto ainda há.
    """

    valor: int = Field(gt=0)
    descricao: str | None = Field(default=None, max_length=120)


class RespostaUsoDeRespiro(Camel):
    """
    O que a tela precisa depois de registrar um uso, e nada além disso.

    NENHUM CAMPO DE ALERTA, AVISO, SINAL DE EXCESSO OU COMPARAÇÃO. "Você já
    gastou R$ 80" é a copy que o guardrail 4.1 proíbe pelo nome; o único
    acompanhamento é quanto ainda há.

    O `id` está aqui porque `DELETE /v1/caixa/respiro/uso/{id}` é inalcançável
    sem ele — não há rota de listagem de usos no contrato, e desfazer um valor
    digitado errado é a razão de o DELETE existir. Identificador do registro que
    acabou de nascer não é juízo sobre o gasto.
    """

    id: str
    respiroDisponivelNoMes: int | None = None


class NovaDestinacaoDeRespiro(Camel):
    valor: int = Field(gt=0)


class RespostaDestinacaoDeRespiro(Camel):
    respiroSaldoAcumulado: int


# --- Marcos (M11, ADR 0019, item 4) ------------------------------------------
#
# A lista dos tipos é ESPELHO de `domain/marcos.TIPOS`, no mesmo desenho de
# `StatusMeta` logo abaixo: o contrato de API não importa do domínio, e o
# domínio não conhece o Pydantic. Há um teste em `test_domain_marcos.py` que
# falha se os dois divergirem — duplicar sem guarda é como um tipo novo entraria
# no domínio e ficaria de fora da resposta.

TipoDeMarco = Literal[
    "primeira_negociacao",
    "primeira_quitacao",
    "rota_25",
    "rota_50",
    "rota_75",
]


class Marco(Camel):
    """
    Uma conquista e seus dois instantes.

    OS DOIS SÃO SEPARADOS DE PROPÓSITO. `atingidoEm` é quando o gatilho ocorreu;
    `celebradoEm`, quando a `MarcoScreen` foi exibida. Sem essa separação a tela
    reapareceria a cada abertura do app — e um marco atingido com o app fechado,
    ou durante o período somente leitura da assinatura, se perderia em vez de
    esperar.

    `atingidoEm` nulo é marco não atingido: a rota devolve os cinco tipos sempre,
    e a ausência é dita, não omitida.
    """

    tipo: TipoDeMarco
    atingidoEm: date | None = None
    celebradoEm: date | None = None


class ListaMarcos(Camel):
    marcos: list[Marco]


# --- Metas nomeadas (/v1/metas) ---
#
# COISA DIFERENTE DE `MetasCaixa` LOGO ACIMA, e o nome colidir é dívida assumida
# na ADR 0017. `MetasCaixa` são os seis potes fixos que entram na cascata do
# fechamento; `Meta` é uma coleção livre que a pessoa cria e apaga, e que não
# entra em cálculo de capacidade nenhum. Na tela, os potes se chamam "Seus
# potes" e as metas se chamam "Suas metas".

StatusMeta = Literal["em_dia", "aporte_baixo", "atingida"]

MesAlvo = Annotated[str, StringConstraints(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]


class NovaMeta(Camel):
    nome: str = Field(min_length=1, max_length=120)
    emoji: str | None = Field(default=None, max_length=8)
    valorAlvo: int = Field(gt=0)
    saldo: int = Field(default=0, ge=0)
    # Os dois opcionais, e a ausência é significativa: sem prazo não existe
    # aporte sugerido, e sem aporte declarado não existe status. Ver
    # domain/metas.py.
    dataAlvo: MesAlvo | None = None
    aporteMensal: int | None = Field(default=None, ge=0)
    ativa: bool = True


class MetaPatch(Camel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    emoji: str | None = Field(default=None, max_length=8)
    valorAlvo: int | None = Field(default=None, gt=0)
    saldo: int | None = Field(default=None, ge=0)
    dataAlvo: MesAlvo | None = None
    aporteMensal: int | None = Field(default=None, ge=0)
    ativa: bool | None = None


class Meta(NovaMeta):
    id: str
    # DERIVADOS, calculados a cada resposta e nunca persistidos: valor calculado
    # que dorme em coluna é valor que envelhece errado. `None` quando falta prazo
    # (ou, no status, quando falta o aporte declarado) — a tela então não afirma
    # nada, em vez de afirmar um palpite. ADR 0003.
    aporteSugerido: int | None = None
    status: StatusMeta | None = None


class RespostaMeta(Camel):
    meta: Meta


class ListaMetas(Camel):
    metas: list[Meta]


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


# --- Fechamento do mês -------------------------------------------------------

OrigemDoValor = Literal["mes_anterior", "valor_atual", "sem_referencia"]
TipoItemFechamento = Literal["recebimento", "gasto"]


class ItemFechamento(Camel):
    """
    Uma linha da proposta de fechamento.

    `valorSugerido` é `None` quando não há de onde tirar referência — campo
    vazio, NUNCA zero. Zero afirmaria que a pessoa não recebeu nada, que é
    diferente de "não sabemos quanto ela recebeu".

    `origem` viaja para a tela poder dizer de onde veio o número, no mesmo
    espírito de `origemRenda`. Um número pré-preenchido sem procedência visível
    é indistinguível de um número inventado.
    """

    tipo: TipoItemFechamento
    id: str
    descricao: str
    valorSugerido: int | None = None
    origem: OrigemDoValor
    # Só para `origem == "mes_anterior"`: qual mês, para a tela escrever.
    mesDeReferencia: str | None = None


class PropostaFechamento(Camel):
    mes: str
    itens: list[ItemFechamento]


class ItemConfirmado(Camel):
    tipo: TipoItemFechamento
    id: str
    valor: int = Field(ge=0)


class ConfirmacaoFechamento(Camel):
    """
    O que o usuário confirmou — e só isso é gravado.

    Item omitido não vira zero e não é gravado: quem não confirmou uma linha não
    afirmou que ela é zero. Mesma disciplina do `extracaoParaProposta`, que
    descarta campo sem evidência mesmo trazendo valor.
    """

    mes: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    itens: list[ItemConfirmado]


class RespostaFechamento(Camel):
    proposta: PropostaFechamento


class RespostaConfirmacao(Camel):
    caixa: Caixa


# --- M8 · conta de usuário (ADR 0012) -------------------------------------

# Mínimo de senha. Oito caracteres sem exigência de símbolo, maiúscula ou
# dígito: regras de composição empurram a pessoa para "Senha@123", que é pior
# que uma frase longa. O que protege de verdade aqui é o bcrypt com custo 12
# mais a trava de tentativas, não o teatro de complexidade.
SENHA_MINIMA = 8


class Sessao(Camel):
    """
    O par de tokens. `acesso` é JWT de 15 min; `refresh` é opaco, de 30 dias.

    O servidor guarda só o HASH do refresh — o valor existe uma vez, nesta
    resposta, e depois só no `expo-secure-store` do aparelho.
    """

    acesso: str
    refresh: str
    expiraEm: datetime


class RespostaSessao(Camel):
    sessao: Sessao


# O e-mail é APARADO ANTES de ser validado.
#
# Teclado de celular completa o campo e deixa um espaço no fim, e a autocorreção
# manda a primeira letra maiúscula. Validar antes de aparar recusaria com 422 um
# e-mail que a pessoa digitou certo, e ela não teria como ver o espaço na tela.
# `strip` no schema, minúsculas na rota: o primeiro é forma, o segundo é
# identidade.
#
# `EmailStr` do pydantic exigiria `email-validator` como dependência nova para
# uma validação em que o servidor não pode confiar de qualquer forma — o que
# prova o e-mail é o código de recuperação chegar nele.
Email = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=320)]
EmailValidado = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=3,
        max_length=320,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    ),
]


class NovaConta(Camel):
    email: EmailValidado
    senha: str = Field(min_length=SENHA_MINIMA, max_length=200)


class Credenciais(Camel):
    """
    O login NÃO valida formato nem tamanho — de propósito.

    Recusar com 422 uma senha de três caracteres contaria que as senhas deste
    servidor têm pelo menos oito, e recusar um e-mail malformado antes de
    consultar o banco daria uma resposta mais rápida para entrada inválida que
    para e-mail inexistente. Toda credencial que não confere sai pela mesma
    porta: 401, com a mesma frase.
    """

    email: Email
    senha: str = Field(min_length=1, max_length=200)


class PedidoRefresh(Camel):
    refresh: str = Field(min_length=1, max_length=200)


class PedidoLogout(Camel):
    """`refresh` ausente revoga TODAS as sessões — o "sair de todos os aparelhos"."""

    refresh: str | None = Field(default=None, max_length=200)


class PedidoRecuperacao(Camel):
    email: Email


class PedidoRedefinicao(Camel):
    email: Email
    codigo: str = Field(pattern=r"^\d{6}$")
    senha: str = Field(min_length=SENHA_MINIMA, max_length=200)


class PedidoExclusaoDeConta(Camel):
    """
    A senha de novo, além do Bearer.

    Exclusão é irreversível, e um celular desbloqueado esquecido na mesa não
    pode apagar a vida financeira de alguém em dois toques.
    """

    senha: str = Field(min_length=1, max_length=200)


# --------------------------------------------------------------------------- #
# Assinatura (M9, ADR 0013)
# --------------------------------------------------------------------------- #

StatusAssinatura = Literal["em_teste", "ativa", "expirada"]
Plataforma = Literal["ios", "android"]


class SituacaoAssinatura(Camel):
    """
    Até quando esta conta pode escrever, e por qual motivo.

    `podeEscrever` é REDUNDANTE em relação a `status`, e é assim de propósito: o
    cliente não deve reimplementar a regra "expirada é o único que bloqueia". No
    dia em que aparecer um quarto status — período de graça, cobrança em nova
    tentativa —, o app instalado que não atualizou continua acertando, porque a
    resposta já vem decidida. Mesma disciplina de `situacao` em `Divida`, que o
    front exibe sem recalcular.

    NÃO HÁ PREÇO AQUI. Ele vem da loja pelo SDK, já localizado em moeda e
    formato — é exigência das duas, e preço servido daqui mentiria para quem
    está em outro país.
    """

    status: StatusAssinatura
    podeEscrever: bool
    expiraEm: datetime
    diasRestantes: int

    # Só quando há compra: quem está no teste ainda não tem produto nenhum.
    produtoId: str | None = None
    renovacaoAutomatica: bool | None = None


class PedidoCompra(Camel):
    """
    O recibo que a loja entregou ao app.

    O CONTEÚDO DELE NÃO É FONTE DA VERDADE — ver o docstring de
    `loja/apple.py:conferir`. Ele é chave de busca; quem afirma até quando a
    assinatura vale é a loja, consultada pelo servidor. Por isso não há
    `expiraEm` nem `produtoId` neste corpo: aceitá-los do cliente seria deixar o
    aparelho declarar a própria validade.
    """

    plataforma: Plataforma
    recibo: str = Field(min_length=1, max_length=8000)
