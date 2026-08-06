import { request } from './client';
import type { RespostaSimulacao, SimulacaoParams } from './types';

/**
 * Simulação de quitação. É `POST` porque o payload é estruturado, mas a
 * chamada é LEITURA: não cria nem altera nada no servidor. Por isso ela vive
 * num `useQuery` (ver `src/hooks/useSimulacao.ts`).
 *
 * Toda a matemática de amortização acontece do outro lado — ADR 0003 e
 * guardrail 1.2, que proíbem rodar avalanche ou bola de neve aqui pelo nome.
 */
export function simular(params: SimulacaoParams) {
  return request<RespostaSimulacao>('/v1/dividas/simulacoes', {
    method: 'POST',
    body: params,
  });
}
