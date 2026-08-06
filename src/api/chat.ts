import { request } from './client';
import type { SendMessageRequest, SendMessageResponse } from './types';

export function sendMessage(body: SendMessageRequest, signal?: AbortSignal) {
  return request<SendMessageResponse>('/v1/chat/messages', {
    method: 'POST',
    body,
    signal,
  });
}
