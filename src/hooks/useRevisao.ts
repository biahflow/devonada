import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { obterRevisao } from '../api/revisao';
import type { Canal, Uuid } from '../api/types';
import { dividasKeys } from './useDividas';

/**
 * Revisão de cobrança de uma dívida (M6/M12).
 *
 * A chave vive DENTRO do prefixo `['dividas']`, como a das parcelas e a do
 * resumo: baixar uma parcela muda o que a multa contestável somava, e
 * renegociar muda a taxa comparada com o teto. Com a chave aninhada, as
 * mutações do M1 e do M3 revalidam esta tela sem uma linha de código nova.
 *
 * O CANAL entra na chave: como o script muda por canal, sem ele trocar de canal
 * devolveria o cache do anterior — o pior tipo de bug de tela, intermitente. O
 * `valorJusto` e os achados são idênticos nos três; o que varia é só a forma.
 */
export const revisaoKeys = {
  daDivida: (dividaId: Uuid, canal: Canal) =>
    [...dividasKeys.detail(dividaId), 'revisao', canal] as const,
};

export function useRevisao(dividaId: Uuid, canal: Canal = 'email') {
  const query = useQuery({
    queryKey: revisaoKeys.daDivida(dividaId, canal),
    queryFn: () => obterRevisao(dividaId, canal),
    enabled: !!dividaId,
    // Trocar de canal não pode piscar a tela inteira em "carregando": o seletor
    // sumiria junto. Mantém a variante anterior enquanto a nova chega — os
    // achados e o valorJusto são idênticos nos três, então só o texto atualiza.
    placeholderData: keepPreviousData,
  });

  return { ...query, revisao: query.data?.revisao };
}
