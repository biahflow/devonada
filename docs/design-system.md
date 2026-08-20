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
| `surface` | `#181B21` | cards, campos, bolha do Tino |
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
| `danger` | `#E5352B` | erro e ação destrutiva, em **objeto gráfico** |
| `dangerText` | `#EC6C65` | erro em **texto**: caption de campo, rótulo de botão, banner |
| `dangerSurface` · `dangerBorder` | `#2A1412` · `#4A1B17` | fundo e borda de erro |
| `debt` | `#E5352B` | **status de dívida** em objeto gráfico: ponto do logo, pill, barra, borda, e o saldo em `display`/`displaySm` |
| `debtText` | `#EC6C65` | status de dívida em **texto**: valor em `body`/`numeric`, rótulo da aba ativa |
| `debtSurface` · `debtBorder` | `#2A1412` · `#5C201B` | fundo de pill e borda de dívida crítica |

**Regra do vermelho.** Máximo ~10% de qualquer tela. **Nunca** como fundo de tela, de seção ou de
botão. `debt` marca dívida, `danger` marca erro — mesmo valor, nomes diferentes, e a tela diz qual
dos dois quis dizer. Ver ADR 0015 e `guardrails.md`, seção 4.

**Regra do vermelho em texto, e ela é uma regra porque foi medida.** `#E5352B` dá **4,35 / 4,00 /
3,66** sobre `background` / `surface` / `neutralSurface`. Passa o piso de 3:1 de objeto gráfico e
de texto grande, e **reprova** o piso de 4,5:1 de texto de corpo. Por isso o vermelho tem dois
tokens e não dois valores por acaso:

- **objeto gráfico e texto grande** (`display`, `displaySm`) → `debt` / `danger`, o hex da marca;
- **texto de corpo, legenda e rótulo** → `debtText` / `dangerText`, `#EC6C65`.

`#EC6C65` **não é um vermelho novo**: é o mesmo clareado até 4,5:1 com folga, preservando matiz e
saturação até onde 8 bits permitem (H 3,23° → 3,11°; S 78,15% → 78,03%). Mudar o hex de `debt`
resolveria o contraste e mudaria o ponto do wordmark — que é a marca. Ver ADR 0018.

O `MoneyText` aplica isso sozinho: o tom `debt` muda de valor com o `size`, porque o número
protagonista tem direito ao vermelho da marca e a coluna de valores não.

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
| **neutro** | `inkSoft` | **conta nova, nenhuma dívida cadastrada** |

**São quatro, e o brand board fala em três.** `neutro` é o que o código acrescentou, e a razão é
que sem ele o ponto NASCE VERDE: quem acabou de criar a conta não tem dívida, `totalDevido` é
zero, e a regra "zero ⇒ quitado" daria os parabéns por uma corrida que a pessoa nem começou. Verde
é conquista — só aparece para quem teve dívida e zerou. Ver `src/util/estadoDaRota.ts`.

`negociando` **ainda não é produzido**: `SituacaoDivida` é `ativa | quitada | renegociada`, e
nenhum desses significa "há acordo em andamento". Entra com o registro de resultado de negociação,
no M12. A ausência está declarada no código em vez de inferida de `renegociada`, que afirmaria um
fato que o banco não tem.

O ícone do app pode refletir isso via ícone alternativo — nice-to-have pós-MVP, não requisito.

### Área de respiro

**A margem mínima ao redor do wordmark é a altura da letra "d"** — regra do [brand board](marca/brand-board-v1.html), e ela
virou número por medição: **737 de 1000 unidades de em** em `ArchivoBlack_400Regular`, lido da
tabela `glyf` por `medirGlifo` (`scripts/fonte.js`). Não foi estimado pelo `fontSize`.

O `Brand` carrega esse respiro como padding próprio, então a regra vale por construção — quem
monta a tela não precisa lembrar dela. O `marginLeft` negativo que acompanha o padding separa as
duas coisas que a regra mistura: **área de proteção é restrição sobre os vizinhos, não
deslocamento do logo.** Sem ele o wordmark recua para dentro e perde o prumo com o título da tela;
com ele, a borda esquerda do texto volta à coluna e a zona morta à esquerda cai sobre a margem da
tela, que já é vazia. Em cima, embaixo e à direita ela vale de verdade.

### Cor de categoria

