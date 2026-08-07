import { request } from './client';
import { esquecerSessao, guardarSessao, tokenDeRenovacao } from './sessao';
import type { RespostaSessao } from './types';

/**
 * As rotas de conta. As únicas do app que não exigem sessão — e por isso as
 * únicas que passam `semRenovacao`: renovar antes de existir sessão não faz
 * sentido, e um 401 de credencial errada não é sessão vencida.
 */

async function abrirSessao(path: string, body: unknown): Promise<void> {
  const { sessao } = await request<RespostaSessao>(path, {
    method: 'POST',
    body,
    semRenovacao: true,
  });
  await guardarSessao(sessao);
}

export function registrar(email: string, senha: string): Promise<void> {
  return abrirSessao('/v1/auth/registro', { email, senha });
}

export function entrar(email: string, senha: string): Promise<void> {
  return abrirSessao('/v1/auth/login', { email, senha });
}

/**
 * Pede o código. NÃO devolve se o e-mail existe — o servidor responde 202 de
 * qualquer jeito, e a tela diz "se esse e-mail estiver cadastrado".
 */
export function pedirCodigo(email: string): Promise<void> {
  return request('/v1/auth/senha/recuperacao', {
    method: 'POST',
    body: { email },
    semRenovacao: true,
  });
}

export function redefinirSenha(email: string, codigo: string, senha: string): Promise<void> {
  return abrirSessao('/v1/auth/senha/redefinicao', { email, codigo, senha });
}

/**
 * A credencial local é apagada MESMO SE o servidor não responder.
 *
 * Um logout que trava porque a rede caiu deixa a pessoa presa numa sessão que
 * ela pediu para encerrar — e o refresh órfão expira em 30 dias de qualquer
 * forma. A ordem importa: avisar o servidor primeiro, esquecer sempre.
 */
export async function sair(): Promise<void> {
  const refresh = await tokenDeRenovacao();
  try {
    await request('/v1/auth/logout', { method: 'POST', body: { refresh }, semRenovacao: true });
  } catch {
    // Sem tratamento de propósito: ver acima.
  }
  await esquecerSessao();
}

/** Apaga a conta e tudo que é dela. Irreversível — a tela confirma antes. */
export async function excluirConta(senha: string): Promise<void> {
  await request('/v1/conta', { method: 'DELETE', body: { senha } });
  await esquecerSessao();
}
