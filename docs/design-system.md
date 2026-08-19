# Design System — devo.nada (React Native)

> Documento vivo. Fonte da verdade dos tokens: `src/theme/theme.ts`. Este documento explica o
> **porquê** e cataloga os componentes; o arquivo de tema carrega os valores.
> Alvo: **Expo / React Native, mobile nativo**. Não há versão web.

Tema **escuro sempre**. Cards de grafite elevado sobre grafite, separados por cor de superfície
mais uma borda de 1px. Verde como ação **e** como conquista, vermelho como status de dívida,
âmbar como negociação em andamento. Tipografia Inter para tudo, Archivo Black só para o número
protagonista e o wordmark.

## Os quatro princípios

1. **O ponto.** `devo.nada` lê-se como duas frases — "Devo. Nada." O ponto é o único elemento da
   marca que carrega cor de status: vermelho enquanto há dívida, âmbar enquanto se negocia a
   última, verde quando acabou.
2. **Vermelho é status, nunca cenário.** O usuário chega ansioso; a interface é calma. O vermelho
   marca dívida e some conforme ela é quitada — **a ausência progressiva do vermelho é a
   recompensa visual**. Ver ADR 0015.
3. **Ação, não retrovisor.** Cada tela responde "o que eu faço agora?". Dashboard existe para
   sustentar a próxima ação, nunca como fim.
4. **Respiro: lazer é linha do plano, não desvio.** O sistema nunca trata um gasto de respiro como
   erro. Ver `guardrails.md`, seção 4.1.

E uma regra de voz que atravessa tudo: **vitória se escreve na primeira pessoa do usuário.**
"devo nada", "quitei", "fechei por 5.900" — nunca "parabéns, você atingiu sua meta".

---

## 1. Paleta

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#F2F2ED` | texto principal (paper) |
| `inkSoft` | `#8A8F98` | texto secundário, legendas, unidades |
| `background` | `#101216` | fundo de tela (grafite) |
| `surface` | `#181B21` | cards, campos, bolha do buddy |
| `neutralSurface` | `#1F232B` | input, trilha de barra, área recuada, avatar |
| `border` | `#262A31` | borda de card e campo, divisor |
| `primary` | `#1FC16B` | **ação**: botão, link, aba ativa |
| `primaryHover` | `#17A559` | estado pressionado |
| `primaryBright` | `#3FDC8A` | **marca de gráfico** — nunca fundo de texto |
| `primarySoft` | `#2A6E4C` | anel de foco |
| `primarySurface` | `#12251B` | badge, banner informativo, bolha do usuário |
| `primaryDeep` | `#7CE8AF` | texto sobre `primarySurface` |
| `onPrimary` | `#08120C` | texto e ícone sobre superfície primária |
| `accent` | `#3FDC8A` | **conquista, economia, marco** |
| `accentSurface` | `#132A1F` | fundo de badge e banner de conquista |
| `inkFill` | `#1FC16B` | botão circular de enviar do chat |
| `warning` | `#F0A31C` | **acordo em andamento**, atraso factual, sem alarme |
| `warningSurface` · `warningBorder` | `#2A2010` · `#4A3612` | fundo e borda de atenção |
| `danger` | `#E5352B` | erro e ação destrutiva |
| `dangerSurface` · `dangerBorder` | `#2A1412` · `#4A1B17` | fundo e borda de erro |
| `debt` | `#E5352B` | **status de dívida**: saldo devedor, criticidade, ponto do logo |
| `debtSurface` · `debtBorder` | `#2A1412` · `#5C201B` | fundo de pill e borda de dívida crítica |

**Regra do vermelho.** Máximo ~10% de qualquer tela. **Nunca** como fundo de tela, de seção ou de
botão. `debt` marca dívida, `danger` marca erro — mesmo valor, nomes diferentes, e a tela diz qual
dos dois quis dizer. Ver ADR 0015 e `guardrails.md`, seção 4.

**Não existe botão vermelho.** Nem para ação destrutiva: ali se usa ghost mais confirmação. O CTA
primário é sempre verde, porque toda ação neste app é um passo para fora da dívida.

