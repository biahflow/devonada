/**
 * Tipos de domínio compartilhados com o backend.
 * Espelham o modelo do Postgres (multi-tenant): todo recurso pertence a um
 * tenant, mas o tenant vem do token de auth — o cliente não o envia.
 */
export type Uuid = string;
export type IsoDate = string;
/** Mês no formato `YYYY-MM`. */
export type IsoMes = string;

/** Triagem por criticidade (Fase 1). */
export type CriticidadeTipo =
  | 'essencial' // água, luz, aluguel — nunca sacrificar
  | 'com_garantia' // financiamento de casa/carro — risco de perder o bem
  | 'juros_abusivos' // rotativo, cheque especial — atacar primeiro
  | 'consumo'; // varejo, cartão comum

export type SituacaoDivida = 'ativa' | 'quitada' | 'renegociada';

export interface Divida {
  id: Uuid;
  credor: string;
  /** valor cobrado, em centavos */
  valorCobrado: number;
  dataOrigem: IsoDate;
  tipo: CriticidadeTipo;
  /** calculado no backend (determinístico), em centavos */
  valorCorrigido?: number;
  /** ALERTA para investigar, nunca uma afirmação de que prescreveu */
  possivelPrescricao?: boolean;

  /* --- M1: opcionais até o backend passar a enviá-los. Ausente NÃO é zero:
     a UI exibe "ainda não calculado", nunca R$ 0,00. --- */

  situacao?: SituacaoDivida;
  /** quanto ainda falta pagar, em centavos */
  saldoDevedor?: number;
  /**
   * Basis points inteiros: 250 = 2,50% a.m. Taxa é dinheiro disfarçado —
   * float aqui sofreria da mesma imprecisão que os centavos resolvem.
   */
  taxaJurosMensal?: number;
  totalParcelas?: number;
  parcelasPagas?: number;
  proximoVencimento?: IsoDate;
}

/* ---------- Chat ---------- */

export type ChatRole = 'user' | 'assistant';

/**
 * Cards de ação embutidos numa mensagem do assistente. União discriminada.
 *
 * Todo número que o assistente comunica chega AQUI, em campo tipado, nunca no
 * `content` da mensagem (guardrail 7.1). O dispatcher `ActionCard` trata a
 * união de forma exaustiva, então acrescentar um `kind` sem tratá-lo é erro de
 * compilação, não um card que some em silêncio na tela.
 */
export type ActionCardData =
  | ValorJustoCardData
  | InfoCardData
  | DividaResumoCardData
  | PlanoSugeridoCardData
  | DividaPropostaCardData;

/**
 * Os pontos contestáveis de uma dívida, dentro da conversa (M6).
 *
 * `valorJusto` NÃO é estimativa: é `valorCobrado` menos a soma dos achados que
 * têm valor, cada um com fonte legal própria (ADR 0008). O backend só emite este
 * card quando existe achado com valor — não há card dizendo "está tudo certo".
 *
 * `dividaId` existe para o deep link até a tela de revisão, por campo tipado.
 */
export interface ValorJustoCardData {
  kind: 'valor_justo';
  dividaId: Uuid;
  credor: string;
  valorCobrado: number; // centavos
  valorJusto: number; // centavos, calculado no backend
  /** script de negociação em blocos tipados por canal (montado no backend) */
  script: ScriptNegociacao;
  /** fundamentos curados (ex.: artigos do CDC) — texto vindo do backend */
  fundamentos?: string[];
}

export interface InfoCardData {
  kind: 'info';
  titulo: string;
  corpo: string;
}

/**
 * Retrato de uma dívida dentro da conversa (M5).
 *
 * Todos os valores são preenchidos pelo BACKEND a partir do banco. O assistente
 * escolheu qual dívida mostrar; ele não escreveu nenhum destes números.
 */
export interface DividaResumoCardData {
  kind: 'divida_resumo';
  dividaId: Uuid;
  credor: string;
  /** em centavos */
  saldoDevedor?: number | null;
  proximoVencimento?: IsoDate | null;
  situacao: SituacaoDivida;
  criticidade: CriticidadeTipo;
}

