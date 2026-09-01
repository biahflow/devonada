import { request } from './client';
import type { FonteJuridica } from './types';

/**
 * O corpus jurídico que sustenta os números do produto (M14).
 *
 * UMA REQUISIÇÃO, O CORPUS INTEIRO. Ele é pequeno, estático e lido por quase
 * toda tela que mostra número derivado — buscar norma por norma faria cada
 * disclosure "como calculamos" aberto custar uma ida à rede, e o app deixaria
 * de conseguir mostrar a fonte logo depois de já ter mostrado o número que ela
 * sustenta.
 */
export async function listarFontes(): Promise<FonteJuridica[]> {
  const { fontes } = await request<{ fontes: FonteJuridica[] }>('/v1/juridico/fontes');
  return fontes;
}
