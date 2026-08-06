/**
 * Tipos de domínio compartilhados com o backend.
 * Espelham o modelo do Postgres (multi-tenant): todo recurso pertence a um
 * tenant, mas o tenant vem do token de auth — o cliente não o envia.
 */
export type Uuid = string;
export type IsoDate = string;

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

/** Cards de ação embutidos numa mensagem do assistente. União discriminada. */
export type ActionCardData = ValorJustoCardData | InfoCardData;

export interface ValorJustoCardData {
  kind: 'valor_justo';
  credor: string;
  valorCobrado: number; // centavos
  valorJusto: number; // centavos, calculado no backend
  /** mensagem pronta pra negociação (gerada no backend) */
  script: string;
  /** fundamentos curados (ex.: artigos do CDC) — texto vindo do backend */
  fundamentos?: string[];
}

export interface InfoCardData {
  kind: 'info';
  titulo: string;
  corpo: string;
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