/** Plano de quitação na conversa (M5). Os números vêm da mesma simulação do M4. */
export interface PlanoSugeridoCardData {
  kind: 'plano_sugerido';
  estrategia: EstrategiaQuitacao;
  /** em centavos */
  aporteExtraMensal: number;
  mesesAteQuitacao: number;
  dataLiberdade: IsoMes;
  /** em centavos. Ausente = o cenário mínimo não quita, então não há economia a afirmar. */
  economia?: number | null;
}

/**
 * Rascunho de cadastro ou de alteração, para o usuário confirmar (M5).
 *
 * ÚNICO card cujos valores NÃO vêm do banco: são o que a PESSOA disse na
 * conversa, devolvido para ela conferir num formulário (`guardrails.md`, 7.2).
 * Nada aqui é afirmação do assistente, e nada aqui foi gravado — a tela precisa
 * dizer isso com todas as letras.
 *
 * `dividaId` ausente é cadastro novo; presente é alteração daquela dívida.
 * Campo ausente significa "ela não disse", nunca zero.
 */
export interface DividaPropostaCardData {
  kind: 'divida_proposta';
  dividaId?: Uuid | null;
  /**
   * Nome ATUAL da dívida no banco, só na alteração. Diz qual dívida vai mudar —
   * separado de `credor`, que é o valor proposto e pode ser justamente a
   * correção do nome.
   */
  dividaCredor?: string | null;
  credor?: string | null;
  /** em centavos */
  valorCobrado?: number | null;
  dataOrigem?: IsoDate | null;
  tipo?: CriticidadeTipo | null;
  /** basis points inteiros */
  taxaJurosMensal?: number | null;
  totalParcelas?: number | null;
  primeiroVencimento?: IsoDate | null;
}

export interface ChatMessage {
  id: Uuid;
  role: ChatRole;
  content: string;
  cards?: ActionCardData[];
  createdAt: IsoDate;
}

export interface SendMessageRequest {
  content: string;
  // futuramente: id da negociação / estado do fluxo
}

export interface SendMessageResponse {
  message: ChatMessage;
}

/* ---------- Painel de endividamento (M2) ---------- */

export interface TotalPorCriticidade {
  tipo: CriticidadeTipo;
  /** em centavos */
  total: number;
  quantidade: number;
}

export interface VencimentoProximo {
  dividaId: Uuid;
  credor: string;
  /** em centavos */
  valor: number;
  vencimento: IsoDate;
  /** derivado no BACKEND — o fuso do aparelho não decide o que está atrasado */
  situacao: 'pendente' | 'paga' | 'atrasada';
}

export interface PontoEvolucao {
  mes: IsoMes;
  /** em centavos */
  saldo: number;
}

/**
 * Agregados do painel. TODOS calculados no backend — o app não soma coluna,
 * não tira média e não deriva percentual (docs/adr/0003).
 *
 * Os campos ligados a renda são opcionais: ausentes significam "o usuário ainda
 * não informou", e a UI convida a preencher em vez de exibir zero.
 */
export interface ResumoDividas {
  /** em centavos */
  totalDevido: number;
  totalQuitadoNoAno: number;
  quantidadeDividas: number;
  /** basis points (380 = 3,80% a.m.) */
  custoMedioJurosMensal?: number;

  /**
   * Em centavos POR DIA — quanto o endividamento cresce em um dia.
   *
   * Calculado em `backend/domain/resumo.py`, que declara no docstring as três
   * escolhas de método por trás dele (divisor 30, base do saldo, agregado). O
   * app NÃO deriva este número, nem parcialmente: `saldo × taxa ÷ 30` é valor
   * derivado e o guardrail 1.2 proíbe o cliente produzi-lo.
   *
   * Ausente = nenhuma dívida ativa tem taxa informada, e o card não diz a frase.
   */
  custoDiarioJuros?: number;
  /**
   * Contagem — quantas ativas estão sem taxa conhecida.
   *
   * Maior que zero ⇒ `custoDiarioJuros` é PISO, não total, porque as sem taxa
   * ficam de fora da soma. Os dois campos andam juntos: sem esta contagem, a
   * tela não sabe se pode dizer o número como total, e um piso anunciado como
   * total é subestimação silenciosa.
   */
  quantidadeDividasSemTaxa?: number;

