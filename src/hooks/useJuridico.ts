import { useQuery } from '@tanstack/react-query';
import { listarFontes } from '../api/juridico';
import type { FonteJuridica, Trilha } from '../api/types';

/**
 * As normas que o produto cita, indexadas por id.
 *
 * `staleTime: Infinity` porque texto de lei não muda enquanto o app está
 * aberto: uma norma nova chega com uma versão nova do servidor, e nesse dia a
 * pessoa já reabriu o app. Refazer esta requisição a cada foco de tela gastaria
 * rede para receber exatamente os mesmos quinze parágrafos.
 *
 * NÃO É BLOQUEANTE. Toda tela que usa isto já mostra o número antes — o número
 * vem da resposta dela, não daqui. Enquanto o corpus não chegou, o disclosure
 * mostra a citação legível que já veio no próprio achado (`fonte`), e é por isso
 * que aquele campo continua existindo.
 */
export function useFontesJuridicas() {
  const query = useQuery({
    queryKey: ['juridico', 'fontes'],
    queryFn: listarFontes,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const porId = new Map<string, FonteJuridica>((query.data ?? []).map((f) => [f.id, f]));

  return {
    fontes: query.data ?? [],
    porId,
    isPending: query.isPending,
    error: query.error,
  };
}

/**
 * A trilha de uma chave, dentro de uma lista que pode não tê-la.
 *
 * Existe para as telas não repetirem `trilhas.find(t => t.chave === '...')` com
 * a chave escrita à mão em cada uso — errar a string devolveria `undefined`
 * silenciosamente, e o disclosure sumiria sem ninguém notar.
 */
export function trilhaDe(trilhas: Trilha[] | undefined, chave: string): Trilha | undefined {
  return trilhas?.find((t) => t.chave === chave);
}
