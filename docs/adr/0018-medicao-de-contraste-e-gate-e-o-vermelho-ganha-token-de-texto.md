# ADR 0018 — A medição de contraste volta para dentro do repositório e vira gate; e o vermelho ganha um token de texto em vez de mudar de hex

**Status:** aceito
**Data:** 2026-08-19
**Supersede:** a decisão da ADR 0010 de manter o validador de paleta fora do repositório
(linha 66). O restante da ADR 0010 continua como está — ela já era `superseded por ADR 0011`.

## Contexto

A ADR 0010 mediu a paleta clara inteira antes de ela virar código — todo par texto/fundo em
WCAG 2.1, toda dupla semântica em CIEDE2000 — e a medição derrubou quatro escolhas que pareciam
óbvias. A tabela que ela produziu virou a seção 1 do `docs/design-system.md`.

O script que produziu a tabela ficou **fora do repositório**. A ADR 0010 registra isso numa
linha, sem justificar — e três dias depois a linha cobrou o preço.

A ADR 0015 virou o tema de claro para escuro. Nenhum dos hex sobreviveu, e portanto nenhuma das
três tabelas sobreviveu — **e nada reclamou.** Não havia comando para rodar, então não havia
comando para falhar. As tabelas foram apagadas à mão e substituídas por um aviso honesto ("a
paleta AINDA NÃO foi medida"), que é o melhor que se pode fazer depois do fato e ainda assim é
uma acessibilidade que ninguém verificou. Pior: a seção 4b do design-system chegou a **alegar**
ter reexecutado o validador contra a paleta escura, citando os hex da paleta clara logo em
seguida — uma medição inventada sobrevivendo dentro do documento que proíbe estimar cor. Ela só
caiu porque uma varredura de marca passou por ali por outro motivo, o que é sorte, não processo.

Havia ainda um segundo problema, e ele foi descoberto ao medir de verdade: **`#E5352B` reprova
como texto.** 4,35 sobre `background`, 4,00 sobre `surface`, 3,66 sobre `neutralSurface`, contra
o piso de 4,5:1. Ele estava sendo usado exatamente assim em oito arquivos — caption de erro em
dois componentes de campo, rótulo de botão, banner de feedback, badge de criticidade, rótulo da
aba ativa, erro do chat e valor em coluna.

E `#E5352B` não é um hex qualquer: é o ponto do wordmark. A ADR 0015 fez dele o mecanismo da
marca — vermelho enquanto há dívida, e a jornada do produto é vê-lo sumir. Mudar o hex para
passar no contraste resolveria a acessibilidade destruindo a marca.

## Decisão

**1. A medição vive no repositório e é o quinto gate.**

`scripts/paleta-check.mjs` lê os hex de `src/theme/theme.ts`, mede uma lista **declarada** de
pares e sai com código 1 se algum par sem exceção cair abaixo do piso. `npm run palette:check`
entra ao lado de `typecheck`, `lint`, `test` e `bundle:check`. A tabela do `design-system.md`
seção 1 passa a ser a saída de `node scripts/paleta-check.mjs --tabela`: ninguém a digita.

Node puro, zero dependência — nem `culori`, nem `chroma-js`, nem `color`. WCAG 2.1 e CIEDE2000
completos (com o termo de rotação R_T e os pesos S_L/S_C/S_H) são aritmética direta, e a correção
delas é conferida contra dado de referência publicado: os 21:1 de preto sobre branco e os doze
casos suplementares de Sharma, Wu & Dalal (2005) para o CIEDE2000, batendo a 1e-4. Um gate cuja
razão de existir é não confiar em estimativa não deveria estrear puxando uma árvore de
dependências — e, mais importante, sem os dados de Sharma um CIEDE2000 com o termo de rotação
errado aprovaria em silêncio, entregando um número e uma tabela. Isso é pior que não medir.

**A lista de pares é declarada, não varrida.** Uma varredura de todas as combinações mediria
pares que nunca se encostam numa tela, e o ruído transformaria o gate em algo que se aprende a
ignorar. Cada linha da lista é uma adjacência real, e combinação nova entra ali no mesmo commit
em que aparece na tela.

**A leitura dos tokens é por parsing de texto**, não por import: o `theme.ts` é TypeScript e o
node não o executa sem transpilador. O parser só enxerga literal na forma `nome: '#RRGGBB'` — que
é exatamente a forma que a regra de "zero hex fora do theme" já obriga. Token citado num par e
ausente do tema **derruba o gate com mensagem nomeando o token**, em vez de sumir da tabela.

**2. O vermelho ganha um token de texto. O hex da marca não muda.**

`debtText` e `dangerText` = `#EC6C65`. É `#E5352B` clareado só até passar 4,5:1 com folga,
preservando matiz e saturação até onde 8 bits permitem: H 3,23° → 3,11°, S 78,15% → 78,03%,
L 53,33% → 66,08%. Mede 6,16 / 5,67 / 5,17 sobre as três superfícies e 5,72 sobre
`dangerSurface`.

A regra de uso é única e vale para os dois nomes:

- **objeto gráfico e texto grande** — ponto do wordmark, pill, barra, borda, série, e o número
  protagonista em `display`/`displaySm` — usam `debt`/`danger`, o hex da marca. Piso 3:1, que
  eles passam;
- **texto de corpo, legenda e rótulo** usam `debtText`/`dangerText`.

Os dois nomes apontam para o mesmo valor pela mesma razão que `debt` e `danger` já apontavam: a
marca só tem um vermelho, e os nomes existem para a tela dizer qual dos dois quis dizer.

O `MoneyText` aplica a regra sozinho: o tom `debt` muda de valor conforme o `size`, porque o
saldo devedor grande — a coisa que a jornada do produto existe para fazer sumir — tem direito ao
vermelho do ponto, e a coluna de valores não.

**3. As exceções são declaradas com justificativa, e continuam sendo medidas.**

`excecao` isenta de reprovar, nunca de medir: o número continua na tabela, ao lado do motivo. São
seis:

| Par | Medida | Motivo |
|---|---|---|
| `primary` × `accent` | ΔE 7,1 | A proximidade é o desenho — a conquista é o mesmo verde um passo mais claro. Os dois nunca precisam ser distinguidos **um do outro**: onde aparecem juntos há rótulo, e onde há só um a semântica vem do lugar. Como `accent` e `primaryBright` são o mesmo hex, esta linha também responde ao par texto × barra do `Meter`. |
| `border` × `background` | 1,30:1 | Divisor decorativo. |
| `border` × `surface` | 1,20:1 | Divisor decorativo. |
| `warningBorder` × `warningSurface` | 1,39:1 | Contorno de banner. |
| `dangerBorder` × `dangerSurface` | 1,21:1 | Contorno de banner. |
| `debtBorder` × `surface` | 1,38:1 | Contorno do card de dívida crítica. |

As cinco bordas caem sob o mesmo argumento: **nenhuma frase, número ou estado depende de alguém
enxergá-las.** A hierarquia real de superfície é a cor (`background` → `surface` →
`neutralSurface`), que está medida; a linha é reforço. Elas estão na lista, e não fora dela, para
que o número exista e a exceção possa ser discutida — uma borda que ninguém mediu é uma borda
sobre a qual não se pode conversar.

## Consequências

+ Trocar um hex no `theme.ts` sem remedir passa a ser impossível de fazer em silêncio. Foi
  exatamente esse silêncio que a ADR 0015 produziu: nove dias de app inteiro com contraste não
  verificado, num produto lido no ônibus com a tela no sol.
+ As três tabelas do `design-system.md` deixam de ser texto e passam a ser saída. Documentação
  que só se atualiza à mão é documentação que envelhece; esta agora falha antes de envelhecer.
+ A seção 4b para de carregar uma lacuna: os anéis de categoria, a marca de gráfico e a separação
  `primary` × `primaryBright` estão medidos sobre o grafite, e o que sobrou de herdado da paleta
  clara está dito como herança.
+ O ponto do wordmark continua `#E5352B`, e a marca continua funcionando.

− **O vermelho passa a ter dois valores**, e alguém vai usar o errado. A mitigação é que a regra
  está escrita em três lugares (o token, o design-system e o checklist de revisão de tela) e que
  o `MoneyText` — o consumidor onde a escolha é mais sutil — decide sozinho. Mas não há gate que
  pegue `colors.debt` num `<Text>` de 13px: isso continua sendo revisão humana.
− **O gate não prova legibilidade.** Contraste medido é piso, não garantia: brilho baixo, tela no
  sol e aparelho de entrada continuam exigindo validação em device, que segue pendente.
− A lista de pares é manual, e uma adjacência nova que ninguém declarar não é medida. É o preço
  de não varrer combinações, e ele está pago no checklist de revisão de tela.
− `scripts/` introduz um segundo dialeto no repositório: CommonJS e testes em `.js`, porque é
  ferramenta de linha de comando rodada por `node` puro, fora do `tsconfig.json` e sem
  transpilador. Testar a mesma implementação que o gate executa exigiu falar a língua dela.
