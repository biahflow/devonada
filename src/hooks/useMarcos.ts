import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { celebrarMarco, getMarcos } from '../api/marcos';
import type { IsoDate, Marco, TipoDeMarco } from '../api/types';

/**
 * Chave própria, fora de `['caixa']` e de `['dividas']` de propósito: celebrar
 * um marco não muda renda, gasto, capacidade nem saldo devedor — só a data em
 * que a tela foi exibida. Invalidar a cascata daqui refaria a leitura mais cara
 * do app para gravar um carimbo (docs/architecture.md, seção 4.1).
 */
export const marcosKeys = {
  all: ['marcos'] as const,
};

/**
 * Os cinco marcos, como o backend os devolve — sem reordenar e sem derivar
 * nada.
 *
 * `ativo` no molde de `useLembretes`: a porta de entrada do app monta antes de
 * existir sessão, e pedir marcos para quem ainda não entrou só gera um 401 que
 * ninguém lê.
 */
export function useMarcos(ativo = true) {
  const query = useQuery({ queryKey: marcosKeys.all, queryFn: getMarcos, enabled: ativo });
  return { ...query, marcos: query.data?.marcos ?? [] };
}

/**
 * O marco atingido que ainda não foi celebrado — o que abre a `MarcoScreen`.
 *
 * O PRIMEIRO da lista quando há mais de um, e o critério de desempate é a ordem
 * do servidor: ela é estável (os cinco tipos sempre, na mesma ordem) e não há
 * dado no cliente que ordene melhor — `atingidoEm` é uma data, e dois marcos
 * atingidos no mesmo dia empatariam nela. Os outros esperam: a tela deles abre
 * na próxima vez, porque `celebradoEm` continua nulo.
 *
 * Falha de rede aqui não abre e não atrapalha nada: sem lista, não há marco
 * pendente, e o app segue para onde ia.
 */
export function useMarcoPendente(ativo = true): Marco | undefined {
  const { marcos } = useMarcos(ativo);
  return marcos.find((m) => m.atingidoEm !== null && m.celebradoEm === null);
}

/**
 * Grava `celebradoEm`. Invalida SÓ a chave de marcos — ver o comentário de
 * `marcosKeys`.
 *
 * DEVOLVE `celebrar`, E NÃO SÓ A MUTAÇÃO, porque a marca no cache precisa ser
 * escrita NO MESMO TICK DO TOQUE. `onMutate` do TanStack não serve: ele roda
 * num microtask, e a tela navega de forma síncrona logo depois de disparar a
 * escrita.
 *
 * A ATUALIZAÇÃO OTIMISTA NÃO É PERFORMANCE: ELA É O QUE DESTRANCA A SAÍDA.
 * `PortaDeEntrada` (`app/_layout.tsx`) redireciona para a `MarcoScreen` sempre
 * que este cache traz um marco atingido e não celebrado, e ela remonta a cada
 * navegação. A tela sai sem esperar rede, de propósito, para não prender
 * ninguém — então, sem marcar `celebradoEm` aqui, a porta lê o cache velho no
 * instante seguinte e manda a pessoa de volta para a celebração que ela acabou
 * de fechar.
 *
 * E O ERRO NÃO DESFAZ, ao contrário do que uma atualização otimista costuma
 * fazer. O caso que manda é o `402`: quem está com a assinatura vencida leva
 * recusa na celebração, que é escrita. Um rollback devolveria o marco ao cache,
 * a porta redirecionaria de novo, e a pessoa ficaria TRANCADA NA TELA DE
 * CELEBRAÇÃO — sem acesso ao resto do app, por causa de uma conquista. O
 * servidor continua com `celebradoEm` nulo, então o marco volta na próxima
 * abertura: ele espera, não evapora.
 */
export function useCelebrarMarco() {
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: (tipo: TipoDeMarco) => celebrarMarco(tipo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: marcosKeys.all }),
  });

  function celebrar(tipo: TipoDeMarco) {
    queryClient.setQueryData<{ marcos: Marco[] }>(marcosKeys.all, (atual) =>
      atual === undefined
        ? atual
        : {
            marcos: atual.marcos.map((m) =>
              m.tipo === tipo && m.celebradoEm === null
                ? // A data real vem do servidor na revalidação; o que importa
                  // aqui é deixar de ser `null`, que é o que a porta lê.
                  { ...m, celebradoEm: hojeISO() }
                : m,
            ),
          },
    );
    mutacao.mutate(tipo);
  }

  return { ...mutacao, celebrar };
}

function hojeISO(): IsoDate {
  return new Date().toISOString().slice(0, 10) as IsoDate;
}
