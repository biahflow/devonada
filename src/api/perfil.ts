import { request } from './client';
import type { PerfilFinanceiro } from './types';

/**
 * Renda e dependentes do usuário. É o insumo de `comprometimentoRenda` e
 * `minimoExistencial` — que continuam sendo calculados no BACKEND. O front
 * coleta e exibe; não aplica nenhuma regra de mínimo existencial.
 */
export function getPerfil() {
  return request<{ perfil: PerfilFinanceiro }>('/v1/perfil');
}

export function updatePerfil(perfil: PerfilFinanceiro) {
  return request<{ perfil: PerfilFinanceiro }>('/v1/perfil', { method: 'PUT', body: perfil });
}
