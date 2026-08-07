# Design System — Buddy Financeiro (React Native)

> Documento vivo. Fonte da verdade dos tokens: `src/theme/theme.ts`. Este documento explica o
> **porquê** e cataloga os componentes; o arquivo de tema carrega os valores.
> Alvo: **Expo / React Native, mobile nativo**. Não há versão web.

Tema **claro sempre**. Cards brancos flutuando sobre um slate muito claro, **sem borda** — quem
separa as superfícies é uma sombra difusa. Teal como ação, violeta como conquista, anel colorido
de categoria nos ícones. Tipografia Nunito Sans, números moderados com o `R$` menor que os
dígitos.

A linguagem vem do **`budgi.it`**, derivada das telas do produto, não do CSS da landing page.
Ver ADR 0011 — ela registra por que essa distinção custou uma passada inteira.

---

## 1. Paleta

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#0F172A` | texto principal |
| `inkSoft` | `#5C6B80` | texto secundário, legendas, unidades |
| `background` | `#F8FAFC` | fundo de tela |
| `surface` | `#FFFFFF` | cards, campos, bolha do assistente |
| `neutralSurface` | `#F1F5F9` | badge neutro, área recuada |
| `border` | `#E2E8F0` | bordas de card e campo |
| `primary` | `#017A70` | **ação**: botão, link, aba ativa |
| `primaryHover` | `#016258` | estado pressionado |
| `primaryBright` | `#029488` | **marca de gráfico** — nunca fundo de texto |
| `primarySoft` | `#99F6E4` | anel de foco |
| `primarySurface` | `#F0FDFA` | badge, banner informativo, bolha do usuário |
| `primaryDeep` | `#134E4A` | texto sobre `primarySurface` |
| `onPrimary` | `#FFFFFF` | texto e ícone sobre superfície primária |
| `accent` | `#7C3AED` | **conquista, economia, insight** |
| `accentSurface` | `#F5F3FF` | fundo de badge e banner de conquista |
| `inkFill` | `#18181B` | botão circular de enviar — o único elemento escuro do app |
| `warning` | `#B45309` | atraso, atenção factual, sem alarme |
| `warningSurface` · `warningBorder` | `#FEF3C7` · `#FDE68A` | fundo e borda de atenção |
| `danger` | `#B91C1C` | erro e ação destrutiva — **e nada além disso** |
| `dangerSurface` · `dangerBorder` | `#FEF2F2` · `#FECACA` | fundo e borda de erro |

**Regra do vermelho.** `danger` não é a cor de "você está devendo". Saldo devedor é `ink`.
Parcela atrasada é `warning`. Ver `guardrails.md`, seção 4.

**Regra do card.** Card **não tem borda**. A separação vem de `shadow.card`, difusa e larga.
Borda de 1px em card é o que mais denuncia um desenho que não é este.

**Não existe superfície escura de conteúdo.** O `inkFill` serve ao botão de enviar do chat e a
nada mais. Não há dark mode e não há `useColorScheme`.

### Cor de categoria

Quatro matizes para o anel do `CategoriaIcon`: `teal #0D9488`, `azul #2563EB`,
`magenta #BE185D`, `ambar #D97706`.

São **cor de objeto gráfico**, medidas contra o piso de 3:1, não contra o de texto — e nunca
informam sozinhas: há glifo e rótulo escrito ao lado.

São quatro e não seis por medição: coral fica a **ΔE 11,9** do âmbar e violeta a **ΔE 12,4** do
azul (OKLab, validador de dataviz). Dois anéis que se confundem não acrescentam nada. O conjunto
final passa separação de daltonismo com folga — pior par **ΔE 17,9** em deuteranopia. O violeta
também ficou de fora por ser o `accent` do sistema: cor semântica reservada não vira "categoria
5".

### A paleta foi medida, não estimada

Todo par texto/fundo passa o piso de 4,5:1 da WCAG 2.1, e toda dupla de semânticas que pode
aparecer lado a lado passa ΔE 15 em CIEDE2000:

