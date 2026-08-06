# Design System — Buddy Financeiro (React Native)

> Documento vivo. Fonte da verdade dos tokens: `src/theme/theme.ts`. Este documento explica o
> **porquê** e cataloga os componentes; o arquivo de tema carrega os valores.
> Alvo: **Expo / React Native, mobile nativo**. Não há versão web.

Tema **claro sempre**, minimalista e arejado. Verde pine como primário, dourado como acento,
fundo de papel levemente esverdeado. Cards muito arredondados com sombra suave.

---

## 1. Paleta

Herda a estrutura do design system Biahflow / OikOS, com uma divergência deliberada no acento.
Ver ADR 0004.

| Token | Hex | Uso |
|---|---|---|
| `ink` | `#17201C` | texto principal (quase preto esverdeado) |
| `inkSoft` | `#5A6B64` | texto secundário, legendas, unidades |
| `background` | `#F3F5F2` | fundo de tela |
| `surface` | `#FFFFFF` | cards, campos, bolha do assistente |
| `primary` | `#1F6045` | **primário**: botões, links, ativo de aba (pine-600) |
| `primaryHover` | `#194D39` | estado pressionado do primário (pine-700) |
| `primarySoft` | `#D6EEE2` | superfícies verdes suaves, anel de foco (pine-100) |
| `primarySurface` | `#EDF7F2` | badge e fundo de ícone ativo (pine-50) |
| `primaryDeep` | `#123126` | painel escuro, header de destaque (pine-900) |
| `onPrimary` | `#FFFFFF` | texto e ícone sobre superfície primária |
| `accent` | `#C9A24B` | **acento**: progresso, economia, data de liberdade |
| `accentSoft` | `#F7EFD9` | fundo de badge de conquista |
| `border` | `#E2E7E3` | bordas de card e campo |
| `neutralSurface` | `#EEF1EE` | badge neutro |
| `danger` | `#A5493D` | erro e ação destrutiva — **e nada além disso** |
| `dangerSurface` | `#FBEAE6` | fundo suave de erro e de "juros altos" |
| `dangerBorder` | `#F0C9C1` | borda do banner de erro |
| `warning` | `#B07D2B` | atraso, atenção factual, sem alarme |
| `success` | `#2F6F5E` | confirmação (o verde sereno original) |

**Regra de uso do vermelho.** `danger` não é a cor de "você está devendo". Saldo devedor é
`ink`. Parcela atrasada é `warning`, não `danger`. Ver `guardrails.md`, seção 4.

**Regra de uso do dourado.** `accent` marca progresso e ganho: parcela quitada, economia obtida,
meses a menos, data de liberdade. É a cor da recompensa, usada com parcimônia — se tudo é
dourado, nada é.

---

## 2. Escalas

Já existem em `src/theme/theme.ts` e não mudam:

```ts
spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
radius  = { sm: 8, md: 14, lg: 20, pill: 999 }
```

Aplicação: **card `radius.lg`**, **controle e botão `radius.md`**, **badge `radius.pill`**,
**banner de feedback `radius.md`**.

### Sombras

Tailwind não existe aqui; a sombra suave do Biahflow vira estes objetos, a acrescentar em
`theme.ts` em M0:

```ts
shadow = {
  card: {
    shadowColor: '#16281F', shadowOpacity: 0.08, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  soft: {
    shadowColor: '#16281F', shadowOpacity: 0.06, shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 }, elevation: 6,
  },
}
```

`elevation` cobre o Android; as propriedades `shadow*` cobrem o iOS. Sempre defina os dois.
Nunca use sombra dura ou borda grossa para separar superfícies.

---

## 3. Tipografia

**Inter**, carregada via `@expo-google-fonts/inter` em `app/_layout.tsx`. Se a fonte falhar, o
app sobe mesmo assim com a fonte de sistema — segurar a splash para sempre seria pior.

Com fontes customizadas o React Native **não deriva peso a partir de `fontWeight`** de forma
confiável entre plataformas. Por isso cada peso é uma família própria, exposta em `fontFamily`:

```ts
fontFamily = {
  regular: 'Inter_400Regular',
  medium:  'Inter_600SemiBold',
  bold:    'Inter_700Bold',
}
```

A escala de `theme.ts` usa essas famílias no lugar de `fontWeight`, e ganha `display` e
`eyebrow`. `numeric` e `MoneyText` aplicam `fontVariant: ['tabular-nums']` para os dígitos não
dançarem entre linhas numa coluna de valores.

- `display` é o número grande do painel e do simulador. Tracking negativo, como no Biahflow.
- `eyebrow` é o rótulo acima do título, em maiúsculas e `primary`. O `textTransform:
  'uppercase'` fica no componente, não no texto da string — a copy segue legível no código.
- `numeric` é para valor monetário em linha, sempre via `MoneyText`.

---

## 4. Componentes

`src/components/ui/`. Um componente aqui **não importa de `src/api/`** — recebe dado por prop.

### `Button`

`variant: 'primary' | 'secondary' | 'danger' | 'ghost'`, `loading`, `disabled`, `minHeight: 48`.

| Variante | Fundo | Texto | Uso |
|---|---|---|---|
| `primary` | `primary` | branco | ação principal da tela, uma por tela |
| `secondary` | `surface` com borda `primarySoft` | `primary` | ação alternativa |
| `danger` | `danger` | branco | excluir, apagar — sempre com confirmação |
| `ghost` | transparente | `inkSoft` | ação terciária, cancelar |

### Demais componentes