  rendaMensal?: number;
  /** basis points (2200 = 22,00% da renda) */
  comprometimentoRenda?: number;
  minimoExistencial?: number;
  margemDisponivel?: number;

  porCriticidade: TotalPorCriticidade[];
  proximosVencimentos: VencimentoProximo[];
  /** no máximo 12 pontos, do mais antigo ao mais recente */
  evolucaoSaldo: PontoEvolucao[];

  /**
   * Em centavos. O MAIOR saldo já registrado para o tenant — não o primeiro
   * ponto de `evolucaoSaldo`, que é recortada pelo mês selecionado e pelos
   * últimos 12 pontos. É a base que não anda para trás quando o usuário
   * cadastra uma dívida nova ou troca o mês consultado (ADR 0019, item 4).
   *
   * `null` sem histórico: quem cadastrou hoje tem um ponto só, e `null` aqui
   * não é o mesmo que `0` — a barra de progresso some, não aparece vazia.
   */
  saldoInicialDaRota: number | null;
  /**
   * `saldoInicialDaRota` percorrido, em BASIS POINTS (2740 = 27,40%), com
   * piso em zero — nunca negativo. Calculado em
   * `backend/domain/resumo.py::rota_percorrida_bps`; o app não deriva mais
   * este número (guardrail 1.2).
   *
   * `null` junto com `saldoInicialDaRota` quando não há histórico. `0` é
   * estado legítimo e diferente de `null`: quem tem histórico e ainda não
   * andou vê a barra vazia, não escondida.
   */
  rotaPercorridaBps: number | null;
}

export interface PerfilFinanceiro {
  /**
   * Em centavos. Ausente = não informado, nunca zero.
   *
   * DERIVADO de `fonte_renda`, que é onde a renda mora desde o M7 — a leitura é
   * a soma das fontes ativas. Continua aceito na escrita só por compatibilidade
   * com app instalado que não atualizou, e ali o valor pousa na fonte. A tela de
   * renda é `caixa/renda`; enviar este campo de outro lugar recria as duas
   * fontes de verdade que o M7.2 removeu.
   */
  rendaMensal?: number;
  dependentes?: number;
  /** `HH:MM` local. O aparelho compõe o instante; o servidor só guarda a preferência. */
  horaLembrete?: string;
  diasAntecedenciaLembrete?: number;
  /** Dia do mês do lembrete de fechamento. Ausente é desligado. */
  fechamentoDiaDoMes?: number | null;
}

/* ---------- Plano de pagamento (M3) ---------- */

export type SituacaoParcela = 'pendente' | 'paga' | 'atrasada';

export interface Parcela {
  id: Uuid;
  numero: number;
  total: number;
  /** em centavos */
  valor: number;
  vencimento: IsoDate;
  /** Derivada no BACKEND — o fuso do aparelho não decide o que está atrasado. */
  situacao: SituacaoParcela;
  pagoEm?: IsoDate | null;
  valorPago?: number | null;
}

export interface PagamentoInput {
  pagoEm: IsoDate;
  /** em centavos */
  valorPago: number;
}

export interface RenegociacaoInput {
  /** em centavos */
  novoValor: number;
  novoTotalParcelas: number;
  /** basis points */
  novaTaxaJurosMensal?: number;
  primeiroVencimento: IsoDate;
  observacao?: string;
}

/**
 * Um aviso a agendar no aparelho.
 *
 * `dataLembrete` é DATA, não instante: o servidor decide o quê e o qual dia; o
 * aparelho compõe a hora local. Título e corpo vêm prontos para não haver
 * formatação de moeda duplicada entre servidor e cliente.
 */
export interface Lembrete {
  id: string;
  dividaId: Uuid;
  parcelaId: Uuid;
  titulo: string;
  corpo: string;
  dataLembrete: IsoDate;
}

/* ---------- Simulador de quitação (M4) ---------- */

export type EstrategiaQuitacao = 'avalanche' | 'bola_de_neve';

export interface SimulacaoParams {
  /** em centavos, além das parcelas mínimas */
  aporteExtraMensal: number;
  /** o app sempre pede as duas: a comparação é a mensagem da tela */
  estrategias: EstrategiaQuitacao[];
  /** `null` significa todas as dívidas ativas */
  dividasIds: Uuid[] | null;
}