Quatro matizes para o anel do `CategoriaIcon`: `teal #2DD4BF`, `azul #60A5FA`,
`magenta #F472B6`, `ambar #FBBF24`. São as mesmas famílias da paleta clara, subidas em
luminosidade para se manterem legíveis sobre o grafite.

São **cor de objeto gráfico**, medidas contra o piso de 3:1, não contra o de texto — e nunca
informam sozinhas: há glifo e rótulo escrito ao lado. Os quatro estão no `palette:check`: cada um
contra `background` e `surface`, e os seis pares entre si em CIEDE2000. **O pior par é
teal × azul, a ΔE 33,5** — mais que o dobro do piso; o anel mais próximo do fundo é o magenta, a
6,51:1 sobre `surface`, contra um piso de 3:1. As tabelas abaixo trazem os catorze números.

São quatro e não seis por medição herdada: coral fica a **ΔE 11,9** do âmbar e violeta a
**ΔE 12,4** do azul (OKLab, validador de dataviz, na paleta clara). Dois anéis que se confundem
não acrescentam nada. O verde ficou de fora por ser cor semântica reservada — ação e conquista —,
e cor reservada não vira "categoria 5".

### A paleta é medida, e a medição é um gate

As três tabelas abaixo são a **saída literal** de `node scripts/paleta-check.mjs --tabela`.
Ninguém as digita: `npm run palette:check` lê os hex de `src/theme/theme.ts`, mede os pares
declarados em `scripts/paleta-check.mjs` e sai com código 1 se algum par sem exceção cair abaixo
do piso. Quando um valor muda aqui, o gate cai — que é exatamente o que **não** aconteceu quando
o validador vivia fora do repositório e virar o tema apagou três tabelas em silêncio (ADR 0018).

A lista de pares é **declarada**, não varrida: cada linha é uma adjacência que existe numa tela.
Uma varredura de todas as combinações mediria pares que nunca se encostam, e o ruído
transformaria o gate em algo que se aprende a ignorar. **Combinação nova entra na lista no mesmo
commit em que aparece na tela** — a regra sobreviveu à troca de paleta; agora a tabela também.

`excecao` não isenta de medir, isenta de reprovar: o número continua na tabela, e a
justificativa fica ao lado dele. As exceções vigentes estão registradas na ADR 0018.

**Texto** — WCAG 2.1, piso 4,5:1

| Frente | Fundo | Contraste | Piso | Resultado |
|---|---|---|---|---|
| `ink` `#F2F2ED` | `background` `#101216` | 16,69:1 | 4,5:1 | passa |
| `ink` `#F2F2ED` | `surface` `#181B21` | 15,36:1 | 4,5:1 | passa |
| `ink` `#F2F2ED` | `neutralSurface` `#1F232B` <br><sub>bolha do assistente</sub> | 14,02:1 | 4,5:1 | passa |
| `ink` `#F2F2ED` | `primarySurface` `#12251B` <br><sub>bolha do usuário</sub> | 14,32:1 | 4,5:1 | passa |
| `inkSoft` `#8A8F98` | `background` `#101216` | 5,77:1 | 4,5:1 | passa |
| `inkSoft` `#8A8F98` | `surface` `#181B21` | 5,31:1 | 4,5:1 | passa |
| `inkSoft` `#8A8F98` | `neutralSurface` `#1F232B` | 4,85:1 | 4,5:1 | passa |
| `primary` `#1FC16B` | `background` `#101216` <br><sub>link</sub> | 7,94:1 | 4,5:1 | passa |
| `primary` `#1FC16B` | `surface` `#181B21` <br><sub>rótulo do Button secondary</sub> | 7,31:1 | 4,5:1 | passa |
| `onPrimary` `#08120C` | `primary` `#1FC16B` <br><sub>rótulo do Button primary</sub> | 8,07:1 | 4,5:1 | passa |
| `primaryDeep` `#7CE8AF` | `primarySurface` `#12251B` <br><sub>Badge primario</sub> | 10,73:1 | 4,5:1 | passa |
| `accent` `#3FDC8A` | `background` `#101216` | 10,55:1 | 4,5:1 | passa |
| `accent` `#3FDC8A` | `surface` `#181B21` | 9,70:1 | 4,5:1 | passa |
| `accent` `#3FDC8A` | `accentSurface` `#132A1F` <br><sub>Badge progresso, Feedback success</sub> | 8,57:1 | 4,5:1 | passa |
| `warning` `#F0A31C` | `background` `#101216` | 8,89:1 | 4,5:1 | passa |
| `warning` `#F0A31C` | `surface` `#181B21` | 8,18:1 | 4,5:1 | passa |
| `warning` `#F0A31C` | `neutralSurface` `#1F232B` | 7,47:1 | 4,5:1 | passa |
| `warning` `#F0A31C` | `warningSurface` `#2A2010` <br><sub>Badge atencao, Feedback warning</sub> | 7,59:1 | 4,5:1 | passa |
| `debtText` `#EC6C65` | `background` `#101216` <br><sub>saldo devedor em body/numeric</sub> | 6,16:1 | 4,5:1 | passa |
| `debtText` `#EC6C65` | `neutralSurface` `#1F232B` <br><sub>valor em área recuada</sub> | 5,17:1 | 4,5:1 | passa |
| `ink` `#F2F2ED` | `surface` `#181B21` <br><sub>rótulo da aba ativa, sobre a barra</sub> | 15,36:1 | 4,5:1 | passa |
| `dangerText` `#EC6C65` | `background` `#101216` <br><sub>erro do chat</sub> | 6,16:1 | 4,5:1 | passa |
| `dangerText` `#EC6C65` | `surface` `#181B21` <br><sub>caption de erro de campo, rótulo do Button danger</sub> | 5,67:1 | 4,5:1 | passa |
| `dangerText` `#EC6C65` | `dangerSurface` `#2A1412` <br><sub>Feedback error, Badge alto</sub> | 5,72:1 | 4,5:1 | passa |

