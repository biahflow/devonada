import { useCallback, useRef, useState } from 'react';
import { sendMessage } from '../api/chat';
import { ApiError } from '../api/client';
import type { ChatMessage } from '../api/types';

function localId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const SAUDACAO: ChatMessage = {
  id: 'saudacao',
  role: 'assistant',
  content:
    'Oi. Me conta de uma dívida que está te preocupando — quanto estão cobrando e de quem. ' +
    'Vamos por partes, sem pressa.',
  createdAt: new Date().toISOString(),
};

/** Estado do chat em memória. Sem persistência local no MVP: a fonte da
 *  verdade é o backend. (Sem localStorage — não existe em RN de qualquer forma.) */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([SAUDACAO]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (content: string) => {
      const texto = content.trim();
      if (!texto || sending) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: localId(),
        role: 'user',
        content: texto,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { message } = await sendMessage({ content: texto }, controller.signal);
        setMessages((prev) => [...prev, message]);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Algo deu errado ao enviar. Tente de novo.');
      } finally {
        setSending(false);
      }
    },
    [sending],
  );

  return { messages, sending, error, send };
}
