import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listarNegociacoesDaDivida, registrarNegociacao } from '../api/negociacoes';
import type { RegistroNegociacaoInput, Uuid } from '../api/types';
import { dividasKeys } from './useDividas';

/**
 * Histórico de negociações de uma dívida (M12).
 *
 * A chave vive dentro do prefixo `['dividas']`, como parcelas e revisão: é o
 * que faz um registro novo revalidar a lista sem uma linha a mais.
 */
export const negociacoesKeys = {
  daDivida: (dividaId: Uuid) => [...dividasKeys.detail(dividaId), 'negociacoes'] as const,
};

export function useNegociacoesDaDivida(dividaId: Uuid) {
  const query = useQuery({
    queryKey: negociacoesKeys.daDivida(dividaId),
    queryFn: () => listarNegociacoesDaDivida(dividaId),
    enabled: !!dividaId,
  });

  return { ...query, resultados: query.data?.resultados ?? [] };
}

export function useRegistrarNegociacao(dividaId: Uuid) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegistroNegociacaoInput) => registrarNegociacao(dividaId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: negociacoesKeys.daDivida(dividaId) });
    },
  });
}
