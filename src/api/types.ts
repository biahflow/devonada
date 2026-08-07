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
  /** mensagem pronta pra negociação (montada por template no backend) */
  script: string;
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

  rendaMensal?: number;
  /** basis points (2200 = 22,00% da renda) */
  comprometimentoRenda?: number;
  minimoExistencial?: number;
  margemDisponivel?: number;

  porCriticidade: TotalPorCriticidade[];
  proximosVencimentos: VencimentoProximo[];
  /** no máximo 12 pontos, do mais antigo ao mais recente */
  evolucaoSaldo: PontoEvolucao[];
}

export interface PerfilFinanceiro {
  /** em centavos. Ausente = não informado, nunca zero. */
  rendaMensal?: number;
  dependentes?: number;
  /** `HH:MM` local. O aparelho compõe o instante; o servidor só guarda a preferência. */
  horaLembrete?: string;
  diasAntecedenciaLembrete?: number;
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
  /** mensagem de negociação montada por template no backend */
  script?: string | null;
  fundamentos: string[];
  /** data de vigência do teto que embasou algum achado (ISO). */
  baseLegalVigenteEm?: IsoDate | null;
}