**Objeto gráfico e texto grande** — WCAG 2.1, piso 3:1

| Frente | Fundo | Contraste | Piso | Resultado |
|---|---|---|---|---|
| `debtText` `#EC6C65` | `surface` `#181B21` <br><sub>o quadrado da aba ativa, sobre a barra — fase de dívida</sub> | 5,67:1 | 3,0:1 | passa |
| `debt` `#E5352B` | `background` `#101216` <br><sub>ponto do wordmark, halo da splash, e o saldo devedor em display/displaySm — texto grande (≥26px), que a WCAG mede por este mesmo piso</sub> | 4,35:1 | 3,0:1 | passa |
| `debt` `#E5352B` | `surface` `#181B21` <br><sub>ponto do wordmark na topbar de toda aba; saldo devedor grande dentro de card</sub> | 4,00:1 | 3,0:1 | passa |
| `debt` `#E5352B` | `neutralSurface` `#1F232B` <br><sub>barra e borda de estado de erro</sub> | 3,66:1 | 3,0:1 | passa |
| `primary` `#1FC16B` | `surface` `#181B21` <br><sub>o quadrado da aba ativa, sobre a barra — fase verde</sub> | 7,31:1 | 3,0:1 | passa |
| `primaryBright` `#3FDC8A` | `background` `#101216` <br><sub>LinhaEvolucao</sub> | 10,55:1 | 3,0:1 | passa |
| `primaryBright` `#3FDC8A` | `surface` `#181B21` <br><sub>barra do Meter</sub> | 9,70:1 | 3,0:1 | passa |
| `teal` `#2DD4BF` | `background` `#101216` <br><sub>anel do CategoriaIcon</sub> | 10,07:1 | 3,0:1 | passa |
| `teal` `#2DD4BF` | `surface` `#181B21` | 9,27:1 | 3,0:1 | passa |
| `azul` `#60A5FA` | `background` `#101216` | 7,37:1 | 3,0:1 | passa |
| `azul` `#60A5FA` | `surface` `#181B21` | 6,78:1 | 3,0:1 | passa |
| `magenta` `#F472B6` | `background` `#101216` | 7,08:1 | 3,0:1 | passa |
| `magenta` `#F472B6` | `surface` `#181B21` | 6,51:1 | 3,0:1 | passa |
| `ambar` `#FBBF24` | `background` `#101216` | 11,23:1 | 3,0:1 | passa |
| `ambar` `#FBBF24` | `surface` `#181B21` | 10,33:1 | 3,0:1 | passa |
| `border` `#262A31` | `background` `#101216` | 1,30:1 | 3,0:1 | **exceção** — divisor decorativo, nunca portador de informação |
| `border` `#262A31` | `surface` `#181B21` | 1,20:1 | 3,0:1 | **exceção** — divisor decorativo, nunca portador de informação |
| `warningBorder` `#4A3612` | `warningSurface` `#2A2010` | 1,39:1 | 3,0:1 | **exceção** — contorno de banner; quem carrega o sentido é o texto dentro dele |
| `dangerBorder` `#4A1B17` | `dangerSurface` `#2A1412` | 1,21:1 | 3,0:1 | **exceção** — contorno de banner; quem carrega o sentido é o texto dentro dele |
| `debtBorder` `#5C201B` | `surface` `#181B21` | 1,38:1 | 3,0:1 | **exceção** — contorno do card de dívida crítica; o Badge ao lado nomeia a criticidade |

