import { request } from './client';
import type { Divida, Lembrete, PagamentoInput, Parcela, RenegociacaoInput, Uuid } from './types';

/**
 * Plano de pagamento. `situacao` da parcela vem derivada do backend — o front
 * não compara datas, senão o fuso do aparelho vira fonte de divergência.
 */

export function listarParcelas(dividaId: Uuid) {
  return request<{ parcelas: Parcela[] }>(`/v1/dividas/${dividaId}/parcelas`);
}

export function pagarParcela(parcelaId: Uuid, input: PagamentoInput) {
  return request<{ parcela: Parcela }>(`/v1/parcelas/${parcelaId}/pagamento`, {
    method: 'POST',
    body: input,
  });
}

export function renegociar(dividaId: Uuid, input: RenegociacaoInput) {
  return request<{ divida: Divida }>(`/v1/dividas/${dividaId}/renegociacao`, {
    method: 'POST',
    body: input,
  });
}

export function listarLembretes() {
  return request<{ lembretes: Lembrete[]; horaLembrete: string }>('/v1/lembretes');
}
