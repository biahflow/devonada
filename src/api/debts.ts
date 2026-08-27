import { request } from './client';
import type { Divida, IsoDate, Uuid } from './types';

/**
 * Recurso de dívidas. Cálculo determinístico (valorCorrigido, saldoDevedor,
 * prescrição) é sempre do backend — ver docs/adr/0003.
 * Contrato completo em docs/api-contract.md.
 */

export type NovaDivida = Pick<
  Divida,
  'credor' | 'valorCobrado' | 'dataOrigem' | 'tipo' | 'taxaJurosMensal' | 'totalParcelas'
> & {
  /** Anda junto com `totalParcelas`: o backend rejeita um sem o outro. */
  primeiroVencimento?: IsoDate;
  /**
   * Liga a dívida à extração que a originou. NÃO é um campo extraído — é a chave
   * da leitura —, então não passa pelo descarte do guardrail 8.1: viaja sempre
   * que a dívida nasceu de um documento. Sem ele, `revisao.py` não acha a
   * extração e a revisão daquela dívida nunca produz achado nem `valorJusto`.
   */
  extracaoId?: Uuid;
};

/** PATCH aceita qualquer subconjunto dos campos que o usuário informa. */
export type PatchDivida = Partial<NovaDivida>;

export interface QuitacaoInput {
  dataQuitacao: IsoDate;
  /** em centavos */
  valorPago: number;
}

export function listDebts() {
  return request<{ dividas: Divida[] }>('/v1/dividas');
}

export function getDebt(id: Uuid) {
  return request<{ divida: Divida }>(`/v1/dividas/${id}`);
}

export function createDebt(input: NovaDivida) {
  return request<{ divida: Divida }>('/v1/dividas', { method: 'POST', body: input });
}

export function updateDebt(id: Uuid, patch: PatchDivida) {
  return request<{ divida: Divida }>(`/v1/dividas/${id}`, { method: 'PATCH', body: patch });
}

export function quitarDebt(id: Uuid, input: QuitacaoInput) {
  return request<{ divida: Divida }>(`/v1/dividas/${id}/quitacao`, {
    method: 'POST',
    body: input,
  });
}

/** Exclusão lógica: some da listagem, mas histórico financeiro não se destrói. */
export function deleteDebt(id: Uuid) {
  return request<void>(`/v1/dividas/${id}`, { method: 'DELETE' });
}
