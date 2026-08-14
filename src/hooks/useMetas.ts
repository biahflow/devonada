import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createMeta, deleteMeta, listMetas, updateMeta } from '../api/metas';
import type { MetaPatch, NovaMeta, Uuid } from '../api/types';

/**
 * Chave própria, fora de `['caixa']` de propósito: metas nomeadas não entram na
 * cascata, então invalidá-las não deve refazer a proposta de fechamento nem a
 * capacidade (docs/architecture.md, seção 4.1).
 */
export const metasKeys = {
  all: ['metas'] as const,
  detail: (id: Uuid) => ['metas', id] as const,
};

export function useMetasNomeadas() {
  const query = useQuery({ queryKey: metasKeys.all, queryFn: listMetas });
  return { ...query, metas: query.data?.metas ?? [] };
}

function useInvalidarMetas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: metasKeys.all });
}

/**
 * Sem atualização otimista, e por um motivo específico desta entidade: a
 * resposta traz `aporteSugerido` e `status` calculados pelo servidor. Uma versão
 * otimista teria de adivinhar os dois — e adivinhar "em dia" antes de o servidor
 * dizer é o tipo de mentira curta que o produto não pode contar.
 */
export function useCriarMeta() {
  const invalidar = useInvalidarMetas();
  return useMutation({ mutationFn: (input: NovaMeta) => createMeta(input), onSuccess: invalidar });
}

export function useAtualizarMeta(id: Uuid) {
  const invalidar = useInvalidarMetas();
  return useMutation({ mutationFn: (patch: MetaPatch) => updateMeta(id, patch), onSuccess: invalidar });
}

export function useExcluirMeta(id: Uuid) {
  const invalidar = useInvalidarMetas();
  return useMutation({ mutationFn: () => deleteMeta(id), onSuccess: invalidar });
}
