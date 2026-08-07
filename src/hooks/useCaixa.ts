import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  atualizarFonte,
  atualizarGasto,
  atualizarProvisao,
  criarFonte,
  criarGasto,
  criarProvisao,
  excluirFonte,
  excluirGasto,
  excluirProvisao,
  getCaixa,
  getHistoricoCaixa,
  getMetas,
  listarFontes,
  listarGastos,
  listarProvisoes,
  registrarRecebimento,
  updateMetas,
  type NovaFonteRenda,
  type NovaProvisao,
  type NovoGasto,
} from '../api/caixa';
import type { MetasCaixa, Uuid } from '../api/types';
import { dividasKeys } from './useDividas';

/**
 * Chaves hierárquicas: invalidar `['caixa']` alcança a cascata, as listas e as
 * metas de uma vez (docs/architecture.md, seção 4.1).
 */
export const caixaKeys = {
  all: ['caixa'] as const,
  cascata: ['caixa', 'cascata'] as const,
  fontes: ['caixa', 'fontes'] as const,
  gastos: ['caixa', 'gastos'] as const,
  provisoes: ['caixa', 'provisoes'] as const,
  metas: ['caixa', 'metas'] as const,
  historico: ['caixa', 'historico'] as const,
};

export function useCaixa() {
  const query = useQuery({ queryKey: caixaKeys.cascata, queryFn: getCaixa });
  return { ...query, caixa: query.data?.caixa };
}

export function useHistoricoCaixa() {
  const query = useQuery({ queryKey: caixaKeys.historico, queryFn: getHistoricoCaixa });
  return { ...query, snapshots: query.data?.snapshots ?? [] };
}

export function useFontes() {
  const query = useQuery({ queryKey: caixaKeys.fontes, queryFn: listarFontes });
  return { ...query, fontes: query.data?.fontes ?? [] };
}

export function useGastos() {
  const query = useQuery({ queryKey: caixaKeys.gastos, queryFn: listarGastos });
  return { ...query, gastos: query.data?.gastos ?? [] };
}

export function useProvisoes() {
  const query = useQuery({ queryKey: caixaKeys.provisoes, queryFn: listarProvisoes });
  return { ...query, provisoes: query.data?.provisoes ?? [] };
}

export function useMetas() {
  const query = useQuery({ queryKey: caixaKeys.metas, queryFn: getMetas });
  return { ...query, metas: query.data?.metas };
}

/**
 * Toda mutação de caixa invalida `['caixa']` E `['dividas']`.
 *
 * A segunda invalidação não é exagero: mudar a renda muda a capacidade, que é o
 * teto do aporte do simulador e o valor da oferta no script de negociação. Duas
 * telas exibindo capacidades diferentes destruiriam a confiança no número — e é
 * justamente esse número que o usuário leva a um credor.
 */
function useInvalidarCaixa() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: caixaKeys.all });
    queryClient.invalidateQueries({ queryKey: dividasKeys.all });
  };
}

export function useCriarFonte() {
  const invalidar = useInvalidarCaixa();
  return useMutation({
    mutationFn: (fonte: NovaFonteRenda) => criarFonte(fonte),
    onSuccess: invalidar,
  });
}

export function useAtualizarFonte() {
  const invalidar = useInvalidarCaixa();
  return useMutation({
    mutationFn: ({ id, patch }: { id: Uuid; patch: Partial<NovaFonteRenda> }) =>
      atualizarFonte(id, patch),
    onSuccess: invalidar,
  });
}

export function useExcluirFonte() {
  const invalidar = useInvalidarCaixa();
  return useMutation({ mutationFn: (id: Uuid) => excluirFonte(id), onSuccess: invalidar });
}

export function useRegistrarRecebimento() {
  const invalidar = useInvalidarCaixa();
  return useMutation({
    mutationFn: ({ fonteId, mes, valor }: { fonteId: Uuid; mes: string; valor: number }) =>
      registrarRecebimento(fonteId, mes, valor),
    onSuccess: invalidar,
  });
}

export function useCriarGasto() {
  const invalidar = useInvalidarCaixa();
  return useMutation({ mutationFn: (gasto: NovoGasto) => criarGasto(gasto), onSuccess: invalidar });
}

export function useAtualizarGasto() {
  const invalidar = useInvalidarCaixa();
  return useMutation({
    mutationFn: ({ id, patch }: { id: Uuid; patch: Partial<NovoGasto> }) =>
      atualizarGasto(id, patch),
    onSuccess: invalidar,
  });
}

export function useExcluirGasto() {
  const invalidar = useInvalidarCaixa();
  return useMutation({ mutationFn: (id: Uuid) => excluirGasto(id), onSuccess: invalidar });
}

export function useCriarProvisao() {
  const invalidar = useInvalidarCaixa();
  return useMutation({
    mutationFn: (provisao: NovaProvisao) => criarProvisao(provisao),
    onSuccess: invalidar,
  });
}

export function useAtualizarProvisao() {
  const invalidar = useInvalidarCaixa();
  return useMutation({
    mutationFn: ({ id, patch }: { id: Uuid; patch: Partial<NovaProvisao> }) =>
      atualizarProvisao(id, patch),
    onSuccess: invalidar,
  });
}

export function useExcluirProvisao() {
  const invalidar = useInvalidarCaixa();
  return useMutation({ mutationFn: (id: Uuid) => excluirProvisao(id), onSuccess: invalidar });
}

export function useAtualizarMetas() {
  const invalidar = useInvalidarCaixa();
  return useMutation({ mutationFn: (metas: MetasCaixa) => updateMetas(metas), onSuccess: invalidar });
}
