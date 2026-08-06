# ADR 0003 — Todo cálculo financeiro fica no backend

**Status:** aceito
**Data:** 2026-08-06

## Contexto

O princípio "o app nunca faz conta de dinheiro" já estava no `README.md` e nos comentários de
`src/api/types.ts` desde a Fase 0, mas nunca foi testado por uma feature que realmente o
pressione.

M4 pressiona. O simulador de quitação compara avalanche e bola de neve: precisa aplicar taxa de
juros mês a mês, alocar o aporte extra segundo a estratégia, recalcular saldos e projetar a data
de quitação. É matemática de verdade, e o argumento a favor de fazê-la localmente é forte —
resposta instantânea ao arrastar o slider, funciona sem rede, sem custo de servidor.

O mesmo dilema aparece, menor, em M2: somar uma coluna de valores para exibir o total devido é
uma linha de `reduce`.

## Decisão

**Todo valor derivado é calculado no backend**, sem exceção para simulação "what-if". O
simulador chama `POST /v1/dividas/simulacoes`; o painel chama `GET /v1/dividas/resumo`. O front
formata e desenha.

O campo `comparacao` da resposta de simulação vem calculado pelo servidor **de propósito** — se o
front subtraísse `totalJurosPagos` das duas estratégias, teria replicado uma regra de negócio.

Permanece permitida a subtração puramente ilustrativa entre dois valores que o backend já
enviou, quando o resultado é a diferença literal e não uma regra: é o que `ValorJustoCard` faz
com `economia = valorCobrado - valorJusto`.

## Consequências

+ Existe uma única implementação de cada regra financeira. Não há como o app mostrar um número
  que o backend não reconhece.
+ Corrigir uma regra de juros é um deploy de servidor, não uma submissão à App Store esperando
  revisão enquanto os usuários veem o número errado.
+ O produto trata dívida real: o número que o app mostra vira argumento numa negociação com um
  credor. Divergência de arredondamento entre uma implementação em Python e outra em TypeScript
  não é bug cosmético — é o usuário perdendo uma negociação.
+ O guardrail fica testável: `grep` por operação aritmética sobre campo monetário em `src/` é
  uma revisão mecânica.
− O slider do simulador depende de rede. Mitigação: `debounce` antes de disparar, cache por
  parâmetros no TanStack Query, e estado de carregamento que não pisca a tela inteira.
− Sem rede, não há simulação. Aceito: um plano de quitação calculado sobre dados possivelmente
  desatualizados é pior que nenhum plano.
− O backend fica com mais trabalho, incluindo endpoints que só existem para evitar um `reduce`
  no cliente. É o custo deliberado da decisão.
