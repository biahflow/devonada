import { request } from './client';
import type { ChatMessage, SendMessageRequest, SendMessageResponse } from './types';

export function sendMessage(body: SendMessageRequest, signal?: AbortSignal) {
  return request<SendMessageResponse>('/v1/chat/messages', {
    method: 'POST',
    body,
    signal,
  });
}

/**
 * O histórico da conversa, em ordem cronológica.
 *
 * Os cards vêm REMONTADOS pelo backend a cada leitura, não servidos do que foi
 * gravado: uma parcela paga ontem não pode reaparecer hoje com o saldo de
 * ontem.
 */
export function listarMensagens(signal?: AbortSignal) {
  return request<{ mensagens: ChatMessage[] }>('/v1/chat/messages', { signal });
}