**Regra do card.** Card **tem borda** de 1px em `border`. No escuro a sombra é invisível — preto
sobre grafite não separa nada —, então a hierarquia é cor de superfície (`background` → `surface`
→ `neutralSurface`) mais a linha. Isso inverte a regra da ADR 0011, de propósito.

**Verde é ação e conquista.** `accent` fica um passo mais claro que `primary`: se fossem o mesmo
verde, o marco sumiria dentro da barra de ação.

**Não há light mode.** O grafite é identidade, não preferência. Sem `useColorScheme`.

### Estados do ponto

O ponto do wordmark é o único elemento da marca que muda de cor, e ele conta a história do
usuário:

| Estado | Cor | Quando |
|---|---|---|
| dívida | `debt` | há saldo devedor |
| negociando | `warning` | a última dívida está em acordo |
| devo nada | `primary` | acabou |

O ícone do app pode refletir isso via ícone alternativo — nice-to-have pós-MVP, não requisito.

### Cor de categoria

Quatro matizes para o anel do `CategoriaIcon`: `teal #2DD4BF`, `azul #60A5FA`,
`magenta #F472B6`, `ambar #FBBF24`. São as mesmas famílias da paleta clara, subidas em
luminosidade para se manterem legíveis sobre o grafite.

São **cor de objeto gráfico**, medidas contra o piso de 3:1, não contra o de texto — e nunca
informam sozinhas: há glifo e rótulo escrito ao lado.

São quatro e não seis por medição herdada: coral fica a **ΔE 11,9** do âmbar e violeta a
**ΔE 12,4** do azul (OKLab, validador de dataviz). Dois anéis que se confundem não acrescentam
nada. O verde ficou de fora por ser cor semântica reservada — ação e conquista —, e cor reservada
não vira "categoria 5".

### A paleta AINDA NÃO foi medida

Este é o débito conhecido da ADR 0015, e ele está declarado aqui porque escondê-lo inverteria o
princípio do projeto.

A paleta anterior tinha **todo** par texto/fundo medido em WCAG 2.1 (piso 4,5:1), **todo** anel de
categoria medido como objeto gráfico (piso 3:1) e **toda** dupla de semânticas adjacentes medida
em CIEDE2000 (piso ΔE 15). A tabela inteira vivia aqui, e a medição chegou a derrubar seis
escolhas que pareciam óbvias — o registro está nas ADR 0010 e 0011.

**Virar o tema de claro para escuro invalidou as três tabelas.** Nenhum dos valores atuais foi
medido; eles foram escolhidos por leitura de tela, que é exatamente o método que este documento
proíbe.

Portanto:

- **Remedir é item de pré-lançamento**, não polimento. Contraste é acessibilidade, e este público
  lê no ônibus, com a tela no sol, muitas vezes em aparelho de entrada com a brilho baixo para
  poupar bateria.
- Os pares que mais preocupam, por serem os que a paleta clara passava com pouca folga:
  `inkSoft` sobre as três superfícies, `warning` e `debt` sobre `surface`, e a separação ΔE entre
  `warning` e `debt` — âmbar e vermelho adjacentes num mesmo card de dívida.
- **Combinação nova exige medir, não estimar.** A regra sobreviveu à troca de paleta; só a tabela
  morreu.

---

## 2. Escalas

```ts
spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 }
radius  = { sm: 8, md: 14, lg: 16, xl: 24, pill: 999 }
```

Aplicação: **card `radius.lg`**, **controle e botão `radius.md`**, **badge, pill e botão circular
`radius.pill`**, **banner de feedback `radius.md`**, **bolha de chat `radius.lg`** (com 4px no
canto de origem).

`spacing.xxxl` é o ritmo entre seções de uma tela rolável e a folga no fim da lista.

### Sombras — não existem

```ts
shadow = { card: { elevation: 0 }, soft: { elevation: 0 }, float: { elevation: 0 } }
```

