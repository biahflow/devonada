import { useQuery } from '@tanstack/react-query';
import { obterRevisao } from '../api/revisao';
import type { Uuid } from '../api/types';
import { dividasKeys } from './useDividas';

/**
 * Revisão de cobrança de uma dívida (M6).
 *
 * A chave vive DENTRO do prefixo `['dividas']`, como a das parcelas e a do
 * resumo: baixar uma parcela muda o que a multa contestável somava, e
 * renegociar muda a taxa comparada com o teto. Com a chave aninhada, as
 * mutações do M1 e do M3 revalidam esta tela sem uma linha de código nova.
 */
export const revisaoKeys = {
  daDivida: (dividaId: Uuid) => [...dividasKeys.detail(dividaId), 'revisao'] as const,
};

export function useRevisao(dividaId: Uuid) {
  const query = useQuery({
    queryKey: revisaoKeys.daDivida(dividaId),
    queryFn: () => obterRevisao(dividaId),
    enabled: !!dividaId,
  });

  return { ...query, revisao: query.data?.revisao };
}
