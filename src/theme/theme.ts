/**
 * Tokens de design do devo.nada. Fonte da verdade dos valores; o porquê está em
 * docs/design-system.md.
 *
 * Tese emocional do produto: a interface é CALMA e o vermelho é STATUS, nunca
 * cenário. O usuário chega ansioso — o fundo é grafite, e o vermelho aparece só
 * onde há dívida. A jornada do produto é vê-lo desaparecer. Verde é a única cor
 * que celebra, e é também a cor da ação: toda ação neste app é um passo para
 * fora da dívida. Ver ADR 0015.
 *
 * CONTRASTE — `npm run palette:check` mede os pares declarados em
 * `scripts/paleta-check.mjs` contra ESTE arquivo, em WCAG 2.1 e CIEDE2000, e
 * reprova o commit se algum par sem exceção cair abaixo do piso. Trocar um hex
 * aqui sem rodar o gate é o caminho conhecido para a medição envelhecer em
 * silêncio — foi o que aconteceu quando o validador vivia fora do repositório
 * (ADR 0018). A tabela vigente está em docs/design-system.md, seção 1.
 *
 * Os nomes dos tokens são os mesmos da paleta anterior de propósito: 75
 * arquivos os consomem e nenhum define cor própria (zero hex fora deste
 * arquivo). Trocar valor não custa nada; trocar nome custaria 75 diffs.
 */
export const colors = {
  background: '#101216', // fundo de tela (grafite)
  surface: '#181B21', // card, campo, bolha do buddy
  neutralSurface: '#1F232B', // input, trilha de barra, área recuada, avatar
  border: '#262A31', // divisor e — no escuro — a borda do próprio card

  ink: '#F2F2ED', // texto principal (paper)
  inkSoft: '#8A8F98', // texto secundário, label, metadado

  /**
   * Ação. Verde, porque a ação é sempre um passo para fora da dívida — e por
   * isso NÃO EXISTE BOTÃO VERMELHO neste app, nem para destruição (ali se usa
   * ghost + confirmação).
   */
  primary: '#1FC16B',
  primaryHover: '#17A559', // estado pressionado
  primaryBright: '#3FDC8A', // marca de gráfico. NUNCA como fundo de texto.
  primarySoft: '#2A6E4C', // anel de foco
  primarySurface: '#12251B', // badge, banner informativo, bolha do usuário
  primaryDeep: '#7CE8AF', // texto sobre `primarySurface`
  onPrimary: '#08120C',

  /**
   * Conquista, economia, marco. No tema anterior era violeta; aqui é verde,
   * porque no devo.nada verde é a única cor que celebra. Fica um passo mais
   * claro que `primary` de propósito: se conquista e botão fossem o mesmo
   * verde, a vitória sumiria dentro da barra de ação.
   */
  accent: '#3FDC8A',
  accentSurface: '#132A1F',

  warning: '#F0A31C', // acordo em andamento, atraso factual, sem alarme
  warningSurface: '#2A2010',
  warningBorder: '#4A3612',

  /**
   * Vermelho. Duas semânticas no mesmo valor, e isso é intencional:
   * `danger` (erro, ação destrutiva) e `debt` (status de dívida) — ver o par
   * abaixo. Regra dura: no máximo ~10% de qualquer tela, NUNCA como fundo de
   * tela, seção ou botão.
   *
   * REGRA DE USO, e ela é única para os dois nomes: `danger`/`debt` é o
   * vermelho de OBJETO GRÁFICO — ponto da marca, pill, barra, borda, número
   * protagonista em `display`/`displaySm`. Para TEXTO de corpo, legenda e
   * rótulo, use `dangerText`/`debtText`. O motivo está medido: `#E5352B` dá
   * 4,35 / 4,00 / 3,66 sobre `background` / `surface` / `neutralSurface`, e
   * o piso de texto é 4,5 (ADR 0018).
   */
  danger: '#E5352B',
  dangerSurface: '#2A1412',
  dangerBorder: '#4A1B17',
  /** Erro como TEXTO. Mesmo matiz e saturação de `danger`; ver `debtText`. */
  dangerText: '#EC6C65',

  /**
   * Status de dívida — o nome semântico que código novo deve usar. Aponta para
   * o mesmo valor de `danger` porque a marca só tem um vermelho; existe
   * separado para que a tela diga o que quer dizer: `debt` marca saldo devedor,
   * `danger` marca erro. Um dia um deles pode mudar de valor sem arrastar o
   * outro.
   */
  debt: '#E5352B',
  debtSurface: '#2A1412',
  debtBorder: '#5C201B', // borda do card de dívida crítica
  /**
   * Dívida como TEXTO. NÃO é um vermelho novo da marca: é `#E5352B` clareado
   * só até passar 4,5:1 com folga sobre as três superfícies, preservando matiz
   * e saturação até onde 8 bits permitem — H 3,23° → 3,11°, S 78,15% → 78,03%,
   * L 53,33% → 66,08%. Clarear foi a saída porque a alternativa — mudar o hex
   * de `debt` — mudaria o ponto do wordmark, que é a marca (ADR 0018).
   *
   * `dangerText` aponta para o mesmo valor pela mesma razão que `danger` e
   * `debt` apontam: um vermelho só. Existem os dois nomes para a tela dizer
   * qual dos dois quis dizer, e para que um possa mudar sem arrastar o outro.
   */
  debtText: '#EC6C65',

  /** Botão circular de enviar do chat. No escuro, quem se destaca é o verde. */
  inkFill: '#1FC16B',
} as const;