No escuro, sombra não separa nada: preto sobre grafite é invisível, e no Android a `elevation`
desenha uma mancha suja em volta do card. Quem separa a superfície aqui é a **cor** mais a
**borda**.

As três chaves continuam existindo porque dezenas de arquivos as espalham em `...shadow.card`, e
um objeto com `elevation: 0` mantém esse spread válido sem custo. Não remova as chaves para
"limpar" — o custo é um diff de 75 arquivos e o ganho é zero.

**A exceção declarada:** o glow verde da tela de vitória e dos marcos
(`0 0 60px rgba(31,193,107,.35)`). Ele é celebração pontual, não hierarquia de superfície, e por
isso vive na própria tela, não no token.

---

## 3. Tipografia

**Duas famílias, com papéis separados.** Inter carrega todo o texto; Archivo Black carrega o
wordmark e o número protagonista, e nada mais. Ambas via `@expo-google-fonts/*` em
`app/_layout.tsx`. Se a fonte falhar, o app sobe mesmo assim com a de sistema — segurar a splash
para sempre seria pior.

Com fontes customizadas o React Native **não deriva peso a partir de `fontWeight`** de forma
confiável entre plataformas. Por isso cada peso é uma família própria:

```ts
fontFamily = {
  regular: 'Inter_400Regular',
  medium:  'Inter_600SemiBold',
  bold:    'Inter_700Bold',
  display: 'ArchivoBlack_400Regular',   // wordmark e número protagonista
}
```

**Archivo Black nunca em texto corrido.** É display: máximo duas linhas, e em tela pequena mais do
que isso fica ilegível.

### O dígito tabular era medido, e a medição caiu junto com a fonte

Este é o segundo débito da ADR 0015, e ele é sutil o bastante para merecer parágrafo próprio.

Nunito Sans não foi escolhida por desenho — foi escolhida por **medição no arquivo da fonte**:
largura de dígito fixa, variação de 0,00px entre 0 e 9. Por isso `fontVariant: ['tabular-nums']`
foi removido de todos os componentes: pedir recurso OpenType que a família não declara é caminho
conhecido para o texto cair em fonte de sistema no Android. Figtree, a escolha estética mais
próxima na época, foi descartada exatamente aqui — o "1" mede 16,5px onde o "0" mede 25,6px, e
uma coluna de reais dançaria a cada linha.

**Inter não foi medida.** Enquanto não for, a regra é:

- `numeric` — o número que aparece em **coluna** (parcelas, gastos, extrato) — fica em **Inter**,
  onde o risco é conhecido e reversível.
- `display` e `displaySm` — o número **único e grande** de cada tela, que não se alinha com nada —
  usam **Archivo Black**. É onde a marca pede "dinheiro é o protagonista visual", e onde o
  desalinhamento de dígito não tem com o que desalinhar.

> **Item de validação em aparelho:** medir a largura de "0" e "1" em `Inter_700Bold`. Se
> divergirem, `numeric` precisa de `tabular-nums` ou de uma família tabular dedicada. Até a
> medição existir, **não promova `numeric` a Archivo Black** por estética — é assim que a coluna
> de valores começa a dançar.

### Escala

Números protagonistas moderados, não display gigante, e tracking quase neutro: a fonte é
humanista, e apertar o espacejamento dela desfaz o ar que é a característica do reference.

| Estilo | Família | Tamanho / entrelinha | Tracking | Onde |
|---|---|---|---|---|
| `display` | Archivo Black | 36 / 42 | −1,0 | número protagonista de uma tela |
| `displaySm` | Archivo Black | 26 / 32 | −0,6 | número de destaque em card |
| `title` | Inter 700 | 20 / 26 | −0,2 | título de tela, seção e estado vazio |
| `numeric` | Inter 700 | 18 / 24 | — | valor monetário **em coluna** |
| `body` / `bodyStrong` | Inter 400 / 600 | 16 / 24 | — | corpo |
| `caption` | Inter 400 | 13 / 18 | — | legenda, unidade, contexto |
| `eyebrow` | Inter 700 | 11 / 14 | +1,6 | rótulo acima do título, em maiúsculas |