| Par | Medida |
|---|---|
| `ink` sobre `surface` | 17,85:1 |
| `inkSoft` sobre `surface` · `background` · `neutralSurface` | 5,43 · 5,19 · 4,95:1 |
| `onPrimary` sobre `primary` | 5,23:1 |
| `primaryDeep` sobre `primarySurface` | 9,09:1 |
| `accent` sobre `surface` · `accentSurface` | 5,70 · 5,20:1 |
| `warning` sobre `surface` · `warningSurface` | 5,02 · 4,51:1 |
| `danger` sobre `surface` · `dangerSurface` | 6,47 · 5,91:1 |
| anéis de categoria sobre `surface` | 3,19 a 6,04:1 |
| ΔE `accent` × `primary` · `warning` · `danger` | 40 · 51 · 42 |
| ΔE `warning` × `danger` | 16,2 |
| ΔE `warningSurface` × `dangerSurface` | 17,6 |

**A medição derrubou seis escolhas** que pareciam óbvias — o registro está nas ADR 0010 e 0011.
Em resumo: o teal do Budgi como veio reprova com texto branco; o âmbar reprova como texto e, uma
vez escurecido, fica a ΔE 6,9 do laranja escurecido; dois pastéis não conseguem ser
distinguíveis e carregar texto ao mesmo tempo; qualquer verde de confirmação fica a ΔE 1,6 do
teal de ação; `#8B5CF6`, o violeta do gradiente do reference, dá 4,23:1 e não serve de texto; e
coral e violeta saíram do conjunto de categoria por se confundirem com âmbar e azul.

Mudou a paleta? **Meça de novo antes de escrever o código.**

---

## 2. Escalas

```ts
spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 }
radius  = { sm: 8, md: 14, lg: 20, xl: 24, pill: 999 }
```

Aplicação: **card `radius.lg`**, **controle e botão `radius.md`**, **badge e botão circular
`radius.pill`**, **banner de feedback `radius.md`**, **bolha de chat `radius.lg`**.

`spacing.xxxl` é o ritmo entre seções de uma tela rolável e o respiro no fim da lista.

### Sombras

```ts
shadow = { card, soft, float }   // ver src/theme/theme.ts
```

`elevation` cobre o Android; as propriedades `shadow*` cobrem o iOS. Sempre defina os dois.

A sombra é **difusa e larga**, e é ela quem separa o card do fundo — por isso card não leva
borda. `float` é mais presente e serve ao composer e a botões flutuantes, que precisam se
destacar da lista atrás. Nunca use sombra dura.

---

## 3. Tipografia

**Nunito Sans**, carregada via `@expo-google-fonts/nunito-sans` em `app/_layout.tsx`. Se a fonte
falhar, o app sobe mesmo assim com a fonte de sistema — segurar a splash para sempre seria pior.

Com fontes customizadas o React Native **não deriva peso a partir de `fontWeight`** de forma
confiável entre plataformas. Por isso cada peso é uma família própria:

```ts
fontFamily = {
  regular: 'NunitoSans_400Regular',
  medium:  'NunitoSans_600SemiBold',
  bold:    'NunitoSans_700Bold',
}
```

### A fonte foi escolhida por dígito, não por desenho

Nunito Sans tem **largura de dígito fixa por padrão** — variação de 0,00px entre 0 e 9, medida no
arquivo da fonte. Isso significa que **não é preciso `fontVariant: ['tabular-nums']`** em lugar
nenhum, e ele foi removido de todos os componentes: pedir um recurso OpenType que a família não
declara é caminho conhecido para o texto cair em fonte de sistema no Android.

Figtree, que seria a escolha estética mais próxima do reference, foi descartada por isso: ela não
tem `tnum` **nem** dígitos tabulares — o "1" mede 16,5px onde o "0" mede 25,6px, e uma coluna de
reais dançaria a cada linha.

> **Trocar a fonte é mexer nas colunas de valor.** Meça a largura dos dígitos antes.

### Escala

Números protagonistas moderados, não display gigante, e tracking quase neutro: a fonte é
humanista, e apertar o espacejamento dela desfaz o ar que é a característica do reference.