export interface ItemOrdemPagamento {
  dividaId: Uuid;
  credor: string;
  posicao: number;
  quitadaEm: IsoMes;
  /** em centavos */
  jurosPagos: number;
}

/**
 * Uma estratégia simulada. NENHUM destes números é calculado aqui — amortização
 * é regra de negócio, e o guardrail 1.2 proíbe rodá-la no cliente pelo nome.
 */
export interface Simulacao {
  estrategia: EstrategiaQuitacao;
  mesesAteQuitacao: number;
  dataLiberdade: IsoMes;
  /** em centavos */
  totalJurosPagos: number;
  totalPago: number;
  /**
   * Ausente quando o cenário de pagar só o mínimo não quita — sem o outro lado
   * da comparação não há economia a afirmar, e a tela exibe "ainda não
   * calculado".
   */
  economiaVsMinimo?: number | null;
  /**
   * O plano passa dos 5 anos que o CDC, art. 104-A, fixa como prazo máximo do
   * plano apresentado numa repactuação judicial. É **informação, não
   * impedimento**: plano mais longo não é ilegal, e a copy não pode sugerir que
   * seja. Ausente é tratado como `false`.
   */
  acimaDoPrazoDeRepactuacao?: boolean;
  ordemPagamento: ItemOrdemPagamento[];
  evolucaoSaldo: PontoEvolucao[];
}

/**
 * A diferença entre as duas estratégias, calculada no backend de propósito: se
 * o app subtraísse `totalJurosPagos` de uma da outra, teria replicado uma regra
 * de negócio — e essa diferença é a mensagem central da tela.
 */
export interface ComparacaoEstrategias {
  melhorEstrategia: EstrategiaQuitacao;
  /** em centavos */
  diferencaJuros: number;
  diferencaMeses: number;
}

/** Dívida que entrou na simulação sem taxa conhecida — nenhum juro foi projetado sobre ela. */
export interface DividaSemTaxa {
  dividaId: Uuid;
  credor: string;
}

export interface RespostaSimulacao {
  simulacoes: Simulacao[];
  /** ausente quando só uma estratégia foi pedida */
  comparacao?: ComparacaoEstrategias | null;
  dividasSemTaxa: DividaSemTaxa[];
}

// ---------------------------------------------------------------------------
// M6 — Revisão de cobrança
// ---------------------------------------------------------------------------

/**
 * Um ponto do contrato que vale contestar, com a fonte que o sustenta.
 *
 * `valorContestavel` ausente é o achado que aparece na tela e NÃO entra na
 * subtração de `valorJusto`: quantificá-lo exigiria reamortizar o contrato, o
 * que seria estimativa disfarçada de apuração (ADR 0008).
 *
 * `evidencia` é o trecho LITERAL do contrato. Ausente quando o achado não veio
 * da leitura de um contrato.
 *
 * A copy destes campos vem do backend em tom de investigação. O front nunca a
 * reescreve como afirmação — `guardrails.md`, seção 3.
 */
export interface Achado {
  id: string;
  titulo: string;
  explicacao: string;
  /** artigo de lei, súmula ou tema repetitivo — texto curado no backend */
  fonte: string;
  comoConferir: string;
  /** em centavos. Ausente = achado sem número. */
  valorContestavel?: number | null;
  evidencia?: string | null;
}

/**
 * A revisão de uma dívida.
 *
 * `valorJusto` é nulo quando nenhum achado tem valor — e nunca igual a
 * `valorCobrado`, porque isso afirmaria "conferimos e está tudo certo".
 * `economia` não vem do backend: o front a calcula, e é a única subtração que o
 * guardrail 1.2 lhe permite.
 */
export interface RevisaoCobranca {
  dividaId: Uuid;
  credor: string;
  /** em centavos */
  valorCobrado: number;
  /** em centavos. Ausente = nenhum achado com valor. */
  valorJusto?: number | null;
  achados: Achado[];
  /**
   * Script de negociação em blocos tipados por canal, montado por template no
   * backend (M12). NÃO é mais nulável nem string: mesmo sem achado o backend
   * devolve o script mínimo de segurança (alerta + regra de pagamento), porque
   * validação de canal é proteção, não argumento (ADR 0021).
   */
  script: ScriptNegociacao;
  fundamentos: string[];
  /** data de vigência do teto que embasou algum achado (ISO). */
  baseLegalVigenteEm?: IsoDate | null;
}