**Duplas semânticas** — CIEDE2000, piso ΔE 15

| Par | ΔE | Piso | Resultado |
|---|---|---|---|
| `debt` `#E5352B` × `warning` `#F0A31C` <br><sub>ponto: dívida × negociando</sub> | ΔE 35,4 | ΔE 15 | passa |
| `warning` `#F0A31C` × `primary` `#1FC16B` <br><sub>ponto: negociando × devo nada</sub> | ΔE 43,3 | ΔE 15 | passa |
| `debt` `#E5352B` × `primary` `#1FC16B` <br><sub>ponto: dívida × devo nada</sub> | ΔE 74,1 | ΔE 15 | passa |
| `primary` `#1FC16B` × `accent` `#3FDC8A` <br><sub>conquista × ação; e o texto do Meter × a barra do Meter</sub> | ΔE 7,1 | ΔE 15 | **exceção** — proximidade é o desenho — a conquista é o MESMO verde um passo mais claro, e os dois nunca precisam ser distinguidos um do outro: onde aparecem juntos há rótulo, e onde há só um a semântica vem do lugar, não do matiz |
| `teal` `#2DD4BF` × `azul` `#60A5FA` | ΔE 33,5 | ΔE 15 | passa |
| `teal` `#2DD4BF` × `magenta` `#F472B6` | ΔE 58,3 | ΔE 15 | passa |
| `teal` `#2DD4BF` × `ambar` `#FBBF24` | ΔE 41,8 | ΔE 15 | passa |
| `azul` `#60A5FA` × `magenta` `#F472B6` | ΔE 40,4 | ΔE 15 | passa |
| `azul` `#60A5FA` × `ambar` `#FBBF24` | ΔE 55,5 | ΔE 15 | passa |
| `magenta` `#F472B6` × `ambar` `#FBBF24` | ΔE 57,7 | ΔE 15 | passa |
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

