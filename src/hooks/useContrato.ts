import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  enviarContrato,
  getExtracao,
  type ArquivoContrato,
  type ExtracaoContrato,
} from '../api/contratos';
import type { Uuid } from '../api/types';

export const contratosKeys = {
  extracao: (id: Uuid) => ['contratos', id] as const,
};

/** Extração de contrato leva segundos, não milissegundos. */
export const INTERVALO_MS = 2500;

/**
 * Teto de espera. Polling infinito em rede móvel queima bateria — se em dois
 * minutos a extração não terminou, o usuário merece saber que algo travou em
 * vez de encarar um spinner eterno.
 */
export const MAX_ESPERA_MS = 120_000;
export const MAX_TENTATIVAS = Math.ceil(MAX_ESPERA_MS / INTERVALO_MS);

export function useEnviarContrato() {
  return useMutation({
    mutationFn: (arquivo: ArquivoContrato) => enviarContrato(arquivo),
  });
}

/**
 * Acompanha a extração. Para de consultar assim que o status sai de
 * 'processando', ou quando estoura o teto de tentativas.
 *
 * A contagem de tempo é feita por timer e por número de tentativas, nunca lendo
 * o relógio durante o render — `Date.now()` no corpo de um hook é impuro e
 * produz resultado instável entre renders.
 */
export function useExtracao(id: Uuid) {
  const [estourouTimer, setEstourouTimer] = useState(false);

  const query = useQuery({
    queryKey: contratosKeys.extracao(id),
    queryFn: () => getExtracao(id),
    enabled: !!id,
    refetchInterval: (q) => {
      const status = q.state.data?.extracao.status;
      if (status && status !== 'processando') return false;
      if (q.state.dataUpdateCount >= MAX_TENTATIVAS) return false;
      return INTERVALO_MS;
    },
  });

  const extracao: ExtracaoContrato | undefined = query.data?.extracao;
  const processando = extracao?.status === 'processando';

  useEffect(() => {
    if (!processando) return;
    const timer = setTimeout(() => setEstourouTimer(true), MAX_ESPERA_MS);
    return () => clearTimeout(timer);
  }, [processando]);

  // Derivado, e não estado resetado: quando a extração conclui, o aviso de
  // demora deixa de valer sozinho, sem precisar de um setState de limpeza.
  return { ...query, extracao, excedeuTempo: processando && estourouTimer };
}