/**
 * Por onde a negociação acontece (M12). O MESMO motor de valor justo produz os
 * três — muda o formato e o momento da oferta, nunca o número (docs/domain.md).
 */
export type Canal = 'telefone' | 'chat' | 'email';

/**
 * O momento de um bloco na conversa. A tela o usa para separar VISUALMENTE
 * segurança (`abertura`/`fechamento`) de contestação (`argumento`) — texto de
 * alerta e de argumento mal separados leem como "a dívida tem problema" quando
 * ninguém disse isso.
 */
export type MomentoScript = 'abertura' | 'argumento' | 'oferta' | 'fechamento';

/**
 * Um bloco do script. `copiavel` é `true` só nos canais escritos, onde cada
 * bloco tem botão de copiar próprio (guardrail 1.2).
 */
export interface BlocoScript {
  id: string;
  titulo?: string | null;
  texto: string;
  momento: MomentoScript;
  copiavel: boolean;
}

/** O script inteiro de um canal: os blocos e o canal que os produziu. */
export interface ScriptNegociacao {
  canal: Canal;
  blocos: BlocoScript[];
}

// --- Módulo de caixa (M7) ----------------------------------------------------

export type TipoFonteRenda = 'pj_hora' | 'clt' | 'autonomo' | 'beneficio' | 'aluguel' | 'outro';

export type CategoriaGasto =
  | 'moradia'
  | 'alimentacao'
  | 'transporte'
  | 'contas'
  | 'saude'
  | 'dependentes'
  | 'outros';

/** De onde saiu a renda que o plano está usando. O usuário precisa saber. */
export type OrigemRenda = 'informada' | 'pior_mes_registrado';

/** Quanto o usuário já preencheu. É o que a tela usa entre convite e conteúdo. */
export type NivelPreenchimento = 'vazio' | 'nivel_0' | 'nivel_1';

/**
 * A cascata do caixa, calculada inteira no backend (ADR 0003). O app formata e
 * exibe; não soma pote nenhum.
 */
export interface Caixa {
  rendaBrutaTipica: number;
  origemRenda: OrigemRenda;
  impostoReservado: number;
  rendaLiquida: number;
  essenciais: number;
  naoEssenciais: number;
  provisaoMensal: number;
  aporteReserva: number;
  aporteAposentadoria: number;
  /**
   * O RESPIRO (M11, ADR 0019): a fatia que o usuário declara para viver
   * enquanto paga, subtraída ANTES de `capacidadeMaxima` — é essa posição que a
   * torna imune ao corte por austeridade total.
   *
   * `null` é **nunca declarou**, e NÃO se confunde com `0`: zero declarado é
   * escolha legítima. Não existe default (ADR 0009); sem declaração não há
   * respiro, e o convite a declarar é obrigação de tela.
   */
  respiro: number | null;
  /** `false` desativa a linha da cascata e PRESERVA o valor e o saldo acumulado. */
  respiroAtivo: boolean | null;
  /** Com respiro declarado e nada usado é `0` — fato, não ausência. */
  respiroUsadoNoMes: number | null;
  /**
   * DERIVADO a cada leitura, nunca persistido: `respiro − respiroUsadoNoMes`,
   * com piso em zero.
   */
  respiroDisponivelNoMes: number | null;
  /**
   * PERSISTIDO: o acumulado dos MESES FECHADOS menos o excesso que o uso deste
   * mês passou da fatia, com piso em zero — já é o efetivo. Não recalcule.
   */
  respiroSaldoAcumulado: number | null;
  comprometidoDividas: number;
  /**
   * O que sobra sem mudar nada de vida. **Pode ser negativo**, e o negativo é a
   * informação — a tela nunca o esconde nem o zera.
   */
  capacidadeHoje: number;
  /** O que sobraria cortando o não essencial. A diferença é a alavanca do usuário. */
  capacidadeMaxima: number;
  /** Teto do aporte extra: capacidade menos o que já está comprometido. */
  aporteMaximo: number;
  minimoExistencial?: number | null;
  minimoExistencialVigenteEm?: string | null;
  /** `null` sem piso configurado: ausência, nunca um `false` otimista. */
  abaixoDoPiso?: boolean | null;
  /**
   * As parcelas não cabem nem cortando o não essencial. É **fato aritmético**,
   * não diagnóstico — a copy nunca diz "superendividado" (CDC art. 54-A, § 1º
   * exige boa-fé e dívida de consumo, que nenhum software apura).
   */
  naoFecha: boolean;
  preenchimento: NivelPreenchimento;
  /**
   * Quando o usuário confirmou os números pela última vez. Os três são
   * `undefined` quando ele nunca fechou um mês — que NÃO é o mesmo que estar
   * atrasado, e é por isso que `caixaDefasado` também some nesse caso.
   */
  ultimoFechamentoMes?: string;
  mesesDesdeFechamento?: number;
  caixaDefasado?: boolean;
}

