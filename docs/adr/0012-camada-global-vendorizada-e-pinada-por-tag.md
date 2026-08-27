# ADR 0012 — A camada global vem vendorizada e pinada por tag, não de um caminho de máquina

**Status:** aceito
**Data:** 2026-08-26

## Contexto

`AGENTS.md` e `CLAUDE.md` abriam com a mesma instrução: *"Antes de qualquer trabalho, carregue
o contexto global em `/Users/danielcampos/workspace/engineeringOS/`"*. O `README.md` repetia o
caminho na tabela de fontes canônicas, e `docs/agent-guidelines.md` o repetia mais duas vezes.
Quatro arquivos de instrução viva apontando para o disco de uma pessoa.

Essa referência **nunca** resolveu para o CI, para um colaborador novo ou para um agente em
nuvem. Resolvia para exatamente um executor, e por isso a falha era invisível: em 25/08/2026 o
checkout mudou de lugar e o caminho morreu **para todos**, sem erro. Referência que não resolve
não é falha, é ausência — ninguém percebe.

O `engineering-os-adoption.md` declarava `ENGINEERING_OS_COMPLIANT` desde 17/08/2026, e
continuou declarando durante todo o período em que a camada global não existia para executor
nenhum. Uma regra que só uma máquina enxerga não é regra do repositório: é contexto privado de
uma sessão.

A alternativa boa passou a existir no caminho. A Engineering OS é publicada em
`github.com/biahflow/engineeringOS`, com CI própria e releases SemVer.

## Decisão

**D1. Um espelho completo da camada global vive em `docs/engineering-os/`.** Cópia fiel, em
inglês, sem tradução e sem edição manual — 91 arquivos, 760 KB. Espelho completo e não recorte:
copiar só os trechos citados quebraria os links internos entre os documentos globais e criaria
uma terceira versão parcial da camada, pior de manter que o todo.

**D2. O pino é uma tag SemVer, e o que não é tag é recusado.** `PINNED_TAG` em
`scripts/sync-engineering-os.mjs` é constante versionada: avançar o pino é diff de uma linha,
revisado como qualquer outra mudança. Branch se move, e pino que se move não é pino —
`--tag main` falha com essa frase. O `PROVENANCE.md` registra a tag **e** o commit que ela
resolve, para o pino continuar conferível se alguém repontar a tag.

**D3. As referências apontam, e `scripts/docs-links.test.js` confere.** É o que transforma
citação em referência: sem portão, o link só adia o problema que o texto corrido já tinha. O
corpus sai de `git ls-files` e é fail-closed — glob que devolve quase nada reprova. O espelho
entra no corpus de propósito: espelho incompleto quebra os links internos dos documentos
globais, que é o sinal desejado.

**D4. O núcleo do sync é puro, e o harness o exercita.** `plan()` e `stable()` não têm processo,
rede nem relógio, na forma dos testes de `marca.js` e `fonte.js`. O que eles defendem é a **poda
que apaga demais**: `plan().remove` vira `unlinkSync` dentro de um diretório versionado, e um
`remove` que incluísse o `PROVENANCE.md` apagaria justamente o registro do pino.

**D5. O harness roda antes do Jest no `npm test`.** O `PF-10` do plano da F-010 mediu que o Jest
imprime o resumo e não encerra o processo. Depois dele, um `&&` nunca chega; antes, o harness
roda em 40 ms e o resultado aparece.

**D6. Ressincronizar exige rede; usar o espelho, não.** Depois da sincronização, CI, colaborador
novo e agente em nuvem leem as regras do próprio checkout, sem rede e sem credencial. Um
submodule apontando para a tag resolveria a alcançabilidade e destruiria essa propriedade.

## Consequências

A camada global passa a existir fora da máquina do operador, e a defasagem vira fato datado e
legível: `v0.1.0` diz mais que um SHA, e o `VERSIONING.md` da origem define quando uma mudança
pode tornar um projeto conforme em não conforme. As doze citações que apontavam para o caminho
morto viraram links que o `npm test` reprova quando quebram. Mover o diretório do checkout deixa
de quebrar qualquer coisa aqui.

Em troca, 760 KB de documentação em inglês entram no repositório e aparecem nas buscas — o
espelho não é fonte de decisão do produto e não deve ser editado aqui. E a origem precisa manter
disciplina de release: sem tag nova, não há como avançar o pino.

**Fica aberto:** o espelho envelhece em silêncio entre sincronizações. Uma guarda que compare o
pino com a última tag publicada seria a outra metade — o portão detecta, o conserto é de uma
pessoa —, mas precisa de rede no teste e este repositório não tem CI versionado onde colocá-la.
