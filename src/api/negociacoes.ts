import { request } from './client';
import type { RegistroNegociacaoInput, ResultadoNegociacao, Uuid } from './types';

/**
 * Resultado de negociação (M12).
 *
 * Registro ADICIONAL, não substituto do acordo: fechar um acordo continua indo
 * por `POST /v1/dividas/{id}/renegociacao`, que reescreve as parcelas. Aqui se
 * grava o DESFECHO da conversa — inclusive quando não houve acordo —, que é o
 * que constrói o benchmark. Nenhum valor é calculado no cliente: a tela só
 * envia o que o usuário digitou.
 */

export function registrarNegociacao(dividaId: Uuid, input: RegistroNegociacaoInput) {
  return request<{ resultado: ResultadoNegociacao }>(`/v1/dividas/${dividaId}/negociacoes`, {
    method: 'POST',
    body: input,
  });
}

export function listarNegociacoesDaDivida(dividaId: Uuid) {
  return request<{ resultados: ResultadoNegociacao[] }>(`/v1/dividas/${dividaId}/negociacoes`);
}