export interface FonteRenda {
  id: Uuid;
  nome: string;
  tipo: TipoFonteRenda;
  /** Em centavos. Ausente = não informado, nunca zero. */
  valorTipicoInformado?: number | null;
  variavel: boolean;
  /** Chave de liga/desliga: preserva o histórico sem entrar na conta. */
  ativo: boolean;
}

export interface Recebimento {
  id: Uuid;
  mes: IsoMes;
  valor: number;
}

export interface Gasto {
  id: Uuid;
  descricao: string;
  categoria: CategoriaGasto;
  /** Classificação do USUÁRIO. O que é cortável na vida dele não é decisão nossa. */
  essencial: boolean;
  fixo: boolean;
  valorMensal: number;
  ativo: boolean;
}

export interface ProvisaoAnual {
  id: Uuid;
  descricao: string;
  valorAnual: number;
  /** 1 a 12. */
  mesVencimento: number;
  saldoAcumulado: number;
  ativa: boolean;
  /** Derivados no servidor: divide o que falta pelos meses que faltam, nunca por 12. */
  aporteMensal: number;
  mesesRestantes: number;
}

export interface MetasCaixa {
  /** Basis points. Ausente ⇒ nada é reservado, e a tela diz isso (ADR 0009). */
  impostoBps?: number | null;
  reservaMetaMeses?: number | null;
  reservaSaldo?: number | null;
  /** O único dos três de reserva que entra na cascata. */
  reservaAporte?: number | null;
  aposentadoriaAporte?: number | null;
  /** Ausente ⇒ nenhuma comparação dívida × investimento é exibida (ADR 0009). */
  rendimentoEsperadoBps?: number | null;
}

/* --- Metas nomeadas (/v1/metas) --- */

/**
 * COISA DIFERENTE DE `MetasCaixa` LOGO ACIMA. `MetasCaixa` são os seis potes
 * fixos do perfil que entram na cascata do fechamento do mês — imposto, reserva,
 * aposentadoria. `Meta` é a coleção livre da aba Metas: a pessoa cria, nomeia e
 * apaga, e nada disso entra em cálculo de capacidade. A colisão de nome é dívida
 * assumida na ADR 0017; na tela, um é "Seus potes" e o outro é "Suas metas".
 */
export type StatusMeta = 'em_dia' | 'aporte_baixo' | 'atingida';

export interface NovaMeta {
  nome: string;
  emoji?: string | null;
  /** Centavos. */
  valorAlvo: number;
  saldo?: number;
  /** `AAAA-MM`. Ausente ⇒ meta sem prazo, e sem prazo não há sugestão. */
  dataAlvo?: string | null;
  /** Centavos. O que a pessoa DECLARA separar por mês. */
  aporteMensal?: number | null;
  ativa?: boolean;
}

export type MetaPatch = Partial<NovaMeta>;

export interface Meta extends NovaMeta {
  id: Uuid;
  /**
   * Derivados no servidor, nunca aqui: o sugerido divide o que falta pelos meses
   * que faltam, e depende do mês em que a pergunta é feita. `null` quando falta
   * prazo — e, no status, também quando falta o aporte declarado. A tela então
   * não exibe pill, em vez de exibir palpite (ADR 0003).
   */
  aporteSugerido?: number | null;
  status?: StatusMeta | null;
}

