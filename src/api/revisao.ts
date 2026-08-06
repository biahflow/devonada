import { request } from './client';
import type { RevisaoCobranca, Uuid } from './types';

/**
 * Revisão de cobrança (M6).
 *
 * Leitura pura: nenhuma rota de escrita entrou com esta feature. `valorJusto`
 * chega pronto do backend — é `valorCobrado` menos a soma dos achados com
 * valor, cada um com fonte legal (ADR 0008). O app não soma achado, não aplica
 * teto e não decide o que é contestável.
 */

export function obterRevisao(dividaId: Uuid) {
  return request<{ revisao: RevisaoCobranca }>(`/v1/dividas/${dividaId}/revisao`);
}