O wordmark é caixa baixa, tracking −3%, sem espaço: `devo.nada`.

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
| `primary` | `primary` (verde) | `onPrimary` | ação principal da tela, uma por tela |
| `secondary` | `surface` com borda `primarySoft` | `primary` | ação alternativa |
| `danger` | **transparente** com borda `dangerBorder` | `danger` | excluir, apagar — sempre com confirmação |
| `ghost` | transparente | `inkSoft` | ação terciária, cancelar |

`size="lg"` (56pt) é o CTA principal de uma tela. `md` (48pt) segue sendo o **piso** de toque.

**O CTA primário é verde porque toda ação neste app é um passo para fora da dívida.** E `danger`
não tem fundo vermelho: não existe botão vermelho aqui, nem para destruição. O peso da ação
irreversível é carregado pela confirmação, não pela cor — gastar o vermelho num botão de excluir
tiraria dele o significado de que a marca depende.

### Demais componentes

**`Screen`** — wrapper de tela: `SafeAreaView` do `react-native-safe-area-context`, fundo
`background`, padding horizontal `spacing.lg` (removível com `flush` para listas que sangram
até a borda). Toda rota começa por ele.

**`PageHeader`** — título em `displaySm` + descrição em `inkSoft` + slot de ação à direita.
A prop **`titleLead`** dá o peso misto na mesma linha — "Suas **dívidas**", "Seu **caixa**" —, que
é a assinatura tipográfica do reference e diz mais que um eyebrow. Use `titleLead` nas quatro
abas; `eyebrow` fica para as telas internas, cujo título já é uma frase.

A prop **`onBack`** é a seta de voltar do app (ADR 0016): `Pressable` de 48×48 com `chevron-left`,
`accessibilityLabel="Voltar"`, **acima** do bloco de textos — o slot `action` continua à direita e
intacto. Como o app esconde o header nativo nos seis layouts, ela é a única saída de tela empilhada.
Ver a regra de navegação na seção 5.

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

`juros_abusivos` usa a família do vermelho porque é o status que a marca existe para marcar — mas
num tom suave de fundo, e como classificação factual de custo, nunca como repreensão. A copy
jamais sugere que o usuário errou ao contrair a dívida.

**`MoneyText`** — exibe centavos via `formatBRL`. Props `size`
(`body | numeric | displaySm | display`) e `tone`
(`ink | inkSoft | accent | onPrimary | warning | debt`). Nos dois tamanhos grandes o `R$` sai a
62% do corpo dos dígitos. **Não aplica `fontVariant`** — ver o débito de dígito tabular na
seção 3.

---

## 4c. Componentes da marca

### Já são código

**`Brand`** (`src/components/ui/Brand.tsx`) — o wordmark `devo.nada` em Archivo Black, caixa baixa,
tracking −3%. Props `size` (`sm` topbar · `md` cabeçalho · `lg` login · `hero` splash) e `estado`.
**O ponto é o único elemento colorido**, e a cor vem do estado da rota do usuário:

| Estado | Cor | Quando |
|---|---|---|
| `divida` | `debt` | há saldo devedor |
| `negociando` | `warning` | **a prop existe, nada a produz ainda** — chega no M12 |
| `quitado` | `primary` | teve dívida e zerou |
| `neutro` | `inkSoft` | ainda não cadastrou nada |

`neutro` existe separado de `quitado` de propósito: conta nova não é vitória, e um ponto verde ali
daria os parabéns por uma corrida que a pessoa não começou. O estado sai de
`src/util/estadoDaRota.ts` — função pura, com teste.

**`SplashDevoNada`** (`src/components/SplashDevoNada.tsx`) — a abertura. O ponto respira, e essa é
a única animação de repetição do app: exceção declarada no `guardrails.md`, seção 4.