**"Números · Archivo Black", do brand board, vale para o número PROTAGONISTA — não para número em
coluna.** O board não faz essa distinção porque os exemplos dele são todos de destaque ("R$ 12.480
quitados este mês"); o app faz, e a razão está medida logo abaixo:

| Onde | Escala | Família | Por quê |
|---|---|---|---|
| Número protagonista de uma tela — saldo devedor, valor justo, economia | `display` · `displaySm` | Archivo Black | é o número da marca, e a fonte já é tabular por natureza (amplitude zero) |
| Número em COLUNA — parcelas, extrato, lista de gastos | `numeric` | Inter Bold + `tabular-nums` | precisa alinhar linha a linha, e Inter só fica tabular quando se pede |

Se um dia a coluna migrar para Archivo Black, ela ganha o dígito tabular de graça — mas perde a
legibilidade em 18px, que é o tamanho de `numeric`. A escolha atual é essa troca, feita com o
número na mão e não por gosto.

### O dígito tabular é medido, e a medição é um gate

Este era o segundo débito da ADR 0015. Ele está fechado, e a forma como fechou importa mais que o
resultado.

Nunito Sans não tinha sido escolhida por desenho — foi escolhida por **medição no arquivo da
fonte**: largura de dígito fixa. Trocar por Inter descartou essa garantia, e o débito ficou
anotado como **"item de validação em aparelho"**. Não era. A largura de avanço de um glifo está na
tabela `hmtx` do TTF: é fato do arquivo, idêntico em todo aparelho que renderize aquela família, e
se lê sem device nenhum. Chamar de "validação em aparelho" o que se responde com um `readFileSync`
adia por meses uma medição de dez minutos — e foi o que aconteceu aqui.

`npm run digits:check` lê os TTF direto de `node_modules/@expo-google-fonts/`, parseia `head`,
`hhea`, `maxp`, `cmap`, `hmtx` e `GSUB` em node puro e imprime a tabela abaixo. Medido em
**19/08/2026**:

| Família | unitsPerEm | "0" | "1" | Amplitude dos dez | `tnum` na GSUB | Veredito |
|---|---|---|---|---|---|---|
| `Inter_400Regular` | 2048 | 1292 | 833 | 490 (0,239 em) | sim | proporcional |
| `Inter_600SemiBold` | 2048 | 1351 | 866 | 498 (0,243 em) | sim | proporcional |
| `Inter_700Bold` | 2048 | 1381 | 883 | 502 (0,245 em) | sim | proporcional |
| `ArchivoBlack_400Regular` | 1000 | 667 | 667 | 0 | não | **já tabular** |

A coluna de amplitude **não é a subtração das duas anteriores**: ela é a distância entre o dígito
mais largo e o mais estreito dos dez, e nem sempre o mais largo é o "0". Em `Inter_700Bold` o
extremo superior é o "4", com 1385 — por isso a amplitude é 502 e não os 498 que separam "0" de
"1". As colunas "0" e "1" estão ali por serem o par que mais aparece lado a lado num valor.

**Inter é proporcional nos três pesos.** Em `Inter_700Bold` o "1" avança 883 onde o "0" avança
1381. Numa coluna de reais a 18px isso é cerca de 4,4px de deslocamento por dígito "1" que entra
ou sai da linha, e o extrato inteiro escorrega quando um valor cruza R$ 1.000,00. Os dez dígitos
divergem entre si, não só o "1".

**Archivo Black já é tabular**: os dez avançam 667 de 1000, amplitude zero. `display` e
`displaySm` não precisam pedir nada — o que é bom, porque ela também **não** declara `tnum`, e
pedir a uma família um recurso OpenType que ela não tem é caminho conhecido para o texto cair em
fonte de sistema no Android.

A correção, então, é uma linha só, em `typography.numeric`:

```ts
numeric: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.bold, fontVariant: ['tabular-nums'] }
```

Ela é legítima porque a **Inter declara `tnum`** na `GSUB` — verificado na mesma leitura, ao lado
de `pnum` e `zero`. É a medição que autoriza o pedido; sem ela seria exatamente o chute que
derrubou Figtree na paleta anterior.

Segue valendo, e agora por medição e não por precaução: **não promova `numeric` a Archivo Black**
por estética. Ela é display, ilegível em texto corrido e em tela pequena.

> **O que a medição NÃO prova.** Que o `tnum` chegou à tela. O gate lê o arquivo da fonte e lê o
> `theme.ts`; ele não renderiza nada. Que a coluna de fato para de dançar em aparelho — e que a
> família chegou a carregar antes de o app desenhar — continua sendo **validação humana em
> device**, como em todo o M1.5–M9.

O gate tem dois lados, e é o segundo que o faz poder reprovar. Medir os TTF sozinho nunca falharia
(a Inter tem `tnum`, a Archivo Black já é tabular), e gate que não pode falhar é decoração. Então
ele também confere o `typography.numeric` do `theme.ts` contra a medição: se a escala da coluna de
reais usar uma família de dígitos proporcionais **e** não pedir `tabular-nums`, ele sai 1. É a
regressão que de fato pode acontecer — alguém remove o `fontVariant`, ou aponta `numeric` para
outra família — e é o mesmo erro que a ADR 0010 cometeu ao deixar o validador de paleta fora do
repositório: medição sem comando que quebre é medição que morre em silêncio (ADR 0018).

### Escala

Números protagonistas moderados, não display gigante, e tracking quase neutro: a fonte é
humanista, e apertar o espacejamento dela desfaz o ar que é a característica do reference.

| Estilo | Família | Tamanho / entrelinha | Tracking | Onde |
|---|---|---|---|---|
| `display` | Archivo Black | 36 / 42 | −1,0 | número protagonista de uma tela |
| `displaySm` | Archivo Black | 26 / 32 | −0,6 | número de destaque em card |
| `title` | Inter 700 | 20 / 26 | −0,2 | título de tela, seção e estado vazio |
| `numeric` | Inter 700 | 18 / 24 | — | valor monetário **em coluna** — único com `tabular-nums` |
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
62% do corpo dos dígitos. **Não aplica `fontVariant` por conta própria**: o dígito tabular vem da
escala, não do componente — `typography.numeric` pede `tabular-nums` e `display`/`displaySm` não
precisam, porque a Archivo Black já é tabular. Ver seção 3.

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

**`TabBar`** — cinco abas: **Rota · Dívidas · Metas · Tino · Caixa**. Os nomes de arquivo
continuam `painel`, `dividas`, `metas`, `index` e `caixa` (linguagem ubíqua do `domain.md`); muda
o rótulo e a ordem, não a rota.

**Não há ícone.** Cada aba é um quadrado de 26pt (`radius.sm`) sobre o rótulo escrito. Cinco
pictogramas competindo no rodapé pedem que a pessoa decifre metáforas — um mapa, um alvo, uma
caixa de entrada — na hora em que ela quer só trocar de tela; o rótulo em português já diz o que
cada aba é. O que sobra para o elemento gráfico é o que o texto não diz: onde estou, e em que
fase. É também o que faz cinco abas caberem onde cinco ícones brigariam.

**O quadrado da aba ativa segue o estado da rota** — `debtText` enquanto há dívida, `primary`
depois de quitar (`corDaFase`, exportada e testada). É a única exceção decorativa do vermelho, e é
o que faz o app inteiro mudar de fase junto com o usuário. O rótulo ativo vira `ink`: o quadrado
já carrega a cor, e repeti-la num texto de 12px gastaria o único elemento colorido em dois
lugares.

**A barra honra `href: null`, mas não pelo `href`.** O expo-router consome essa prop e a traduz
para `tabBarItemStyle: { display: 'none' }`; como esta barra desenha `state.routes` na mão, ela
precisa ler o estilo. Hoje nenhuma aba está escondida — Dívidas e Metas convivem —, e o mecanismo
segue coberto por teste para a próxima que precisar sumir.

> **Mudança de rumo em 19/08/2026.** A ADR 0017 previa que a segunda aba TROCASSE na fase verde:
> "Dívidas" viraria "Metas". A troca nunca aconteceu em aparelho, porque a barra ignorava o
> `href` — as duas sempre apareceram juntas. Ao corrigir o defeito, a decisão foi revista em vez
> de aplicada: **Metas é destino, não prêmio de fim de jogo.** Quem está pagando dívida também
> guarda para o IPVA de janeiro, e esconder a aba até a quitação adiava a única tela que fala do
> depois.

**`NotaDePrivacidade`** (`src/components/ui/NotaDePrivacidade.tsx`) — a regra de ouro nº 1 dita no
login e no registro: "Seus dados nunca viram oferta de crédito." Se o produto um dia oferecer
crédito, **este componente sai antes**.

**`CardSaldo`, `CardTino`, `TopbarMarca`** (`src/components/rota/`) — o topo da Rota. A barra do
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
R$ 80". Ver `guardrails.md`, seção 4.1, e ADR 0019.

Props, todas vindas de `GET /v1/caixa` e nenhuma calculada aqui:
`{ respiro, respiroUsadoNoMes, respiroDisponivelNoMes, respiroSaldoAcumulado }`, mais `onRegistrarUso`
e `onDeclarar`. O card tem **dois estados**, e o vazio é o que faz a feature existir para quem mais
precisa dela: sem respiro declarado (`respiro === null`) ele convida a declarar e diz o que o valor
vai custar em meses, porque não existe default (ADR 0019). Com respiro declarado, mostra o número.

Barra no molde inline de `MetaCard`: trilho de 8px em `colors.neutralSurface`, preenchimento em
**`colors.accent`**, `radius.pill`. **Não use `Meter`** — ele é medidor de limiar, com marca de
limite e virada para `warning` acima dela, e aqui não existe limite a ultrapassar. A largura em
porcentagem é proporção visual, não dinheiro exibido; o valor de `respiroDisponivelNoMes` vem
pronto do servidor.

Saldo acumulado, quando maior que zero, é **linha discreta em `caption`** — "guardado: R$ 220" —
e não uma segunda barra. Duas barras no mesmo card leriam como progresso e meta, que é a semântica
do `MetaCard`, não desta.

**`MarcoScreen`** — tela cheia disparada em marco. Conquista em Archivo Black (`display`), respiro
desbloqueado com valor concreto, e um CTA de permissão ("Aproveita. Tá no plano."). Sugestão
contextual por tamanho do marco: sorvete/café → unha/cabelo/jantar → viagem rápida. Botão
alternativo "guardar pro próximo marco". Glow verde, na intensidade menor da tela de vitória.

Props: `{ tipo, respiroSaldoAcumulado }` e os dois `on*` dos botões. **A sugestão contextual sai de
uma tabela de copy no cliente indexada pela faixa de valor, e é texto — nunca um número.** Se ela
produzisse valor, seria o app dizendo quanto a pessoa deve gastar em lazer, que é exatamente o
coeficiente sem fonte que a ADR 0019 recusou.

Vive **fora do grupo `(tabs)`**, no molde de `(onboarding)`: barra de abas embaixo de uma tela de
celebração a transforma em modal decorativo. `gestureEnabled: false` e saída só pelos dois botões,
que é o que grava `celebradoEm` e impede a tela de reaparecer a cada abertura do app.

**O compartilhamento em formato story fica de fora do M11.** A concepção o previa, e ele volta
quando estiver decidido o que pode aparecer na imagem — valor absoluto de dívida é o dado mais
sensível do produto e não deveria sair do aparelho por esse caminho sem decisão explícita
(`docs/features/F-010-respiro/feature.md`, *Open questions*).

**Pill de status** — fundo translúcido da cor, texto na cor, dot de 7px. Três variantes:
`debt` (crítica), `warning` (negociando), `primary` (sob controle / quitada). O `Badge` atual cobre
os tons; o dot ainda não existe.

---

## 4b. Visualização de dados

> Esta seção existe porque a proposta óbvia **falhou numa validação executada**, não porque
> alguém achou feio. Rodar o validador é obrigatório antes de definir qualquer paleta de gráfico.

> **A medição da paleta escura existe agora, e é a da seção 1.** Esta seção chegou a alegar ter
> sido reexecutada contra o tema escuro citando os hex da paleta clara (`#0D9488`, `#2563EB`,
> `#BE185D`, `#D97706`, da ADR 0011); a alegação foi removida em vez de ter o número corrigido,
> porque documentação que inventa medição é pior que documentação que declara a lacuna. O
> `npm run palette:check` fechou a lacuna: os quatro anéis de categoria e a marca de gráfico
> estão medidos contra `background` e `surface` no piso de 3:1, e os seis pares de categoria em
> CIEDE2000 — a tabela está na seção 1. **O que continua herdado da paleta clara, e está dito
> como herança, é o argumento sobre coral e violeta**, que não são tokens deste tema.

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
para a barra.

**Sobre o grafite, os dois passam sozinhos e não se separam um do outro.** `primaryBright` mede
10,55:1 sobre `background` e 9,70:1 sobre `surface` — folga larga no piso de 3:1 de série —, e
`primary` mede 7,94:1 e 7,31:1 como texto. Mas `primary × primaryBright` dá **ΔE 7,1**, abaixo do
piso de 15, e essa é uma das duas exceções declaradas do `palette:check` (ADR 0018). Ela vale
porque a proximidade é o desenho: os dois nunca precisam ser distinguidos **um do outro** — no
`Meter` a porcentagem é texto e a barra é barra, e é a forma que os separa, não o matiz.
`accent` é o mesmo hex de `primaryBright`, então a linha da tabela responde às duas perguntas.

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
- **Contraste mínimo 4.5:1** para texto de corpo, 3:1 para objeto gráfico e texto grande, ΔE 15
  entre semânticas adjacentes. A tabela vigente está na seção 1 e é gerada por
  `npm run palette:check` — **o quinto gate**. Combinação nova entra na lista de
  `scripts/paleta-check.mjs` no mesmo commit em que aparece na tela: medir, não estimar.
- **Vermelho em texto usa `debtText`/`dangerText`, não `debt`/`danger`.** O hex da marca reprova
  4,5:1 (seção 1). Isso vale para caption, rótulo e valor em `body`/`numeric`; o número
  protagonista em `display`/`displaySm` fica no vermelho da marca.
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
4. O texto fala como o Tino — ativo, concreto, sem culpa?
5. Se algo foi quitado ou melhorou, o verde aparece? A vitória está visível?
6. A tela encostou duas cores que ainda não estavam na lista de `scripts/paleta-check.mjs`? Se
   sim, o par entra lá **neste commit** — e `npm run palette:check` passa.

---

## 6. Identidade

A marca é o **wordmark** `devo.nada` em Archivo Black, caixa baixa, tracking −3%, com o ponto na
cor de status. O ícone do app é **só o ponto**.

Isso é o que faz a marca funcionar como marca e não como logotipo: o mesmo elemento que identifica
o produto reporta o estado do usuário. Ver ADR 0015 e a tabela de estados na seção 1.

Variações: principal (sobre grafite), invertida (sobre paper, para material impresso e social),
empilhada, e o ícone.

| PNG | Fonte versionada | Tamanho | O que é |
|---|---|---|---|
| `assets/icon.png` | `assets/icon.svg` | 1024² | o ponto a 62% da caixa, r = 317,44; sobra grafite em todo o perímetro depois do arredondamento do iOS |
| `assets/adaptive-icon.png` | `assets/adaptive-icon.svg` | 1024² | camada de frente do Android: ponto a 55% da caixa, r = 281,6 |
| `assets/splash.png` | `assets/splash.svg` | 1024² | o ponto sozinho a 15% da caixa, r = 76,8, sobre `#101216` |

**São três SVG e não um**, porque a única diferença entre eles é o raio, e raio escondido em
parâmetro de script é número que ninguém acha depois. Cada PNG tem a fonte ao lado.

O ponto é **vermelho** nos três: PNG não muda de cor, e o estado em que a pessoa chega ao app é
`divida` — a mesma escolha que `SplashDevoNada.tsx` já faz. O ícone alternativo por estado da rota
continua nice-to-have pós-MVP (seção 1).

Dois números que valem a pena estar escritos:

- **Android, os 55% — e o "72" que este documento errava.** A versão anterior desta tabela dizia
  "ponto a 72%, dentro da zona segura da máscara do Android", e a frase se contradizia: a janela
  garantida da máscara é a de **72dp de 108dp**, ou **66,7%** da caixa (682,67px aqui). O 72 era
  a medida em dp, e virou "72 por cento" em algum momento da escrita. A 72% da caixa o disco
  passava 27,3px ALÉM da janela por lado, e em launcher de máscara circular ele era recortado
  na borda: o grafite sumia e o ícone virava um círculo vermelho cheio.

  **O ponto precisa de moldura para ler como ponto.** No wordmark ele é pequeno em relação ao que
  está em volta, e é a proporção que faz dele um ponto em vez de um fundo — um disco que preenche
  o quadro inteiro tem presença, mas não é esta marca, e não se distingue de qualquer outro app de
  ícone vermelho. A 55% (r = 281,6) o disco fica 59,7px dentro da janela por lado, e sobra anel de
  grafite visível mesmo no recorte circular, que é o mais agressivo. O `icon.svg` do iOS desceu de
  512 para 317,44 (62%) pela mesma razão: tangente às bordas, depois do squircle sobrava um fiapo.
- **Os dois raios são decisão de marca, não de implementação.** Mexer neles muda o que a pessoa vê
  na grade do aparelho, e nenhum gate reprova quem mexer.
- **Splash, os 15%.** `app.json` declara `resizeMode: "contain"`, então em retrato a imagem
  quadrada é escalada pela largura: o ponto ocupa 15% da largura da tela, ~62dp num aparelho de
  411dp — exatamente o halo de 62dp que `SplashDevoNada.tsx` desenha atrás do ponto do wordmark.
  A splash nativa entrega para a do JS sem salto de tamanho.

### A rasterização é um comando, e ele mora aqui

```bash
npm run assets:build     # os três PNG, a partir dos três SVG
```

Chrome headless, porque a máquina não tem `rsvg-convert`, ImageMagick nem `sharp` — e nenhum
deles vale uma dependência npm para gerar três arquivos. O binário é **procurado** (Chrome,
Chromium, Brave, Edge, e `CHROME_PATH` na frente de todos), nunca cravado.

O que mudou não foi a ferramenta, foi o endereço: o script vivia **fora do repositório**, e essa
linha custou a marca inteira. O `icon.svg` anterior tinha fundo branco, traçado teal `#029488` e
círculo violeta `#7C3AED`; a ADR 0015 virou a paleta e nenhum desses hex sobreviveu — e os assets
ficaram como estavam, porque não havia comando para reclamar. É a mesma falha que a ADR 0018
descreve no validador de paleta, no mesmo mês.

Então o comando confere antes de rasterizar: cada hex dos SVG tem de ser um token de
`src/theme/theme.ts`, e da lista declarada da marca (`background` e `debt`). Cor fora dela não
vira PNG. Depois da captura ele lê o IHDR de volta — janela que não abriu no tamanho pedido
devolve imagem menor sem erro nenhum. `scripts/marca.test.js` exercita a mesma implementação sob
o jest, inclusive contra os arquivos versionados.

> **Nenhum gate prova que este ícone se distingue dos outros na grade do aparelho.** Que ele é o
> ponto certo, na cor certa e no tamanho certo, está medido; se ele é reconhecível ao lado de
> outros ícones vermelhos, e como a máscara de cada launcher o trata, é **validação em device** e
> não foi feita.
