import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Purchase } from 'expo-iap';
import { getAssinatura, registrarCompra } from '../api/assinatura';
import {
  LojaIndisponivel,
  aoComprar,
  comprar,
  encerrar,
  plataformaAtual,
  produtos,
  reciboDe,
  restaurar,
  type ProdutoDaLoja,
} from '../compras';

export const assinaturaKeys = {
  situacao: ['assinatura'] as const,
};

/**
 * A situação vinda do backend.
 *
 * `staleTime` curto de propósito: ela muda por fora do app — a loja renova, o
 * teste vence à meia-noite —, e é a resposta que decide se a próxima escrita
 * leva 402. Cache longo mostraria "em dia" para quem já está bloqueado.
 */
export function useAssinatura() {
  const query = useQuery({
    queryKey: assinaturaKeys.situacao,
    queryFn: getAssinatura,
    staleTime: 60_000,
  });

  return { ...query, situacao: query.data };
}

/** Os planos que a loja oferece, com o preço dela. */
export function useProdutos() {
  const [lista, setLista] = useState<ProdutoDaLoja[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | undefined>();

  useEffect(() => {
    let vivo = true;

    produtos()
      .then((p) => vivo && setLista(p))
      .catch((e) =>
        vivo &&
        setErro(
          e instanceof LojaIndisponivel
            ? 'Não deu para falar com a loja do seu aparelho. Tente de novo em instantes.'
            : 'Não deu para carregar os planos agora.',
        ),
      )
      .finally(() => vivo && setCarregando(false));

    return () => {
      vivo = false;
    };
  }, []);

  return { produtos: lista, carregando, erro };
}

/**
 * Compra e restauração, com o ciclo completo em um lugar só.
 *
 * A ORDEM É A REGRA DESTE ARQUIVO: a loja entrega a compra por evento → o
 * backend confere com a loja → só então `encerrar` tira a transação da fila.
 * Encerrar antes de confirmar deixaria o usuário cobrado com o servidor sem
 * saber, e a loja não reentrega o que já foi reconhecido — ele ficaria pagando
 * por um app travado.
 */
export function useComprar() {
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | undefined>();
  const [processando, setProcessando] = useState(false);

  const registrar = useMutation({
    mutationFn: (recibo: string) => registrarCompra(plataformaAtual(), recibo),
    onSuccess: (situacao) => {
      queryClient.setQueryData(assinaturaKeys.situacao, situacao);
      // O 402 pode ter deixado telas com erro no cache. Assinar volta a
      // liberar a escrita, e o app inteiro precisa reconsultar.
      queryClient.invalidateQueries();
    },
  });

  // `registrar.mutateAsync` e NÃO `registrar`: o objeto devolvido por
  // `useMutation` é novo a cada render, e depender dele faria o efeito abaixo
  // remover e reinstalar os listeners da loja em todo ciclo de render — uma
  // compra entregue no meio da troca cairia no vão. `mutateAsync` é referência
  // estável no TanStack Query v5, e é por isso que ele existe separado.
  const enviarRecibo = registrar.mutateAsync;

  const processar = useCallback(
    async (compra: Purchase) => {
      const recibo = reciboDe(compra);
      if (!recibo) {
        setErro('A loja não devolveu um comprovante desta compra. Toque em restaurar.');
        return;
      }

      setProcessando(true);
      try {
        await enviarRecibo(recibo);
        await encerrar(compra);
        setErro(undefined);
      } catch (e) {
        // NÃO encerramos a transação aqui. Ela fica na fila da loja e volta na
        // próxima abertura do app, que é o que dá uma segunda chance a quem
        // pagou e perdeu a rede no pior instante.
        setErro(
          e instanceof Error ? e.message : 'Não deu para confirmar sua compra. Tente restaurar.',
        );
      } finally {
        setProcessando(false);
      }
    },
    [enviarRecibo],
  );

  // A COMPRA PODE CHEGAR SEM O USUÁRIO ESTAR NESTA TELA — cobrança pendente que
  // o banco aprovou depois, compra feita em outro aparelho. Por isso o listener
  // é montado assim que o hook existe, e não dentro do botão.
  useEffect(() => {
    return aoComprar(
      (compra) => void processar(compra),
      (mensagem) => setErro(mensagem),
    );
  }, [processar]);

  const iniciar = useCallback(async () => {
    setErro(undefined);
    try {
      await comprar();
    } catch (e) {
      setErro(
        e instanceof LojaIndisponivel
          ? 'Não deu para abrir a loja do seu aparelho. Tente de novo em instantes.'
          : 'Não deu para iniciar a compra. Tente de novo.',
      );
    }
  }, []);

  const restaurarCompras = useCallback(async () => {
    setErro(undefined);
    setProcessando(true);
    try {
      const compras = await restaurar();
      if (compras.length === 0) {
        setErro('Não encontramos nenhuma assinatura nesta conta da loja.');
        return;
      }
      for (const compra of compras) await processar(compra);
    } catch {
      setErro('Não deu para restaurar agora. Tente de novo em instantes.');
    } finally {
      setProcessando(false);
    }
  }, [processar]);

  return { iniciar, restaurar: restaurarCompras, processando, erro };
}