**`TabBar`** — quatro abas: **Rota · Dívidas · Buddy · Extrato**. Os nomes de arquivo continuam
`painel`, `dividas`, `index` e `caixa` (linguagem ubíqua do `domain.md`); muda o rótulo e a ordem,
não a rota. **Ícone e pílula ativos seguem o estado da rota** — `debt` enquanto há dívida,
`primary` depois de quitar. É a única exceção decorativa do vermelho, e é o que faz o app inteiro
mudar de fase junto com o usuário.

**`NotaDePrivacidade`** (`src/components/ui/NotaDePrivacidade.tsx`) — a regra de ouro nº 1 dita no
login e no registro: "Seus dados nunca viram oferta de crédito." Se o produto um dia oferecer
crédito, **este componente sai antes**.

**`CardSaldo`, `CardBuddy`, `TopbarMarca`** (`src/components/rota/`) — o topo da Rota. A barra do
saldo enche com o que já foi percorrido, nunca com o que falta, e **só aparece quando há histórico
real** (`evolucaoSaldo` acumula a partir do cadastro): "0% percorrido" no primeiro dia seria
desanimador e falso.

**`Passos`** (`src/components/onboarding/Passos.tsx`) — os três traços do onboarding. A prop
**`onVoltar`** põe o mesmo `chevron-left` do `PageHeader` à esquerda das barrinhas: as telas do
onboarding não usam `PageHeader` (o título delas é chamada em `display` de 28pt), e o `Passos` é o
elemento mais alto das três.

**`BotaoSocial`** (`src/components/auth/BotaoSocial.tsx`) — Apple e Google na tela de entrada
(tela 11). Dois tons, como na concepção: Apple em `ink` com texto `background`, Google em `surface`
com borda. **Único lugar do app que usa `FontAwesome` em vez de `Feather`** — as marcas das duas
lojas são logotipos, não pictogramas, e nenhum conjunto geométrico as traz; trocar por um ícone
genérico tiraria o reconhecimento, que é a função inteira do botão. Hoje nasce `disabled` com
`accessibilityState`, porque não existe login social no backend, e quem explica é a legenda abaixo
do par. **`Divisor`** é o "ou" entre o social e o e-mail.

**`MetaCard`** (`src/components/metas/MetaCard.tsx`) — o card da aba Metas (tela 09). Emoji e nome,
linha de prazo e alvo, selo de situação, "Guardado"/"Aporte" (ou "Sugerido", quando a pessoa não
declarou aporte) e barra que **enche** rumo ao objetivo. `aporte_baixo` é **âmbar, nunca vermelho**:
o vermelho é status de dívida (ADR 0015). Sem prazo ou sem aporte declarado, **não há selo** — ver
ADR 0017.

### Ainda só especificação

> Estes vieram da concepção (`docs/concepcao/`) e **não existem em `src/`**. Dependem de domínio
> que o M11/M12 ainda vai trazer. Quando virarem código, sobem para a seção acima.

**`ScriptCard`** — a fala de negociação com a base legal à vista. Fala entre aspas; abaixo, o
bloco "Por que você pode falar isso", com borda esquerda verde de 2px e a citação em `caption`.
**Todo script exibe sua fonte** — é o diferencial de confiança do produto, e é também o que o
mantém do lado certo da fronteira jurídica.

Seletor de **canal** no topo (`telefone · chat · e-mail`, ver `domain.md`). Na variante escrita,
cada mensagem é um bloco com botão *copiar* próprio, o alerta de validação do número abre o card
e a regra de pagamento (boleto ou Pix no CNPJ do credor) o fecha. CTA final: "colar print da
resposta".

**`RespiroCard`** — "Respiro deste mês: R$ 150 · usados R$ 80". A barra enche em **verde**: usar
respiro é positivo, e pintá-la de vermelho seria a contradição exata do que o Respiro existe para
resolver. Copy sempre de permissão — "sobram R$ 70 pra usar sem culpa", nunca "você já gastou
R$ 80". Ver `guardrails.md`, seção 4.1.

