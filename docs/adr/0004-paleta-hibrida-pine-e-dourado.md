# ADR 0004 — Paleta híbrida: pine primário, dourado acento

**Status:** superseded por ADR 0010
**Data:** 2026-08-06

## Contexto

Existiam duas paletas em conflito.

`src/theme/theme.ts` traz a do Buddy: primário `#2F6F5E` (verde sereno), acento `#C9A24B`
(dourado), com uma tese explícita no comentário do arquivo — reduzir ansiedade em vez de gerar
alarme, e ser "deliberadamente diferente do cream+terracota padrão".

O design system Biahflow / OikOS, usado em `biahflow-portal`, `biahflow-portal-cliente` e
`OikOS-front`, traz pine `#1F6045` como primário e clay `#C66C3E` (laranja terroso) como acento,
sobre papel `#F5F4EF`.

Alinhar completamente daria consistência visual entre os projetos, mas o clay laranja num app
de dívida lê como alerta — exatamente o oposto da tese emocional deste produto. Manter tudo
como está deixaria dois verdes quase iguais convivendo no ecossistema sem motivo.

## Decisão

Adotar a **estrutura** do design system Biahflow e divergir apenas no acento:

- primário passa a ser **pine `#1F6045`**, com a escala completa (`pine-50`, `pine-100`,
  `pine-700`, `pine-900`);
- acento permanece o **dourado `#C9A24B`** do Buddy;
- tipografia Inter com tracking negativo, cards muito arredondados, sombras suaves e o padrão
  de *eyebrow* acima do título são adotados como estão.

## Consequências

+ O dourado carrega uma semântica que o produto precisa e o laranja não entrega: economia,
  progresso, recompensa. É a cor da parcela quitada e da data de liberdade.
+ Um usuário que conheça os outros produtos reconhece a família visual — mesma proporção, mesma
  temperatura, mesmo verde.
+ Vermelho fica livre para significar só erro e ação destrutiva, porque não precisa competir com
  um acento que já puxa para o quente-alarme.
− A paleta não é copiável um-para-um entre os repositórios. `docs/design-system.md` documenta a
  divergência para não parecer descuido.
− `src/theme/theme.ts` muda em M0, o que altera o visual do chat já existente. Mudança pequena
  e proposital: os dois verdes são próximos o bastante para a transição passar despercebida.
− Este app **não pertence** ao ecossistema Biahflow. Compartilhar linguagem visual não implica
  compartilhar roadmap, componentes ou decisões futuras.
