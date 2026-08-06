import { useCallback, useEffect, useRef, useState } from 'react';
import { listarMensagens, sendMessage } from '../api/chat';
import { ApiError } from '../api/client';
import type { ChatMessage } from '../api/types';

function localId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const TEXTO_SAUDACAO =
  'Oi. Me conta de uma dívida que está te preocupando — quanto estão cobrando e de quem. ' +
  'Vamos por partes, sem pressa.';

/**
 * Estado do chat.
 *
 * A conversa continua sendo um FLUXO em `useState`, não uma coleção no
 * TanStack Query (ADR 0002) — mas desde o M5 ela é carregada do backend no
 * mount e sobrevive ao fechamento do app. A fonte da verdade é o servidor; o
 * que existe aqui é a sessão em andamento.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    listarMensagens(controller.signal)
      .then(({ mensagens }) => {
        // A saudação só aparece em conversa nova. Repeti-la a cada abertura
        // faria o app parecer que esqueceu a pessoa.
        setMessages(
          mensagens.length > 0
            ? mensagens
            : [
                {
                  id: 'saudacao',
                  role: 'assistant',
                  content: TEXTO_SAUDACAO,
                  createdAt: new Date().toISOString(),
                },
              ],
        );
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        // Histórico indisponível não impede conversar: a mensagem nova vai
        // para o servidor do mesmo jeito.
        setMessages([
          {
            id: 'saudacao',
            role: 'assistant',
            content: TEXTO_SAUDACAO,
            createdAt: new Date().toISOString(),
          },
        ]);
        setError(
          e instanceof ApiError ? e.message : 'Não deu para carregar as conversas anteriores.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false);
      });

    return () => controller.abort();
  }, []);

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

  return { messages, carregando, sending, error, send };
}