**`MarcoScreen`** — tela cheia disparada em marco. Conquista em Archivo Black, respiro
desbloqueado com valor concreto, e um CTA de permissão ("Aproveita. Tá no plano."). Sugestão
contextual por tamanho do marco: sorvete/café → unha/cabelo/jantar → viagem rápida. Botão
alternativo "guardar pro próximo marco". Glow verde, na intensidade menor da tela de vitória.
Compartilhável em formato story.

**Pill de status** — fundo translúcido da cor, texto na cor, dot de 7px. Três variantes:
`debt` (crítica), `warning` (negociando), `primary` (sob controle / quitada). O `Badge` atual cobre
os tons; o dot ainda não existe.

---

## 4b. Visualização de dados

> Esta seção existe porque a proposta óbvia **falhou numa validação executada**, não porque
> alguém achou feio. Rodar o validador é obrigatório antes de definir qualquer paleta de gráfico.

> **ATENÇÃO — o que está medido aqui é a paleta CLARA.** Esta seção dizia ter sido reexecutada
> contra a paleta escura, e não tinha: os hex que ela citava (`#0D9488`, `#2563EB`, `#BE185D`,
> `#D97706`) são os da ADR 0011, não os de `theme.ts`. A afirmação foi removida em vez de
> corrigida no número, porque documentação que alega uma medição inexistente é pior que
> documentação que declara a lacuna. Vale aqui o mesmo que na seção 1: **remedir, não estimar.**

A pergunta se repõe a cada troca de paleta, e a resposta mudou de motivo — o que vale registrar.

**As barras continuam num tom só assim mesmo**, pelo outro argumento: o `CriticidadeBadge` ao
lado já nomeia a categoria, e quatro matizes ali seriam redundantes com o rótulo, não informação
nova. É uma decisão de economia de sinal, não de acessibilidade.

Duas coisas que a validação da paleta clara ensinou e que valem para a próxima:

- **Coral e violeta não entram em conjunto categórico** com âmbar e azul: ΔE 11,9 e 12,4, abaixo
  do piso de 15. Foi por isso que o conjunto de categoria tem quatro matizes, não seis.
- **CIEDE2000 e o validador de dataviz discordaram.** O par azul × violeta passava em CIEDE2000 e
  reprovou em OKLab com simulação de deuteranopia. Quando as duas divergem, vale a que simula
  visão de cores.

A marca de gráfico é `primaryBright`, e a de ação é `primary`. São duas cores para o mesmo verde,
com trabalhos diferentes — na paleta clara, `primary` numa linha de 2px ficava abaixo do piso de
croma e lia como cinza, e é por isso que o `Meter` usa uma para o texto da porcentagem e outra
para a barra. **Se a separação continua valendo sobre o grafite, é medição pendente**, não
conclusão herdada.

### Regras

- **Série única sempre que possível.** Uma série não leva legenda — o título nomeia o que está
  desenhado.
- **Categoria vem do rótulo, não do matiz.** As barras de `porCriticidade` usam um tom só; a
  identidade vem do `CriticidadeBadge` ao lado, onde a cor semântica já funciona em escala de
  badge e já passa no contraste.
- **Vermelho não entra em gráfico.** Ele é status de dívida (ADR 0015), e status pertence ao
  badge e ao número, onde há rótulo junto. Numa série ele viraria decoração alarmante. Saldo alto
  é `ink`, atraso é `warning` — sempre com ícone e texto junto, nunca cor sozinha.
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

**`MessageBubble`** (`chat/`) — as duas bolhas se distinguem por **superfície, não por matiz**:
assistente em `neutralSurface`, usuário em `primarySurface`, raio `lg` uniforme. Quem identifica o
assistente é a marca ao lado da bolha, não a cor de fundo dela.

**`ChatComposer`** (`chat/`) — campo em pílula flutuante e botão circular `inkFill` com o ícone
de enviar. O botão sem texto visível carrega `accessibilityLabel` obrigatório.

**`BarrasCriticidade`** (`charts/`) — barras horizontais em um tom, rotuladas por badge.

A escala valor→coordenada vive em `src/util/grafico.ts`, pura e testada. **Não é cálculo
financeiro:** nenhum valor novo nasce ali, é projeção geométrica de números que o backend já
enviou — mesma natureza de `formatBRL`.