| Estilo | Tamanho / entrelinha | Tracking | Onde |
|---|---|---|---|
| `display` | 32 / 38 | −0,5 | número protagonista de uma tela |
| `displaySm` | 26 / 32 | −0,4 | título de tela e número de destaque em card |
| `title` | 20 / 26 | −0,2 | título de seção e de estado vazio |
| `numeric` | 20 / 26 | — | valor monetário em linha |
| `body` / `bodyStrong` | 16 / 24 | — | corpo |
| `caption` | 13 / 18 | — | legenda, unidade, contexto |
| `eyebrow` | 11 / 14 | +1,6 | rótulo acima do título, em maiúsculas |

Nos tamanhos grandes o **`R$` sai a 62% do corpo dos dígitos** — o símbolo se repete em toda
linha e não precisa competir com o número. Isso vive no `MoneyText`, não nas telas.

O `textTransform: 'uppercase'` do `eyebrow` fica no componente, não no texto da string — a copy
segue legível no código.

---

## 4. Componentes

`src/components/ui/`. Um componente aqui **não importa de `src/api/`** — recebe dado por prop.

### `ListRow`, `GrupoDeLista` e `CategoriaIcon`

A anatomia de lista do reference, e o que mais define a cara do app.

**`CategoriaIcon`** — glifo Feather de traço fino dentro de um anel de 2px na cor da categoria.
Decorativo por definição: `accessibilityElementsHidden`, porque o sentido já está no texto ao
lado.

**`ListRow`** — ponto de estado, `CategoriaIcon`, título com subtítulo, e à direita o valor com
uma legenda abaixo. O ponto de estado é **redundante de propósito**: acompanha a legenda escrita,
nunca a substitui. `concluido` usa `accent`, `atencao` usa `warning`, e **nenhum estado usa
`danger`** — o reference pinta saída de dinheiro em coral exatamente onde este produto não pinta.

**`GrupoDeLista`** — card com cabeçalho de período ("Sexta, dia 15"), linhas e rodapé de total.
O rodapé é opcional: um cronograma de parcelas fecha com total, uma lista de dívidas não.

> A cor do anel **não** contradiz a seção 4b. Lá a regra é sobre **marca de gráfico**, onde a cor
> é o único portador da categoria. Aqui há glifo e rótulo ao lado, e a categoria está escrita.

### `Button`

`variant: 'primary' | 'secondary' | 'danger' | 'ghost'`, `size: 'md' | 'lg'`, `loading`,
`disabled`.

| Variante | Fundo | Texto | Uso |
|---|---|---|---|
| `primary` | `primary` | branco | ação principal da tela, uma por tela |
| `secondary` | `surface` com borda `primarySoft` | `primary` | ação alternativa |
| `danger` | `danger` | branco | excluir, apagar — sempre com confirmação |
| `ghost` | transparente | `inkSoft` | ação terciária, cancelar |

`size="lg"` (56pt) é o CTA principal de uma tela. `md` (48pt) segue sendo o **piso** de toque.

### Demais componentes

**`Screen`** — wrapper de tela: `SafeAreaView` do `react-native-safe-area-context`, fundo
`background`, padding horizontal `spacing.lg` (removível com `flush` para listas que sangram
até a borda). Toda rota começa por ele.

**`PageHeader`** — título em `displaySm` + descrição em `inkSoft` + slot de ação à direita.
A prop **`titleLead`** dá o peso misto na mesma linha — "Suas **dívidas**", "Seu **caixa**" —, que
é a assinatura tipográfica do reference e diz mais que um eyebrow. Use `titleLead` nas quatro
abas; `eyebrow` fica para as telas internas, cujo título já é uma frase.

**`Card`** — superfície `surface`, `radius.lg`, `shadow.card`, padding `spacing.lg`, **sem
borda**. Base de todo agrupamento de conteúdo.

**`FormField`** — label `bodyStrong` em `ink`, campo com borda `border` (foco: borda `primary`
+ anel `primarySoft`), `minHeight: 48`, e abaixo ou a mensagem de erro em `danger` ou a dica em
`caption`/`inkSoft`. Nunca as duas. Marcador "Opcional" à direita do label quando aplicável.