export interface SnapshotCaixa {
  id: Uuid;
  calculadoEm: string;
  rendaBrutaTipica: number;
  rendaLiquida: number;
  essenciais: number;
  capacidadeHoje: number;
  capacidadeMaxima: number;
  aporteMaximo: number;
  naoFecha: boolean;
}


/** De onde veio o número que a tela de fechamento mostra pré-preenchido. */
export type OrigemDoValor = 'mes_anterior' | 'valor_atual' | 'sem_referencia';

export type TipoItemFechamento = 'recebimento' | 'gasto';

export interface ItemFechamento {
  tipo: TipoItemFechamento;
  id: Uuid;
  descricao: string;
  /** Em CENTAVOS. Ausente quando não há referência — campo vazio, nunca zero. */
  valorSugerido?: number;
  origem: OrigemDoValor;
  mesDeReferencia?: string;
}

export interface PropostaFechamento {
  mes: string;
  itens: ItemFechamento[];
}

export interface ItemConfirmado {
  tipo: TipoItemFechamento;
  id: Uuid;
  valor: number;
}

// --- M8 · conta de usuário (ADR 0012) ---------------------------------------

/**
 * O par de tokens. `acesso` é JWT de 15 min; `refresh` é opaco, de 30 dias e
 * rotacionado a cada uso.
 *
 * Os dois vivem no `expo-secure-store` (`src/api/sessao.ts`). Nunca em estado de
 * componente, nunca em AsyncStorage — guardrails, seção 5.
 */
export interface Sessao {
  acesso: string;
  refresh: string;
  /** ISO 8601. Instante em que o `acesso` vence. */
  expiraEm: string;
}

export interface RespostaSessao {
  sessao: Sessao;
}

// --- M9 · assinatura (ADR 0013) ---------------------------------------------

export type StatusAssinatura = 'em_teste' | 'ativa' | 'expirada';

export type PlataformaCompra = 'ios' | 'android';

/**
 * Até quando esta conta pode escrever, e por qual motivo.
 *
 * `podeEscrever` é REDUNDANTE em relação a `status`, e é assim de propósito: o
 * app não reimplementa a regra "expirada é o único que bloqueia". No dia em que
 * o backend ganhar um quarto status — período de graça, cobrança em nova
 * tentativa —, esta versão instalada continua acertando, porque a decisão já vem
 * pronta. Mesma disciplina de `situacao` em `Divida`.
 *
 * NÃO HÁ PREÇO AQUI. Ele vem da loja pelo SDK, já localizado em moeda e
 * formato — ver `src/compras/`. Preço servido pelo backend mentiria para quem
 * está em outro país, e as duas lojas exigem que ele venha delas.
 */
export interface SituacaoAssinatura {
  status: StatusAssinatura;
  podeEscrever: boolean;
  /** ISO 8601. */
  expiraEm: string;
  diasRestantes: number;
  produtoId?: string | null;
  renovacaoAutomatica?: boolean | null;
}

// --- M11 · marcos (ADR 0019, item 4) ----------------------------------------

/**
 * Os cinco pontos da rota que disparam celebração. ESPELHO de `TipoDeMarco` em
 * `backend/schemas.py` — o backend devolve sempre os cinco, na ordem dele.
 */
export type TipoDeMarco =
  | 'primeira_negociacao'
  | 'primeira_quitacao'
  | 'rota_25'
  | 'rota_50'
  | 'rota_75';

/**
 * Uma conquista e seus dois instantes.
 *
 * OS DOIS SÃO SEPARADOS DE PROPÓSITO, e é a mesma razão escrita no docstring de
 * `Marco` em `backend/schemas.py`: `atingidoEm` é quando o gatilho ocorreu;
 * `celebradoEm`, quando a `MarcoScreen` foi exibida. Sem essa separação a tela
 * reapareceria a cada abertura do app — e um marco atingido com o app fechado,
 * ou durante o período somente leitura da assinatura, se perderia em vez de
 * esperar.
 *
 * `atingidoEm` nulo é marco NÃO ATINGIDO: a rota devolve os cinco tipos sempre,
 * e a ausência é dita, não omitida. Nenhum dos dois é opcional na resposta —
 * eles são nulos, que é coisa diferente de ausentes.
 */
export interface Marco {
  tipo: TipoDeMarco;
  atingidoEm: IsoDate | null;
  celebradoEm: IsoDate | null;
}
