import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDebt,
  deleteDebt,
  getDebt,
  ligarDocumento,
  listDebts,
  quitarDebt,
  updateDebt,
  type DocumentoDaDivida,
  type NovaDivida,
  type PatchDivida,
  type QuitacaoInput,
} from '../api/debts';
import type { Uuid } from '../api/types';
import { ordenarDividas, type OrdemDivida } from '../util/dividas';

/**
 * Chaves hierárquicas (docs/architecture.md, seção 4.1). Invalidar o prefixo
 * ['dividas'] alcança a coleção, cada item e o resumo do painel de uma vez.
 */
export const dividasKeys = {
  all: ['dividas'] as const,
  detail: (id: Uuid) => ['dividas', id] as const,
};

export function useDividas(ordem: OrdemDivida = 'criticidade') {
  const query = useQuery({
    queryKey: dividasKeys.all,
    queryFn: listDebts,
  });

  // Ordenar no render, não no queryFn: trocar a ordem não deve refazer rede.
  const dividas = useMemo(
    () => (query.data ? ordenarDividas(query.data.dividas, ordem) : []),
    [query.data, ordem],
  );

  return { ...query, dividas };
}

export function useDivida(id: Uuid) {
  return useQuery({
    queryKey: dividasKeys.detail(id),
    queryFn: () => getDebt(id),
    enabled: !!id,
  });
}

/**
 * Toda mutação invalida o prefixo inteiro, não só o item afetado: o resumo do
 * painel (M2) deriva dos mesmos dados. A tela não precisa saber disso.
 *
 * Sem atualização otimista aqui — na criação o id só existe depois da resposta,
 * e nas demais o custo de errar não paga o rollback. Otimismo entra no M3, ao
 * marcar parcela paga.
 */
function useInvalidarDividas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: dividasKeys.all });
}

export function useCriarDivida() {
  const invalidar = useInvalidarDividas();
  return useMutation({
    mutationFn: (input: NovaDivida) => createDebt(input),
    onSuccess: invalidar,
  });
}

export function useAtualizarDivida(id: Uuid) {
  const invalidar = useInvalidarDividas();
  return useMutation({
    mutationFn: (patch: PatchDivida) => updateDebt(id, patch),
    onSuccess: invalidar,
  });
}

/**
 * Liga o documento à dívida (F-019). Vínculo e campos aceitos viajam na MESMA
 * chamada — partir em PATCH + POST criaria a falha parcial pior possível: os
 * campos do documento gravados e o vínculo não (ADR 0025, decisão 2).
 */
export function useLigarDocumento(id: Uuid) {
  const invalidar = useInvalidarDividas();
  return useMutation({
    mutationFn: (corpo: DocumentoDaDivida) => ligarDocumento(id, corpo),
    onSuccess: invalidar,
  });
}

export function useQuitarDivida(id: Uuid) {
  const invalidar = useInvalidarDividas();
  return useMutation({
    mutationFn: (input: QuitacaoInput) => quitarDebt(id, input),
    onSuccess: invalidar,
  });
}

export function useExcluirDivida(id: Uuid) {
  const invalidar = useInvalidarDividas();
  return useMutation({
    mutationFn: () => deleteDebt(id),
    onSuccess: invalidar,
  });
}
