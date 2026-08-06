# ADR 0002 — TanStack Query para estado de servidor

**Status:** aceito
**Data:** 2026-08-06

## Contexto

Hoje o único estado remoto é o do chat, em `useChat`: `useState` para as mensagens, um
`AbortController` em ref para cancelar a requisição anterior, e flags manuais de `sending` e
`error`. Funciona porque conversa é um fluxo linear — nada precisa ser revalidado.

Dívidas são o oposto. Marcar uma parcela como paga em M3 muda, simultaneamente, o detalhe da
dívida, a lista, o resumo do painel e o resultado da última simulação. Com `useState` em cada
tela, isso vira propagação manual de invalidação entre telas que não se conhecem — a classe de
bug em que o painel mostra R$ 4.850,00 e a lista, somada à mão, mostra outra coisa.

## Decisão

Adotar **TanStack Query** em M0 para todo estado de servidor, com chaves hierárquicas
(`architecture.md`, seção 4.1) e invalidação declarada dentro do próprio hook de mutação.

`useState` continua responsável pelo estado efêmero de UI. **O chat permanece como está**: a
conversa é um fluxo, não uma coleção cacheável, e o `AbortController` já resolve o problema de
concorrência dele.

Política de retry alinhada ao `ApiError`: nunca em `4xx`, até duas vezes em `0` e `5xx`.

## Consequências

+ Invalidação vira declaração local: `useQuitarDivida` sabe que invalida `['dividas']`, e nenhuma
  tela precisa saber quem mais depende disso.
+ Loading, erro, `stale` e refetch em foco vêm prontos — os quatro estados obrigatórios de cada
  tela deixam de ser boilerplate reescrito por tela.
+ Atualização otimista com rollback fica trivial onde faz sentido (marcar parcela paga).
− Uma dependência a mais, e um modelo mental a mais para quem entra no projeto: passa a existir
  a pergunta "isso é estado de servidor ou de UI?".
− Duas convenções convivendo (chat com `useState`, dívidas com Query) pode confundir. A fronteira
  está documentada aqui e em `architecture.md`, seção 4, justamente para não virar folclore.
− Retry automático em rede móvel gasta bateria. Por isso o limite de duas tentativas e a
  proibição de retentar `4xx`.
