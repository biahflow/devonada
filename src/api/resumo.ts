import { request } from './client';
import type { IsoMes, ResumoDividas } from './types';

/**
 * Agregados do painel. Todo número aqui vem calculado do backend — se o front
 * precisar somar algo para exibir, o endpoint está incompleto (ADR 0003).
 */
export function getResumo(mes?: IsoMes) {
  const query = mes ? `?mes=${encodeURIComponent(mes)}` : '';
  return request<{ resumo: ResumoDividas }>(`/v1/dividas/resumo${query}`);
}
