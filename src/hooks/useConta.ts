import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  entrar,
  entrarComProvedor,
  excluirConta,
  pedirCodigo,
  redefinirSenha,
  registrar,
  sair,
} from '../api/auth';
import type { ReconfirmacaoDeExclusao } from '../api/auth';
import { obterTokenSocial } from '../social';
import type { ProvedorSocial } from '../api/types';

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

/**
 * Entrar pela Apple ou pelo Google.
 *
 * O FLUXO DO PROVEDOR E A CHAMADA À NOSSA API VIVEM NA MESMA MUTAÇÃO, e não em
 * duas: da tela para o usuário é um toque só, e separá-las obrigaria a screen a
 * orquestrar dois estados de carregando que descrevem a mesma espera.
 *
 * DESISTIR NÃO É ERRO. Quem fecha a folha do provedor recebe `cancelado: true`
 * e a tela não mostra mensagem nenhuma — nem sucesso, nem falha. Tratar
 * cancelamento como erro faria o app acusar de problema um gesto normal.
 */
export function useEntrarComProvedor() {
  const limpar = useLimparCache();
  return useMutation({
    mutationFn: async (provedor: ProvedorSocial) => {
      const token = await obterTokenSocial(provedor);
      if (token === null) return { cancelado: true as const };

      await entrarComProvedor(provedor, token);
      return { cancelado: false as const };
    },
    onSuccess: (resultado) => {
      if (!resultado.cancelado) limpar();
    },
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
  return useMutation({
    mutationFn: (reconfirmacao: ReconfirmacaoDeExclusao) => excluirConta(reconfirmacao),
    onSuccess: limpar,
  });
}

/**
 * Exclusão de conta que não tem senha (ADR 0023).
 *
 * ABRE A FOLHA DO PROVEDOR E EXCLUI NA MESMA MUTAÇÃO, pelo mesmo motivo de
 * `useEntrarComProvedor`: para quem está na tela é uma espera só, e dois estados
 * de carregando descreveriam a mesma coisa duas vezes.
 *
 * DESISTIR NO PROVEDOR NÃO EXCLUI NADA e não é erro — `cancelado: true`, e a
 * conta continua lá. É a terceira chance de voltar atrás, depois do botão e do
 * alerta nativo.
 */
export function useExcluirContaComProvedor() {
  const limpar = useLimparCache();
  return useMutation({
    mutationFn: async (provedor: ProvedorSocial) => {
      const token = await obterTokenSocial(provedor);
      if (token === null) return { cancelado: true as const };

      await excluirConta({ provedor, token });
      return { cancelado: false as const };
    },
    onSuccess: (resultado) => {
      if (!resultado.cancelado) limpar();
    },
  });
}
