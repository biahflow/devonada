import { request, upload } from './client';
import type { CriticidadeTipo, IsoDate, Uuid } from './types';

/**
 * Ingestão de contrato de empréstimo, consignado ou financiamento.
 *
 * A extração é PROPOSTA, nunca gravação. Um modelo lendo números de contrato é
 * o caso-limite de "LLM como fonte da verdade" (docs/guardrails.md, seção 1):
 * nada vira dívida sem o usuário revisar campo a campo, com o trecho de origem
 * à vista. Ver docs/adr/0005 para o descarte do arquivo bruto.
 */

export type StatusExtracao = 'processando' | 'concluida' | 'falhou';

export type Confianca = 'alta' | 'media' | 'baixa';

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

export interface ExtracaoContrato {
  id: Uuid;
  status: StatusExtracao;
  /** Preenchido quando status é 'falhou'. Mensagem para o usuário, em pt-BR. */
  erro?: string;
  campos?: {
    credor: CampoExtraido<string>;
    valorCobrado: CampoExtraido<number>; // centavos
    dataOrigem: CampoExtraido<IsoDate>;
    tipo: CampoExtraido<CriticidadeTipo>;
    taxaJurosMensal: CampoExtraido<number>; // basis points
    totalParcelas: CampoExtraido<number>;
    /** Custo Efetivo Total anual, em basis points. */
    cet: CampoExtraido<number>;
  };
  alertas?: AlertaContrato[];
}

export interface ArquivoContrato {
  uri: string;
  nome: string;
  mimeType: string;
}

/** 202 — a extração roda em background; acompanhe com getExtracao. */
export function enviarContrato(arquivo: ArquivoContrato) {
  return upload<{ extracao: ExtracaoContrato }>('/v1/contratos', arquivo);
}

export function getExtracao(id: Uuid) {
  return request<{ extracao: ExtracaoContrato }>(`/v1/contratos/${id}`);
}
