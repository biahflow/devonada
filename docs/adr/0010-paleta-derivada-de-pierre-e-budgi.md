# ADR 0010 — Paleta derivada de Pierre e Budgi; lime é preenchimento, nunca texto

**Status:** superseded por ADR 0011
**Data:** 2026-08-07
**Substitui:** ADR 0004 (paleta híbrida: pine primário, dourado acento)

## Contexto

A ADR 0004 adotou a **estrutura** do design system Biahflow / OikOS — pine `#1F6045` como
primário — divergindo só no acento. A premissa dela era pertencer a uma família visual comum.

Essa premissa não vale: **este app não tem relação com o Biahflow.** O pine entrou por herança de
outro ecossistema, não por decisão de produto. As referências visuais escolhidas pelo dono do
repositório são dois produtos de finança pessoal, e delas saem os matizes:

| | `lp.pierre.finance` | `budgi.it` |
|---|---|---|
| base | `#09090B` · `#18181B` · `#27272A` | `#FFFFFF` · `#F8FAFC` |
| texto | `#FFFFFF` · `#F7F8FA` | `#0F172A` · `#64748B` · borda `#E2E8F0` |
| marca | lime `#CFFF04` | teal `#03A696` · hover `#028C7F` |
| fonte | Geist 400/500/700 | Proxima Nova (licença comercial) |
| raio | `.5 / 1 / 2.25rem` + pill | padrão Tailwind |
| tipo | tracking `-.03em`, line-height 1.0–1.1 | — |

Os valores acima foram lidos do CSS servido pelos dois sites, não estimados de captura de tela.

## Decisão

Base clara do Budgi, forma do Pierre, e **nenhum matiz que não venha de um dos dois**:

- **ação** `#017A70` — o teal do Budgi escurecido até passar 4,5:1 com texto branco;
  `#03A696` sobrevive como `primaryBright`, para marca e gráfico, **nunca como fundo de texto**;
- **progresso** lime `#CFFF04`, **sempre como preenchimento** com texto `#18181B` por cima — é
  como o Pierre usa o botão primário. Onde precisa ser texto sobre claro, `accentText` `#4D7C0F`,
  o mesmo matiz escurecido;
- **atenção** `#B45309` sobre `#FEF3C7`; **erro** `#B91C1C` sobre `#FEF2F2`;
- **painel escuro** `#18181B` como *superfície*, não como tema: continua não havendo dark mode
  nem `useColorScheme`, e `app.json` segue com `userInterfaceStyle: "light"`;
- tipografia **Geist**, escala de display maior com tracking `-1.2`, raio `10 / 16 / 28 / 36`.

### A regra do lime, e por que ela é uma regra

`#CFFF04` sobre branco dá **1,17:1**. Como texto em superfície clara ele é ilegível, e nenhuma
disciplina de revisão de código pega isso de forma confiável. Por isso o lime entra no
`theme.ts` como cor de **preenchimento** — pastilha, barra, painel — com `onAccent` `#18181B`
declarado ao lado. Quem precisar de progresso em texto usa `accentText`.

### O que a medição derrubou

A paleta foi verificada por script (WCAG 2.1 e CIEDE2000) antes de virar código, e **três
escolhas do plano original não sobreviveram**:

1. **Branco sobre o teal `#03A696` do Budgi: 3,04:1.** A cor de marca do reference não serve de
   fundo para texto. Daí o `#017A70`.
2. **Âmbar `#F59E0B` como texto: 2,15:1.** Escurecer resolve o contraste e cria outro problema:
   âmbar-700 `#B45309` contra laranja-700 `#C2410C` dá **ΔE 6,9**, muito abaixo do piso de 15.
   Progresso e atenção não podem ser dois quentes escurecidos — é por isso que progresso ficou
   com o lime e o quente inteiro sobrou para atenção.
3. **Dois pastéis não carregam a diferença semântica.** Lime-50 contra âmbar-100 dá ΔE 8,7, e
   escurecer o lime para separá-los derruba o texto para 4,28:1. Não há saída dentro do par: o
   progresso passou a usar a **pastilha sólida**, e sobrou um pastel só por família.
4. **`success` virou o lime.** Qualquer verde de confirmação ficava a ΔE 1,6 do teal de ação —
   a mesma cor, na prática. Confirmação passa a usar a pastilha lime, e o token `success` deixa
   de existir.

O script de verificação vive fora do repositório, mas a tabela que ele produz está em
`docs/design-system.md`, seção 1.

## Consequências

+ Todo par texto/fundo do design system passa 4,5:1, e toda dupla de semânticas que pode
  aparecer lado a lado passa ΔE 15. A paleta anterior **não** tinha essa propriedade: o dourado
  `#C9A24B` como texto sobre branco dava 2,3:1, e era usado exatamente assim — inclusive no
  número de destaque da data de liberdade, o maior texto colorido do produto.
+ O produto deixa de carregar cor herdada de um ecossistema ao qual não pertence.
+ A seção 6 de `docs/design-system.md` — "relação com o Biahflow" — deixa de existir.
− Perde-se o dourado, que carregava "economia e progresso" com uma calidez que o lime não tem.
  A compensação é que o lime é mais distintivo, e a semântica sobrevive na pastilha.
− A tese anti-ansiedade de `guardrails.md` §4 continua idêntica, mas a seção **nomeia o dourado**
  e precisa ser reescrita junto. Nenhuma regra muda; só a cor que a ilustra.
− `docs/design-system.md` §4b (visualização de dados) foi validada contra a paleta antiga. Ela
  não vale por herança: precisa ser reexecutada contra os matizes novos.