**`CurrencyInput`** — entrada de dinheiro. **Mantém o estado em centavos inteiros**; o usuário
digita da direita para a esquerda e a máscara formata com `formatBRL`. Nunca `parseFloat`,
nunca estado em string com vírgula. `keyboardType="number-pad"`. É o componente que impede a
classe inteira de bug descrita em `guardrails.md`, seção 1.1.

**`Feedback`** — banner `radius.md`, quatro tons: `info` (`primarySurface` / `primaryDeep`),
`success` (`accentSurface` / `accent`), `warning` (`warningSurface` / `warning`),
`error` (`dangerSurface` / `danger`). Sempre com `accessibilityRole="alert"` no erro e
`accessibilityLiveRegion="polite"` nos demais.

**`LoadingState`** — `ActivityIndicator` na cor `primary` + texto curto do que está carregando.
Nunca um spinner mudo no meio da tela.

**`EmptyState`** — moldura tracejada `border`, ícone em círculo `primarySurface`, título,
uma linha de explicação e um botão de ação. Vazio é oportunidade de orientar, não um beco.

**`ErrorState`** — mensagem do `ApiError` + botão "Tentar de novo". Distingue `status === 0`
(sem conexão) de falha do servidor na copy, e carrega a saída para o 401.

**`PercentInput`** — entrada de taxa de juros. Mantém **basis points inteiros** (`250` = 2,50%),
formata via `formatBasisPoints` (`src/util/percent.ts`) e nunca chama `parseFloat`. Mesmo
contrato do `CurrencyInput`, pelo mesmo motivo: taxa é dinheiro disfarçado.

**`DateField`** — `@react-native-community/datetimepicker` exibindo `DD/MM/AAAA` e emitindo
`IsoDate` puro. A conversão vive em `src/util/date.ts` e usa componentes **locais** de data —
nunca `toISOString()`, que desloca o dia conforme o fuso. Nenhuma regra de data no cliente:
"atrasada" e "vence em N dias" vêm do backend.

**`OptionGroup`** — seletor em chips, genérico sobre um `Option<T>`. `accessibilityRole="radio"`
em cada chip e `radiogroup` no contêiner. A descrição da opção selecionada aparece abaixo,
para explicar a escolha sem poluir a lista.

**`SeletorDeArquivo`** — não é componente, é a função `escolherArquivo()`: abre o menu nativo de
origem (PDF, câmera, galeria) e devolve o arquivo ou `null`. `ActionSheetIOS` no iOS, `Alert` no
Android. Permissão de câmera pedida **no contexto**, ao escolher a câmera — pedir antes de haver
motivo é o caminho mais curto para o usuário negar.

**`AporteExtra`** (`dividas/`) — quanto o usuário consegue pagar por mês além das parcelas
mínimas. **Slider e `CurrencyInput` sobre o mesmo estado em centavos inteiros**: arrastar serve
para explorar o efeito, digitar serve para o valor exato, e os dois são o mesmo número. O slider
(`@react-native-community/slider`) anda em passos de R$ 10,00 — nenhum caminho produz
fracionário. Os dois controles têm `accessibilityLabel` **distintos**: dois controles com o mesmo
nome fazem o leitor de tela anunciar a mesma coisa duas vezes sem dizer qual é qual. O teto do
slider é `margemDisponivel` quando o usuário informou a renda; sem ela, um teto fixo. Isso é
limite de **controle**, não número exibido como fato — o campo continua aceitando valor acima.

**`CartaoEstrategia`** (`dividas/`) — uma estratégia de quitação simulada, tocável para
selecionar (`accessibilityRole="radio"`). Nunca rotula uma das duas como "a certa": a copy da
comparação é quem explica que a estratégia sustentável vale mais que a ótima no papel.

**`CampoRevisao`** (`dividas/`) — campo proposto por extração de contrato, com `Badge` de
confiança e o trecho citado. Sem trecho, **não exibe valor**: número sem evidência é palpite do
modelo. O trecho é texto puro, nunca marcação — conteúdo de documento é entrada não confiável.

**`AlertaCard`** e **`AchadoCard`** (`dividas/`) — cláusula que merece atenção e achado de
revisão de cobrança. Os dois usam `warningSurface` / `warningBorder` / `warning`: são cartões de
**atenção**, e antes tomavam emprestado o acento de progresso, o que dizia a coisa errada. Copy
de investigação e rodapé explícito de que não é conclusão jurídica.

