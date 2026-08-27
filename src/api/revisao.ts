import { request } from './client';
import type { Canal, RevisaoCobranca, Uuid } from './types';

/**
 * Revisão de cobrança (M6/M12).
 *
 * Leitura pura: nenhuma rota de escrita entrou com esta feature. `valorJusto`
 * chega pronto do backend — é `valorCobrado` menos a soma dos achados com
 * valor, cada um com fonte legal (ADR 0008). O app não soma achado, não aplica
 * teto e não decide o que é contestável.
 *
 * `canal` escolhe só a FORMA do script — o `valorJusto` e os achados são
 * idênticos nos três. É parâmetro de visualização e não persiste (ADR 0021).
 */

export function obterRevisao(dividaId: Uuid, canal: Canal = 'email') {
  return request<{ revisao: RevisaoCobranca }>(
    `/v1/dividas/${dividaId}/revisao?canal=${canal}`,
  );
}