---

## 5. Regras

- **Tema escuro sempre.** Não há light mode e não há `useColorScheme`. `app.json` fixa
  `userInterfaceStyle: "dark"`; a status bar é `light`.
- **Alvo de toque mínimo 48pt** em qualquer elemento tocável. Vale para ícone, chip e link.
- **`accessibilityLabel` obrigatório** em todo controle sem texto visível.
  `accessibilityRole` correto em botão, link e cabeçalho.
- **Contraste mínimo 4.5:1** para texto de corpo. **A tabela de medições caiu com a ADR 0015 e
  ainda não foi refeita** (seção 1) — até lá, toda combinação exige medir, não estimar.
- **Nada de animação de urgência.** Sem pulsar, sem contagem regressiva, sem shake. Transições são
  suaves e curtas (150–250ms); respeite `AccessibilityInfo.isReduceMotionEnabled`.
  - **A exceção é a transição de status vermelho → verde: 1,2s.** É a animação-assinatura do
    produto. Quitar uma dívida precisa ser *visto*, e essa é a única lentidão intencional do app.
- **Copy em pt-BR**, segunda pessoa, específica e sem julgamento. "Faltam 7 parcelas", não
  "Atenção: dívida em aberto".
- **Ícones:** `@expo/vector-icons` (Feather), traço fino, tamanho 20 ou 24. Ícone nunca carrega
  significado sozinho — sempre acompanha texto ou `accessibilityLabel`. **Única exceção de família:**
  os logotipos de Apple e Google em `BotaoSocial`, que vêm do `FontAwesome` porque o Feather não os
  tem e um pictograma genérico destruiria o reconhecimento do botão.
- **Toda tela empilhada tem seta de voltar** no canto superior esquerdo, via `PageHeader.onBack` (ou
  `Passos.onVoltar`, no onboarding) — **inclusive nos ramos de carregando e de erro**, que é onde a
  pessoa mais quer sair. Raiz de aba não tem: não há para onde voltar. E **uma afordância de saída
  por tela**: com a seta no topo, ghost de rodapé que só volta é redundância. Ghost com significado
  próprio fica ("Cancelar" de formulário, "Já tenho conta"). Ver ADR 0016.

### Checklist de revisão de tela

Antes de aprovar qualquer tela nova:

1. O vermelho ocupa menos de ~10% e só marca dívida?
2. Existe UMA próxima ação clara (no máximo um botão primário)?
3. O número protagonista está em Archivo Black e a coluna de valores em Inter?
4. O texto fala como buddy — ativo, concreto, sem culpa?
5. Se algo foi quitado ou melhorou, o verde aparece? A vitória está visível?

---

## 6. Identidade

A marca é o **wordmark** `devo.nada` em Archivo Black, caixa baixa, tracking −3%, com o ponto na
cor de status. O ícone do app é **só o ponto**.

Isso é o que faz a marca funcionar como marca e não como logotipo: o mesmo elemento que identifica
o produto reporta o estado do usuário. Ver ADR 0015 e a tabela de estados na seção 1.

Variações: principal (sobre grafite), invertida (sobre paper, para material impresso e social),
empilhada, e o ícone.

| Arquivo | Tamanho | Observação |
|---|---|---|
| `assets/icon.png` | 1024² | o ponto sangrando até a borda; o iOS aplica o próprio arredondamento |
| `assets/adaptive-icon.png` | 1024² | ponto a 72%, dentro da zona segura da máscara do Android |
| `assets/splash.png` | 1024² | o ponto sozinho sobre `#101216` |

Os PNG são rasterizados do SVG com Chrome headless — a máquina não tem `rsvg-convert`,
ImageMagick nem `sharp`. O script vive fora do repositório; a fonte versionada é o SVG.

> **PENDENTE:** os três PNG e o `assets/icon.svg` ainda são os da marca anterior. Trocá-los é
> item de pré-lançamento — o app hoje roda com a paleta certa e o ícone errado.
