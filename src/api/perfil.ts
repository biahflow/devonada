import { request } from './client';
import type { PerfilFinanceiro } from './types';

/**
 * Dependentes e preferências de lembrete.
 *
 * `rendaMensal` viaja aqui, mas é uma VISTA de `fonte_renda` (ver o campo em
 * `types.ts`): quem edita renda é `src/api/caixa.ts`. `comprometimentoRenda` e
 * `minimoExistencial` continuam sendo calculados no BACKEND — o front coleta e
 * exibe, e não aplica nenhuma regra de mínimo existencial.
 */
export function getPerfil() {
  return request<{ perfil: PerfilFinanceiro }>('/v1/perfil');
}

export function updatePerfil(perfil: PerfilFinanceiro) {
  return request<{ perfil: PerfilFinanceiro }>('/v1/perfil', { method: 'PUT', body: perfil });
}