/**
 * Anel do ícone de categoria. É COR DE OBJETO GRÁFICO — no escuro precisa de
 * mais luminosidade que a versão clara para se manter legível sobre o grafite.
 * Ela nunca informa sozinha: o glifo e o rótulo ao lado carregam o significado.
 *
 * O verde ficou de fora de propósito: é cor semântica reservada (ação e
 * conquista), e cor reservada não vira "categoria 5". Mesma razão pela qual o
 * violeta ficava de fora na paleta anterior.
 *
 * Os quatro estão no `npm run palette:check`: cada um contra `background` e
 * `surface` no piso de 3:1, e os seis pares entre si em CIEDE2000. Foi essa
 * medição, na paleta clara, que derrubou coral e violeta.
 */
export const categoria = {
  teal: '#2DD4BF',
  azul: '#60A5FA',
  magenta: '#F472B6',
  ambar: '#FBBF24',
} as const;

export type CategoriaCor = keyof typeof categoria;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 16, xl: 24, pill: 999 } as const;

/**
 * Duas famílias, com papéis separados — ver docs/design-system.md, seção 3.
 *
 * Inter carrega todo o texto. Archivo Black carrega o wordmark e o número
 * protagonista de uma tela, e NADA MAIS: ela é display, e display em texto
 * corrido fica ilegível em tela pequena.
 *
 * POR QUE `numeric` NÃO É ARCHIVO BLACK, apesar de a marca dizer "valor
 * monetário sempre em Archivo Black": `numeric` é o número que aparece em
 * COLUNA — parcelas, lista de gastos, extrato. A paleta anterior escolheu
 * Nunito Sans por uma razão medida, não estética: os dígitos dela são de
 * largura fixa, e por isso uma coluna de reais não dança. `display` e
 * `displaySm` (o número único e grande de cada tela, onde não há coluna com que
 * se alinhar) usam Archivo Black; a coluna fica em Inter.
 *
 * MEDIDO EM 19/08/2026, `npm run digits:check` — e o resultado derrubou a
 * suposição de que isto era item de validação em aparelho. A largura de avanço
 * de um glifo está na tabela `hmtx` do TTF: é fato do arquivo, igual em todo
 * aparelho, e se lê sem device nenhum.
 *
 * Inter_700Bold, em 2048 unidades por em: o "1" avança 883 e o "4" avança
 * 1385 — amplitude de 502 unidades, 0,245 em, quase um quarto de quadratim.
 * O par que mais aparece junto é "0" (1381) contra "1" (883), 498 de diferença.
 * Numa coluna de reais a 18px isso são ~4,4px de dança por dígito "1" que entra
 * ou sai, e o extrato inteiro escorrega quando um valor vira R$ 1.000,00. Os dez
 * dígitos divergem entre si, e nenhum peso da Inter é tabular por padrão:
 * Regular, SemiBold e Bold têm amplitude 490, 498 e 502 respectivamente.
 *
 * ArchivoBlack_400Regular, por outro lado, JÁ é tabular: os dez dígitos avançam
 * 667 de 1000, amplitude zero. `display` e `displaySm` não precisam de nada.
 *
 * A correção está em `typography.numeric`, abaixo, e existe porque a Inter
 * DECLARA a feature `tnum` na `GSUB` — verificado na mesma leitura, junto de
 * `pnum` e `zero`. Pedir um recurso OpenType que a família não declara é o
 * caminho conhecido para o texto cair em fonte de sistema no Android; aqui não
 * é o caso, e é a medição que autoriza o pedido.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Wordmark e número protagonista. Nunca em texto corrido. */
  display: 'ArchivoBlack_400Regular',
} as const;

