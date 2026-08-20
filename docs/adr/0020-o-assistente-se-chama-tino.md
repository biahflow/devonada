# ADR 0020 — O assistente se chama Tino, e a marca antiga sai da página pública

**Status:** aceito
**Data:** 2026-08-19

Supersede o **item 3 da ADR 0014**, que decidiu que "Buddy" sobreviveria como nome do assistente.
O resto da 0014 continua valendo, inclusive a regra de imutabilidade do item 5 — é por causa dela
que esta ADR existe em vez de uma edição na 0014.

## Contexto

A ADR 0014 fez o fork e separou marca de persona: o produto virou devo.nada, e "Buddy" ficou como
nome do assistente, porque era assim que a concepção o chamava em toda a copy. A decisão era
razoável e durou dez dias.

Ela tinha um problema que só apareceu em uso: **"buddy" não é nome, é substantivo comum em
inglês.** Isso se manifesta de três jeitos no repositório.

Primeiro, a palavra não flexiona em português. Metade das ocorrências no código não é rótulo, é
frase — "o texto fala como buddy", "o buddy oferece", "a bolha do buddy". Um nome próprio dispensa
artigo e não precisa ser explicado; um substantivo estrangeiro precisa das duas coisas, toda vez.

Segundo, ele colide com a marca anterior. Antes do fork o produto se chamava **Buddy Financeiro**,
e a varredura de documentação herdada do M10 declarou-se completa enquanto cinco ocorrências
sobreviveram justamente na `backend/web/exclusao.html` — a página pública que o Google exige para
solicitação de exclusão de conta. Enquanto o assistente se chamasse Buddy, nenhuma busca por
"buddy" conseguia distinguir resíduo de marca de copy correta, e por isso o resíduo passou.

Terceiro, o produto fala com pessoas endividadas e com medo, em português, sobre dinheiro. O nome
de quem fala com elas devia ser pronunciável na primeira leitura.

## Decisão

**O assistente se chama Tino.**

1. **O rename alcança os identificadores, não só o texto.** `CardBuddy` vira `CardTino`, e os
   arquivos vão junto por `git mv`. É o oposto do que a ADR 0014 decidiu para o domínio — lá
   `divida`, `valorCobrado` e `caixa` ficaram intactos porque são linguagem ubíqua e o rename
   custaria 743 testes sem entregar nada ao usuário. Aqui o custo é um punhado de arquivos, e o
   ganho é concreto: com "buddy" fora do código, `grep -ri buddy` volta a ser um detector de
   resíduo de marca em vez de ruído. Foi exatamente essa ambiguidade que deixou a marca antiga
   passar pela varredura do M10.

2. **"Buddy Financeiro" vira devo.nada, não Tino.** São coisas diferentes: uma é a marca anterior,
   a outra é a persona. Trocar marca por nome de personagem na página pública de exclusão de conta
   seria substituir um erro por outro.

3. **O e-mail de contato não é inventado.** `contato@buddyfinanceiro.app` aponta para o domínio da
   marca anterior, numa página cuja única função é permitir a alguém exercer um direito. Um
   endereço plausível e morto é pior que um endereço visivelmente pendente: quem escreve para ele
   não recebe resposta e não descobre por quê. A pendência fica declarada no roadmap, ao lado da
   URL pública que também falta.

4. **Registro histórico não se reescreve.** `docs/concepcao/` é fonte histórica declarada, e as
   ADRs 0004, 0006, 0007 e 0014 dizem "Buddy" porque era isso que existia quando foram escritas.
   Esta ADR é o lugar onde se descobre que o nome mudou — a mesma mecânica que o item 5 da 0014
   estabeleceu para o prefixo `BUDDY_*`.

## Consequências

+ `grep -ri buddy` volta a ter significado único. A saída legítima, e nada além dela, é:
  `docs/concepcao/*` (fonte histórica), as ADRs 0004, 0006, 0007 e 0014 (registro datado), esta
  própria ADR — que precisa citar o nome antigo para explicar a troca — e as duas ocorrências do
  e-mail `contato@buddyfinanceiro.app`, preservado pelo item 3. Qualquer outro resultado é
  resíduo. Vira uma verificação barata e confiável, e é a que fecha esta mudança.

  A lista tem cinco itens em vez de zero porque **o e-mail pendente é ocorrência legítima**: uma
  primeira redação deste critério exigiu saída vazia e se contradizia com o item 3, que proíbe
  inventar endereço. Um critério que só passa violando outra regra do mesmo documento é critério
  errado — quando o domínio existir, o e-mail sai da lista sozinho.
+ A copy ganha um nome próprio que flexiona em português: "o Tino sugere", "pergunte ao Tino".
+ A página pública de exclusão de conta deixa de anunciar um produto que não existe mais.
− Mais uma ADR superseded parcialmente, o que exige ler duas para entender uma. Mitigado por este
  cabeçalho, que nomeia o item exato.
− O e-mail da página pública fica visivelmente pendente até alguém decidir o domínio. É escolha
  consciente: pendência visível é melhor que endereço morto.
− Os testes que verificam rótulo de aba e copy mudam junto. É o custo de o rótulo ser testado —
  e é o comportamento certo do teste.
