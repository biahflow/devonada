import { request } from './client';
import {
  definirProvedor,
  esquecerSessao,
  guardarSessao,
  tokenDeRenovacao,
} from './sessao';
import type { ProvedorSocial, RespostaSessao } from './types';

/**
 * As rotas de conta. As únicas do app que não exigem sessão — e por isso as
 * únicas que passam `semRenovacao`: renovar antes de existir sessão não faz
 * sentido, e um 401 de credencial errada não é sessão vencida.
 */

async function abrirSessao(
  path: string,
  body: unknown,
  provedor: ProvedorSocial | null = null,
): Promise<void> {
  const { sessao } = await request<RespostaSessao>(path, {
    method: 'POST',
    body,
    semRenovacao: true,
  });
  await guardarSessao(sessao);
  // Toda entrada declara por onde entrou, inclusive as que entram por senha —
  // com `null`, que APAGA um provedor antigo. Ver `definirProvedor`.
  await definirProvedor(provedor);
}

export function registrar(email: string, senha: string): Promise<void> {
  return abrirSessao('/v1/auth/registro', { email, senha });
}

export function entrar(email: string, senha: string): Promise<void> {
  return abrirSessao('/v1/auth/login', { email, senha });
}

/**
 * Entra pela Apple ou pelo Google (M13, ADR 0023).
 *
 * O QUE SOBE É SÓ O TOKEN. E-mail, nome e `sub` estão dentro dele, assinados
 * pelo provedor; mandar ao lado a versão que o aparelho leu seria deixar o
 * cliente afirmar quem ele é, e o servidor ignoraria de qualquer forma.
 *
 * `semRenovacao`, como as outras rotas de entrada: renovar antes de existir
 * sessão não faz sentido, e um 401 aqui é token recusado, não sessão vencida.
 */
export function entrarComProvedor(provedor: ProvedorSocial, token: string): Promise<void> {
  return abrirSessao('/v1/auth/social', { provedor, token }, provedor);
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

/**
 * Apaga a conta e tudo que é dela. Irreversível — a tela confirma antes.
 *
 * DUAS RECONFIRMAÇÕES POSSÍVEIS porque há dois tipos de conta (ADR 0023): quem
 * tem senha manda a senha; quem entrou pela Apple ou pelo Google reapresenta o
 * provedor. Quem decide qual é a tela, que sabe por onde esta sessão entrou; o
 * servidor confere a que a conta exige e recusa a outra.
 */
export type ReconfirmacaoDeExclusao =
  | { senha: string }
  | { provedor: ProvedorSocial; token: string };

export async function excluirConta(reconfirmacao: ReconfirmacaoDeExclusao): Promise<void> {
  await request('/v1/conta', { method: 'DELETE', body: reconfirmacao });
  await esquecerSessao();
}
