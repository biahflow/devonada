import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { Sessao } from './types';

const CHAVE_ACESSO = 'auth_access';
const CHAVE_REFRESH = 'auth_refresh';

/**
 * O ÚNICO estado global do app, autorizado pela ADR 0012.
 *
 * `docs/architecture.md`, seção 4, declara que não há store global e que a
 * primeira necessidade real vira ADR antes de virar dependência. Esta é ela — e
 * o escopo é o mínimo: três estados e nada mais. Não guarda e-mail, não guarda
 * nome, não guarda dado do usuário. Os tokens ficam no `expo-secure-store`, que
 * é onde credencial mora (guardrails, seção 5).
 *
 * Ele existe porque a expiração vem DE BAIXO e é assíncrona: uma renovação que
 * falha no meio de uma requisição precisa levar o app inteiro para o login, e
 * não há prop para descer isso de `_layout.tsx` até dentro de `client.ts`.
 *
 * Trinta linhas e nenhuma biblioteca. "Já existe um store" não é argumento para
 * o próximo estado global — esse precisa da própria ADR.
 */
export type EstadoSessao = 'carregando' | 'anonimo' | 'autenticado';

let estado: EstadoSessao = 'carregando';
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function ler(): EstadoSessao {
  return estado;
}

export function useSessao(): EstadoSessao {
  return useSyncExternalStore(assinar, ler, ler);
}

/** Fora de componente — para `client.ts`, que não é React. */
export function estadoAtual(): EstadoSessao {
  return estado;
}

function definir(novo: EstadoSessao) {
  if (estado === novo) return;
  estado = novo;
  avisar();
}

export async function tokenDeAcesso(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CHAVE_ACESSO);
  } catch {
    return null;
  }
}

export async function tokenDeRenovacao(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CHAVE_REFRESH);
  } catch {
    return null;
  }
}

/** Grava o par e marca a sessão como aberta. */
export async function guardarSessao(sessao: Sessao): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_ACESSO, sessao.acesso);
  await SecureStore.setItemAsync(CHAVE_REFRESH, sessao.refresh);
  definir('autenticado');
}

/**
 * Apaga a credencial local. Não chama o servidor — quem faz isso é a tela, e
 * ela chama isto DEPOIS, mesmo que a rede falhe: um logout que trava porque o
 * servidor não respondeu deixa a pessoa presa numa sessão que ela pediu para
 * encerrar. O refresh órfão expira em 30 dias de qualquer forma.
 */
export async function esquecerSessao(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_ACESSO).catch(() => {});
  await SecureStore.deleteItemAsync(CHAVE_REFRESH).catch(() => {});
  definir('anonimo');
}

/**
 * Lê o aparelho na abertura do app.
 *
 * Presença de refresh basta: o access quase sempre está vencido depois de o app
 * ficar fechado, e exigir que ele valha mandaria para o login quem tem sessão
 * boa. Se o refresh não servir mais, a primeira requisição descobre isso e
 * `client.ts` derruba a sessão.
 */
export async function carregarSessao(): Promise<EstadoSessao> {
  const refresh = await tokenDeRenovacao();
  definir(refresh ? 'autenticado' : 'anonimo');
  return estado;
}
