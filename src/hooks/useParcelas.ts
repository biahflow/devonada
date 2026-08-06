import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listarParcelas, pagarParcela, renegociar } from '../api/parcelas';
import type { PagamentoInput, Parcela, RenegociacaoInput, Uuid } from '../api/types';
import { dividasKeys } from './useDividas';

export const parcelasKeys = {
  daDivida: (dividaId: Uuid) => [...dividasKeys.detail(dividaId), 'parcelas'] as const,
};

export function useParcelas(dividaId: Uuid) {
  const query = useQuery({
    queryKey: parcelasKeys.daDivida(dividaId),
    queryFn: () => listarParcelas(dividaId),
    enabled: !!dividaId,
  });

  return { ...query, parcelas: query.data?.parcelas ?? [] };
}

/**
 * Marcar parcela como paga — o PRIMEIRO uso de atualização otimista no projeto,
 * deliberado desde o M1.
 *
 * Aqui o otimismo se justifica: a mudança é local e o rollback é trivial (basta
 * devolver a lista anterior). Em criação não daria — o id só existe depois da
 * resposta.
 *
 * Invalida `['dividas']` INTEIRO no fim, não só as parcelas: quitar uma parcela
 * muda o resumo do painel e pode quitar a dívida. A tela não precisa saber
 * disso.
 */
export function usePagarParcela(dividaId: Uuid) {
  const queryClient = useQueryClient();
  const chave = parcelasKeys.daDivida(dividaId);

  return useMutation({
    mutationFn: ({ parcelaId, input }: { parcelaId: Uuid; input: PagamentoInput }) =>
      pagarParcela(parcelaId, input),

    onMutate: async ({ parcelaId, input }) => {
      // Cancela refetch em voo: uma resposta antiga chegando depois
      // sobrescreveria o estado otimista.
      await queryClient.cancelQueries({ queryKey: chave });
      const anterior = queryClient.getQueryData<{ parcelas: Parcela[] }>(chave);

      queryClient.setQueryData<{ parcelas: Parcela[] }>(chave, (atual) =>
        atual
          ? {
              parcelas: atual.parcelas.map((p) =>
                p.id === parcelaId
                  ? {
                      ...p,
                      situacao: 'paga' as const,
                      pagoEm: input.pagoEm,
                      valorPago: input.valorPago,
                    }
                  : p,
              ),
            }
          : atual,
      );

      return { anterior };
    },

    onError: (_erro, _vars, contexto) => {
      // Rollback: devolve exatamente o que havia antes.
      if (contexto?.anterior) queryClient.setQueryData(chave, contexto.anterior);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dividasKeys.all });
    },
  });
}

export function useRenegociar(dividaId: Uuid) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RenegociacaoInput) => renegociar(dividaId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dividasKeys.all });
    },
  });
}
