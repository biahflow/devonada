import { request } from './client';
import type { Divida } from './types';

/** Fase 1 — o raio-x das dívidas. Cálculo determinístico é feito no backend. */

export function listDebts() {
  return request<{ dividas: Divida[] }>('/v1/dividas');
}

export type NovaDivida = Pick<Divida, 'credor' | 'valorCobrado' | 'dataOrigem' | 'tipo'>;

export function createDebt(input: NovaDivida) {
  return request<{ divida: Divida }>('/v1/dividas', { method: 'POST', body: input });
}
