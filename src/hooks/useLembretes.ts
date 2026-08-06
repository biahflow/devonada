import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listarLembretes } from '../api/parcelas';
import { dividasKeys } from './useDividas';
import { reagendar } from '../notificacoes';

export const lembretesKeys = {
  todos: [...dividasKeys.all, 'lembretes'] as const,
};

/**
 * Carrega os lembretes e reagenda as notificações locais.
 *
 * A chave vive dentro do prefixo ['dividas'], então pagar uma parcela — que já
 * invalida esse prefixo — recarrega os lembretes e reagenda de graça. É o que
 * impede uma parcela paga de continuar avisando.
 */
export function useLembretes(ativo: boolean) {
  const [agendados, setAgendados] = useState<number | null>(null);

  const query = useQuery({
    queryKey: lembretesKeys.todos,
    queryFn: listarLembretes,
    enabled: ativo,
  });

  const lembretes = query.data?.lembretes;
  const hora = query.data?.horaLembrete;

  useEffect(() => {
    if (!ativo || !lembretes || !hora) return;
    let cancelado = false;

    reagendar(lembretes, hora).then((n) => {
      if (!cancelado) setAgendados(n);
    });

    return () => {
      cancelado = true;
    };
  }, [ativo, lembretes, hora]);

  return { ...query, lembretes: lembretes ?? [], agendados };
}
