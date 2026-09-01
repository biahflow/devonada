import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { ProvedorSocial, Sessao } from './types';

const CHAVE_ACESSO = 'auth_access';
const CHAVE_REFRESH = 'auth_refresh';

/**
 * POR ONDE ESTA SESSÃO ENTROU, quando foi por provedor (M13, ADR 0023).
 *
 * Serve a UMA pergunta, feita numa tela só: a exclusão de conta precisa saber
 * se reconfirma com senha ou reapresentando o provedor. Conta só-social não tem
 * senha, e pedir uma que ninguém escolheu deixaria essa pessoa sem como excluir
 * a conta — o que reprova na diretriz 5.1.1(v) da Apple.
 *
 * POR QUE NO APARELHO, E NÃO NUMA ROTA. A alternativa era um `GET /v1/conta`
 * devolvendo "tem senha?" e "qual provedor?". Ela existiria para uma tela, e
 * abriria a porta que `useConta` fechou de propósito: o app não busca dado da
 * conta porque nenhuma tela mostra dado da conta. Guardar por onde ESTE
 * aparelho entrou responde a mesma pergunta sem endpoint novo e sem pedir ao
 * servidor nada que já não esteja aqui.
 *
 * NÃO É DADO DO USUÁRIO: é o nome de um provedor, ao lado dos tokens, no mesmo
 * SecureStore e apagado pelo mesmo `esquecerSessao`. Entrar com senha o LIMPA —
 * quem entrou com senha tem senha, e é por ela que reconfirma.
 */
const CHAVE_PROVEDOR = 'auth_provedor';

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

/**
 * Por qual provedor esta sessão foi aberta, ou `null` para e-mail e senha.
 *
 * Erro de leitura devolve `null`, e não estoura: a consequência de não saber é
 * a tela de exclusão pedir a senha, que é o caminho de sempre.
 */
export async function provedorDaSessao(): Promise<ProvedorSocial | null> {
  try {
    const guardado = await SecureStore.getItemAsync(CHAVE_PROVEDOR);
    return guardado === 'apple' || guardado === 'google' ? guardado : null;
  } catch {
    return null;
  }
}

/**
 * Registra por onde a ENTRADA aconteceu. `null` para e-mail e senha.
 *
 * FUNÇÃO SEPARADA DE `guardarSessao`, e não um parâmetro dela, por um motivo
 * concreto: `client.ts` chama `guardarSessao` a cada rotação de refresh, que
 * acontece a cada 15 minutos de uso. Com o provedor dentro dela, a primeira
 * renovação apagaria o registro — e a tela de exclusão passaria a pedir senha
 * de quem nunca teve uma, exatamente o buraco que este dado existe para fechar.
 * Rotação de token não é troca de identidade, então ela não toca aqui.
 *
 * Chamar com `null` LIMPA: quem entrou pela Apple e depois criou senha pela
 * recuperação por e-mail volta a entrar por senha, e a partir daí é por ela que
 * reconfirma.
 */
export async function definirProvedor(provedor: ProvedorSocial | null): Promise<void> {
  if (provedor) {
    await SecureStore.setItemAsync(CHAVE_PROVEDOR, provedor);
  } else {
    await SecureStore.deleteItemAsync(CHAVE_PROVEDOR).catch(() => {});
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
  await SecureStore.deleteItemAsync(CHAVE_PROVEDOR).catch(() => {});
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
