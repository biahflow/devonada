import { request } from './client';
import type { Marco, TipoDeMarco } from './types';

/**
 * Marcos (M11, ADR 0019, item 4).
 *
 * MARCO É EVENTO PERSISTIDO, NÃO PREDICADO. O app não recalcula nada aqui — nem
 * "já quitou uma", nem a porcentagem da rota. Um marco derivado do estado atual
 * se DESFARIA quando o usuário cadastra uma dívida nova e a rota anda para trás,
 * e perder uma conquista por ter sido honesto sobre a própria situação é o
 * oposto do que este produto faz (docs/api-contract.md, seção 3.13).
 */
export function getMarcos() {
  return request<{ marcos: Marco[] }>('/v1/marcos');
}

/**
 * Grava `celebradoEm` — é isto que impede a tela de reaparecer a cada abertura
 * do app. `204`, sem corpo.
 *
 * IDEMPOTENTE: celebrar de novo não move a data. É escrita, então passa pela
 * trava de assinatura como qualquer outra e pode devolver `402` — e o marco
 * atingido nesse período NÃO se perde: fica com `celebradoEm: null` e a tela
 * volta quando a assinatura voltar.
 */
export function celebrarMarco(tipo: TipoDeMarco) {
  return request<void>(`/v1/marcos/${tipo}/celebracao`, { method: 'POST' });
}