/**
 * Declarado fora do `as const` de propósito: dentro dele o array viraria
 * `readonly ['tabular-nums']`, e `TextStyle.fontVariant` do React Native pede
 * um array mutável. Fixar o tipo aqui resolve sem `any` e sem afrouxar o
 * `as const` do resto da escala.
 */
const digitosTabulares: 'tabular-nums'[] = ['tabular-nums'];

/**
 * Escala do devo.nada: o dinheiro é o protagonista visual, então o número
 * grande é maior e mais pesado que na paleta anterior. Archivo Black já é
 * densa — o tracking negativo do display é o que a impede de parecer inflada.
 */
export const typography = {
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.medium },
  title: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.bold, letterSpacing: -0.2 },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  /**
   * Número em COLUNA. Inter de propósito — ver a nota em `fontFamily`.
   *
   * `fontVariant` aqui não é preferência tipográfica: sem `tnum`, "1" avança
   * 883 e "0" avança 1381 na Inter_700Bold, e a coluna de reais escorrega a
   * cada dígito que troca. Com a feature, os dez passam a avançar igual.
   */
  numeric: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fontFamily.bold,
    fontVariant: digitosTabulares,
  },
  /** Número protagonista de uma tela. Saldo devedor, valor justo, economia. */
  display: { fontSize: 36, lineHeight: 42, fontFamily: fontFamily.display, letterSpacing: -1 },
  /** Número de destaque dentro de card menor, e título de tela. */
  displaySm: { fontSize: 26, lineHeight: 32, fontFamily: fontFamily.display, letterSpacing: -0.6 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.bold, letterSpacing: 1.6 },
} as const;

/**
 * No escuro, sombra não separa nada: preto sobre grafite é invisível. Quem
 * separa a superfície aqui é a COR (`background` → `surface` →
 * `neutralSurface`) mais a borda de `colors.border`.
 *
 * As chaves continuam existindo porque 75 arquivos as espalham em `...shadow.card`,
 * e um objeto vazio mantém esse spread válido sem custo. `elevation: 0` é
 * explícito: no Android a elevação desenha uma sombra própria, que no escuro
 * vira uma mancha suja em volta do card.
 *
 * A exceção declarada da marca — o glow verde da tela de vitória e dos marcos —
 * NÃO mora aqui: ela é celebração pontual, não hierarquia de superfície, e vive
 * na própria tela.
 */
export const shadow = {
  card: { elevation: 0 },
  soft: { elevation: 0 },
  float: { elevation: 0 },
} as const;