**`Screen`** — wrapper de tela: `SafeAreaView` do `react-native-safe-area-context`, fundo
`background`, padding horizontal `spacing.lg` (removível com `flush` para listas que sangram
até a borda). Toda rota começa por ele.

**`PageHeader`** — `eyebrow` opcional + título (`title` ou `display`) + descrição em `inkSoft`
+ slot de ação à direita. Cabeçalho de toda tela que não é o chat.

**`Card`** — superfície `surface`, `radius.lg`, borda `border`, `shadow.card`, padding
`spacing.lg`. Base de todo agrupamento de conteúdo.

**`FormField`** — label `bodyStrong` em `ink`, campo com borda `border` (foco: borda `primary`
+ anel `primarySoft`), `minHeight: 48`, e abaixo ou a mensagem de erro em `danger` ou a dica em
`caption`/`inkSoft`. Nunca as duas. Marcador "Opcional" à direita do label quando aplicável.

**`CurrencyInput`** — entrada de dinheiro. **Mantém o estado em centavos inteiros**; o usuário
digita da direita para a esquerda e a máscara formata com `formatBRL`. Nunca `parseFloat`,
nunca estado em string com vírgula. `keyboardType="number-pad"`. É o componente que impede a
classe inteira de bug descrita em `guardrails.md`, seção 1.1.

**`Feedback`** — banner `radius.md`, quatro tons: `info` (`primarySurface` / `primaryDeep`),
`success` (`success`), `warning` (`warning`), `error` (`danger`). Sempre com
`accessibilityRole="alert"` no erro e `accessibilityLiveRegion="polite"` nos demais.

**`LoadingState`** — `ActivityIndicator` na cor `primary` + texto curto do que está carregando.
Nunca um spinner mudo no meio da tela.

**`EmptyState`** — moldura tracejada `border`, ícone em círculo `primarySurface`, título,
uma linha de explicação e um botão de ação. Vazio é oportunidade de orientar, não um beco.

**`ErrorState`** — mensagem do `ApiError` + botão "Tentar de novo". Distingue `status === 0`
(sem conexão) de falha do servidor na copy.

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

**`CampoRevisao`** (`dividas/`) — campo proposto por extração de contrato, com `Badge` de
confiança e o trecho citado. Sem trecho, **não exibe valor**: número sem evidência é palpite do
modelo. O trecho é texto puro, nunca marcação — conteúdo de documento é entrada não confiável.

**`AlertaCard`** (`dividas/`) — cláusula que merece atenção, em `accentSoft`. Copy de
investigação e rodapé explícito de que não é conclusão jurídica.

**`Badge`** — pílula `radius.pill`. Variante de criticidade mapeia `CriticidadeTipo`:

| `tipo` | Fundo | Texto | Rótulo |
|---|---|---|---|
| `essencial` | `primarySurface` | `primaryDeep` | Essencial |
| `com_garantia` | `accentSoft` | `warning` | Com garantia |
| `juros_abusivos` | `#FBEAE6` | `danger` | Juros altos |
| `consumo` | `#EEF1EE` | `inkSoft` | Consumo |

`juros_abusivos` é a **única** situação em que a família do vermelho aparece fora de erro — e
ainda assim num tom suave de fundo, porque é uma classificação factual de custo, não uma
repreensão.

**`MoneyText`** — exibe centavos via `formatBRL`, com `tabular-nums`. Props `size`
(`body | numeric | display`) e `tone` (`ink | accent | inkSoft`). Centraliza a exibição de
dinheiro num componente só — se um dia a formatação mudar, muda em um lugar.

---

## 5. Regras

- **Tema claro sempre.** Não há dark mode e não há `useColorScheme`. `app.json` já fixa
  `userInterfaceStyle: "light"`.
- **Alvo de toque mínimo 48pt** em qualquer elemento tocável. Vale para ícone, chip e link.
- **`accessibilityLabel` obrigatório** em todo controle sem texto visível.
  `accessibilityRole` correto em botão, link e cabeçalho.
- **Contraste mínimo 4.5:1** para texto de corpo. `inkSoft` sobre `surface` passa; `inkSoft`
  sobre `primarySoft` não — não combine os dois.
- **Nada de animação de urgência.** Sem pulsar, sem contagem regressiva, sem shake. Transições
  são suaves e curtas; respeite `AccessibilityInfo.isReduceMotionEnabled`.
- **Copy em pt-BR**, segunda pessoa, específica e sem julgamento. "Faltam 7 parcelas", não
  "Atenção: dívida em aberto".
- **Ícones:** `@expo/vector-icons` (Feather), traço fino, tamanho 20 ou 24. Ícone nunca carrega
  significado sozinho — sempre acompanha texto ou `accessibilityLabel`.

---

## 6. Relação com o design system Biahflow / OikOS

Este app **não pertence** ao ecossistema Biahflow, mas compartilha a linguagem visual: pine como
primário, superfícies brancas sobre papel, cards muito arredondados, sombras suaves, Inter com
tracking negativo, eyebrow acima do título.

A divergência é o acento: onde o Biahflow usa clay `#C66C3E`, aqui é o dourado `#C9A24B`, porque
neste produto o acento carrega a semântica de **economia e progresso financeiro** — e laranja,
num app de dívida, lê como alerta. Ver ADR 0004.

Ao portar um padrão do Biahflow que não esteja aqui: traga o **visual**, não o mecanismo. Aquele
design system é Tailwind v4 em web; aqui é `StyleSheet` em React Native. Reescreva a marcação,
preserve a proporção e a cor.
