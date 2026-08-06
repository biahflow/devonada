import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getResumo } from '../api/resumo';
import { getPerfil, updatePerfil } from '../api/perfil';
import type { IsoMes, PerfilFinanceiro } from '../api/types';
import { dividasKeys } from './useDividas';

export const painelKeys = {
  resumo: (mes: IsoMes) => [...dividasKeys.all, 'resumo', mes] as const,
  perfil: ['perfil'] as const,
};

/**
 * A chave do resumo vive DENTRO do prefixo ['dividas'], então as mutações do M1
 * já o revalidam de graça: quitar uma dívida atualiza o painel sem que
 * useQuitarDivida precise saber que o painel existe.
 */
export function useResumo(mes: IsoMes) {
  const query = useQuery({
    queryKey: painelKeys.resumo(mes),
    queryFn: () => getResumo(mes),
    enabled: !!mes,
  });

  return { ...query, resumo: query.data?.resumo };
}

export function usePerfil() {
  const query = useQuery({
    queryKey: painelKeys.perfil,
    queryFn: getPerfil,
  });

  return { ...query, perfil: query.data?.perfil };
}

export function useAtualizarPerfil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (perfil: PerfilFinanceiro) => updatePerfil(perfil),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: painelKeys.perfil });
      // Mudar a renda muda comprometimento e mínimo existencial — todo o
      // resumo precisa ser recalculado pelo backend.
      queryClient.invalidateQueries({ queryKey: dividasKeys.all });
    },
  });
}
