import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  entrar,
  excluirConta,
  pedirCodigo,
  redefinirSenha,
  registrar,
  sair,
} from '../api/auth';

/**
 * Conta é MUTAÇÃO, nunca query.
 *
 * Não há `useConta()` que devolva o usuário logado, e é de propósito: o app não
 * tem tela que exiba dado da conta, então buscá-lo seria pedir dado pessoal que
 * nenhuma tela usa (guardrails, seção 5 — minimização). Quem precisa saber se
 * há sessão pergunta ao `useSessao`, que não vai à rede.
 */

/**
 * Cache limpo a cada troca de sessão.
 *
 * Sem isto, a lista de dívidas de quem saiu fica no cache e aparece por um
 * instante para quem entra em seguida no mesmo aparelho — vazamento
 * cross-tenant do lado do cliente, que o filtro por tenant do servidor não
 * alcança (guardrails, seção 6).
 */
function useLimparCache() {
  const queryClient = useQueryClient();
  return () => queryClient.clear();
}

export function useEntrar() {
  const limpar = useLimparCache();
  return useMutation({
    mutationFn: ({ email, senha }: { email: string; senha: string }) => entrar(email, senha),
    onSuccess: limpar,
  });
}

export function useRegistrar() {
  const limpar = useLimparCache();
  return useMutation({
    mutationFn: ({ email, senha }: { email: string; senha: string }) => registrar(email, senha),
    onSuccess: limpar,
  });
}

export function usePedirCodigo() {
  return useMutation({ mutationFn: (email: string) => pedirCodigo(email) });
}

export function useRedefinirSenha() {
  const limpar = useLimparCache();
  return useMutation({
    mutationFn: (dados: { email: string; codigo: string; senha: string }) =>
      redefinirSenha(dados.email, dados.codigo, dados.senha),
    onSuccess: limpar,
  });
}

export function useSair() {
  const limpar = useLimparCache();
  return useMutation({ mutationFn: sair, onSuccess: limpar });
}

export function useExcluirConta() {
  const limpar = useLimparCache();
  return useMutation({ mutationFn: (senha: string) => excluirConta(senha), onSuccess: limpar });
}
