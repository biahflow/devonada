import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { simular } from '../api/simulacoes';
import type { EstrategiaQuitacao, SimulacaoParams } from '../api/types';
import { dividasKeys } from './useDividas';

/** As duas, sempre: a comparação é a razão de ser da tela. */
export const ESTRATEGIAS: EstrategiaQuitacao[] = ['avalanche', 'bola_de_neve'];

export const simulacaoKeys = {
  /** ['dividas', 'simulacao', params] — a chave prevista em architecture.md, 4.1. */
  com: (aporteExtraMensal: number) =>
    [...dividasKeys.all, 'simulacao', { aporteExtraMensal }] as const,
};

/**
 * Resultado da simulação para um aporte extra.
 *
 * `keepPreviousData` porque o aporte muda enquanto o usuário arrasta o slider:
 * sem ele a tela piscaria para o estado de carregamento a cada consulta, e o
 * número que o usuário está justamente tentando comparar sumiria da frente
 * dele. O debounce de quem chama evita a rajada de requisições.
 *
 * A chave vive dentro do prefixo ['dividas'], então quitar uma parcela ou
 * editar uma dívida já invalida a simulação de graça.
 */
export function useSimulacao(aporteExtraMensal: number) {
  const params: SimulacaoParams = {
    aporteExtraMensal,
    estrategias: ESTRATEGIAS,
    dividasIds: null,
  };

  const query = useQuery({
    queryKey: simulacaoKeys.com(aporteExtraMensal),
    queryFn: () => simular(params),
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    simulacoes: query.data?.simulacoes ?? [],
    comparacao: query.data?.comparacao ?? undefined,
    dividasSemTaxa: query.data?.dividasSemTaxa ?? [],
  };
}
