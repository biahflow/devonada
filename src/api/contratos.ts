import { request, upload } from './client';
import type { CriticidadeTipo, IsoDate, ModalidadeCredito, Uuid } from './types';

/**
 * Ingestão de documento de dívida: contrato, boleto, carta ou print de cobrança.
 *
 * A extração é PROPOSTA, nunca gravação. Um modelo lendo números de documento é
 * o caso-limite de "LLM como fonte da verdade" (docs/guardrails.md, seção 1):
 * nada vira dívida sem o usuário revisar campo a campo, com o trecho de origem
 * à vista. Ver docs/adr/0005 para o descarte do arquivo bruto.
 */

export type StatusExtracao = 'processando' | 'concluida' | 'falhou';

export type Confianca = 'alta' | 'media' | 'baixa';

/**
 * QUE documento o usuário enviou. Roteia o prompt e o schema no backend, e no
 * front decide quais campos a tela de revisão renderiza. `contrato` é o
 * default histórico (M1.5); os demais entram no M13.
 */
export type TipoDocumento = 'contrato' | 'boleto' | 'carta' | 'print';

/**
 * Todo campo extraído carrega a evidência que o sustenta. `valor: null`
 * significa "não encontrei" — e o front deixa o campo VAZIO em vez de chutar.
 */
export interface CampoExtraido<T> {
  valor: T | null;
  confianca: Confianca;
  /** Texto literal do contrato que sustenta o valor. Sem ele, não se preenche. */
  trecho?: string;
  pagina?: number;
}

/**
 * Cláusula que merece atenção. É SINAL PARA INVESTIGAR, jamais afirmação de
 * ilegalidade — mesma postura de `possivelPrescricao` (guardrail 3).
 */
export interface AlertaContrato {
  id: Uuid;
  titulo: string;
  explicacao: string;
  trecho?: string;
  pagina?: number;
}

/** Campos de um CONTRATO — os 7 do núcleo mais os encargos da revisão (M6). */
export interface CamposContrato {
  credor: CampoExtraido<string>;
  valorCobrado: CampoExtraido<number>; // centavos
  dataOrigem: CampoExtraido<IsoDate>;
  tipo: CampoExtraido<CriticidadeTipo>;
  taxaJurosMensal: CampoExtraido<number>; // basis points
  totalParcelas: CampoExtraido<number>;
  /** Custo Efetivo Total anual, em basis points. */
  cet: CampoExtraido<number>;
  // Encargos (M6): onde mora a cobrança contestável de um consignado. Opcionais
  // porque um `campos` gravado antes do M6 não os carrega.
  modalidade?: CampoExtraido<ModalidadeCredito>;
  tarifaCadastro?: CampoExtraido<number>; // centavos
  seguroPrestamista?: CampoExtraido<number>; // centavos
  iof?: CampoExtraido<number>; // centavos
  multaMoratoriaMensal?: CampoExtraido<number>; // basis points
}

/** Campos de um BOLETO. */
export interface CamposBoleto {
  beneficiario: CampoExtraido<string>;
  valor: CampoExtraido<number>; // centavos
  vencimento: CampoExtraido<IsoDate>;
  linhaDigitavel: CampoExtraido<string>;
  nossoNumero: CampoExtraido<string>;
}

/** Campos de uma CARTA de cobrança — texto livre. */
export interface CamposCartaCobranca {
  credor: CampoExtraido<string>;
  valorCobrado: CampoExtraido<number>; // centavos
  dataVencimento: CampoExtraido<IsoDate>;
  referencia: CampoExtraido<string>;
}

/** Campos de um PRINT de cobrança — o menos estruturado. */
export interface CamposPrintCobranca {
  credor: CampoExtraido<string>;
  valorCobrado: CampoExtraido<number>; // centavos
  referencia: CampoExtraido<string>;
}

/**
 * União dos quatro conjuntos de campos. O `tipo` de `ExtracaoContrato` diz qual
 * está preenchido — a tela de revisão estreita por ele antes de ler os campos.
 */
export type CamposExtraidos =
  | CamposContrato
  | CamposBoleto
  | CamposCartaCobranca
  | CamposPrintCobranca;

export interface ExtracaoContrato {
  id: Uuid;
  status: StatusExtracao;
  /** QUE documento foi lido. Default 'contrato' para leituras anteriores ao M13. */
  tipo: TipoDocumento;
  /** Preenchido quando status é 'falhou'. Mensagem para o usuário, em pt-BR. */
  erro?: string;
  campos?: CamposExtraidos;
  alertas?: AlertaContrato[];
}

export interface ArquivoContrato {
  uri: string;
  nome: string;
  mimeType: string;
}

/** 202 — a extração roda em background; acompanhe com getExtracao. */
export function enviarContrato(arquivo: ArquivoContrato, tipo: TipoDocumento = 'contrato') {
  return upload<{ extracao: ExtracaoContrato }>('/v1/contratos', arquivo, { campos: { tipo } });
}

export function getExtracao(id: Uuid) {
  return request<{ extracao: ExtracaoContrato }>(`/v1/contratos/${id}`);
}