**`Cascata`** (`caixa/`) — a aritmética da capacidade de pagamento, degrau a degrau. Total
positivo em `accent`, negativo em `warning`. Nunca `danger`: não fechar o mês é um fato, não
um erro do usuário.

**`Badge`** — pílula `radius.pill`. Cinco tons; `progresso` é violeta e `atencao` é âmbar, a
ΔE 51 um do outro. Antes os dois eram o mesmo par de cores, o que fazia conquista e alerta se
parecerem.

Variante de criticidade mapeia `CriticidadeTipo`:

| `tipo` | Tom | Rótulo |
|---|---|---|
| `essencial` | `primario` | Essencial |
| `com_garantia` | `atencao` | Com garantia |
| `juros_abusivos` | `alto` | Juros altos |
| `consumo` | `neutro` | Consumo |

`juros_abusivos` é a **única** situação em que a família do vermelho aparece fora de erro — e
ainda assim num tom suave de fundo, porque é uma classificação factual de custo, não uma
repreensão.

**`MoneyText`** — exibe centavos via `formatBRL`. Props `size`
(`body | numeric | displaySm | display`) e `tone`
(`ink | inkSoft | accent | onPrimary | warning`). Nos dois tamanhos grandes o `R$` sai a 62% do
corpo dos dígitos. **Não aplica `fontVariant`** — a garantia de dígito tabular vem da fonte
(seção 3).

---

## 4b. Visualização de dados

> Esta seção existe porque a proposta óbvia **falhou numa validação executada**, não porque
> alguém achou feio. Rodar o validador é obrigatório antes de definir qualquer paleta de gráfico.
> Ela foi **reexecutada contra a paleta nova** — herdar a conclusão anterior não valeria, porque
> os matizes mudaram.

A pergunta se repõe a cada troca de paleta, e a resposta mudou de motivo — o que vale registrar.

Com a paleta de categoria atual (`#0D9488`, `#2563EB`, `#BE185D`, `#D97706`), quatro séries
categóricas **passam** no validador: pior par adjacente ΔE 17,9 em deuteranopia e 21,9 em visão
normal. O contraste deixou de ser o impedimento.

**As barras continuam num tom só assim mesmo**, pelo outro argumento: o `CriticidadeBadge` ao
lado já nomeia a categoria, e quatro matizes ali seriam redundantes com o rótulo, não informação
nova. É uma decisão de economia de sinal, não de acessibilidade.

Duas coisas que a validação ensinou e que valem para a próxima paleta:

- **Coral e violeta não entram em conjunto categórico** com âmbar e azul: ΔE 11,9 e 12,4, abaixo
  do piso de 15. Foi por isso que o conjunto de categoria tem quatro matizes, não seis.
- **CIEDE2000 e o validador de dataviz discordaram.** O par azul × violeta passava em CIEDE2000 e
  reprovou em OKLab com simulação de deuteranopia. Quando as duas divergem, vale a que simula
  visão de cores.

A marca de gráfico é `primaryBright` `#029488`, e ela **passa os cinco testes**. A cor de ação
`primary` `#017A70` **não** serve: numa linha de 2px ela fica abaixo do piso de croma e lê como
cinza. São duas cores para o mesmo teal, com trabalhos diferentes — e é por isso que o `Meter`
usa uma para o texto da porcentagem e outra para a barra.

### Regras

- **Série única sempre que possível.** Uma série não leva legenda — o título nomeia o que está
  desenhado.
- **Categoria vem do rótulo, não do matiz.** As barras de `porCriticidade` usam um tom só; a
  identidade vem do `CriticidadeBadge` ao lado, onde a cor semântica já funciona em escala de
  badge e já passa no contraste.
- **Vermelho não entra em gráfico.** `danger` é erro e ação destrutiva. Saldo alto é `ink`,
  atraso é `warning` — sempre com ícone e texto junto, nunca cor sozinha.
- **Nunca dois eixos Y.** Duas medidas de escalas diferentes viram dois gráficos.
- **Eixo começa na base.** Truncar o eixo para dramatizar variação é manipulação — e este
  produto existe para reduzir ansiedade, não fabricá-la.
- **Sem curva suavizada.** Interpolar 12 pontos inventa valores intermediários que não existem.
- **Rótulo direto só nos extremos**, nunca um número em cada ponto.
- **Marcas finas:** linha de 2px, marcador de ≥8px, grade e eixo recessivos.
- Estado vazio e série de um ponto só são casos reais (o backend leva meses para acumular
  histórico) e estão cobertos por teste em `src/util/grafico.test.ts`.

### Componentes

**`StatTile`** (`ui/`) — número protagonista dentro de card. Valor único se lê melhor como número
grande que como barra de um item só. Ausência exibe "ainda não calculado", **nunca R$ 0,00**.

**`Meter`** (`ui/`) — proporção com limiar. Acima do limite usa `warning` com ícone e frase
explicativa; estar endividado não é erro nem ação destrutiva.

**`LinhaEvolucao`** (`charts/`) — série única em `primaryBright`, SVG puro sobre `react-native-svg`.

**`MessageBubble`** (`chat/`) — as duas bolhas são **claras**: assistente em `neutralSurface`,
usuário em `primarySurface`, raio `lg` uniforme. Quem identifica o assistente é a marca ao lado
da bolha, não a cor de fundo dela.

**`ChatComposer`** (`chat/`) — campo em pílula flutuante e botão circular `inkFill` com o ícone
de enviar. É o único elemento escuro do app, e o botão sem texto visível carrega
`accessibilityLabel` obrigatório.

**`BarrasCriticidade`** (`charts/`) — barras horizontais em um tom, rotuladas por badge.

A escala valor→coordenada vive em `src/util/grafico.ts`, pura e testada. **Não é cálculo
financeiro:** nenhum valor novo nasce ali, é projeção geométrica de números que o backend já
enviou — mesma natureza de `formatBRL`.

---

## 5. Regras

- **Tema claro sempre.** Não há dark mode e não há `useColorScheme`. `app.json` já fixa
  `userInterfaceStyle: "light"`. O único elemento escuro do app é o botão de enviar do chat.
- **Alvo de toque mínimo 48pt** em qualquer elemento tocável. Vale para ícone, chip e link.
- **`accessibilityLabel` obrigatório** em todo controle sem texto visível.
  `accessibilityRole` correto em botão, link e cabeçalho.
- **Contraste mínimo 4.5:1** para texto de corpo. Todos os pares do design system já foram
  medidos (seção 1) — combinação nova exige medir, não estimar.
- **Nada de animação de urgência.** Sem pulsar, sem contagem regressiva, sem shake. Transições
  são suaves e curtas; respeite `AccessibilityInfo.isReduceMotionEnabled`.
- **Copy em pt-BR**, segunda pessoa, específica e sem julgamento. "Faltam 7 parcelas", não
  "Atenção: dívida em aberto".
- **Ícones:** `@expo/vector-icons` (Feather), traço fino, tamanho 20 ou 24. Ícone nunca carrega
  significado sozinho — sempre acompanha texto ou `accessibilityLabel`.

---

## 6. Identidade

A marca é o saldo caindo até o ponto de liberdade: uma linha em `#017A70` descendo até um ponto
em `accent`, **sobre branco**. Fonte em `assets/icon.svg`.

O ícone é claro porque o app é claro. Uma marca sobre near-black era o último resíduo do desenho
anterior — e, além de destoar, o violeta perde muito contraste sobre fundo escuro em 40px.

| Arquivo | Tamanho | Observação |
|---|---|---|
| `assets/icon.png` | 1024² | sangra até a borda; o iOS aplica o próprio arredondamento |
| `assets/adaptive-icon.png` | 1024² | marca a 72%, dentro da zona segura da máscara do Android |
| `assets/splash.png` | 1024² | a marca sozinha sobre o branco com que o app abre |

Os PNG são rasterizados do SVG com Chrome headless — a máquina não tem `rsvg-convert`,
ImageMagick nem `sharp`. O script vive fora do repositório; a fonte versionada é o SVG.
