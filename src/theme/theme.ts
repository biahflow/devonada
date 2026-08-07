/**
 * Tokens de design. Fonte da verdade dos valores; o porquê está em
 * docs/design-system.md.
 *
 * Tese emocional do produto: reduzir ansiedade, não gerar alarme. A ação é um
 * teal sóbrio, a conquista é violeta e o vermelho existe só como `danger`, para
 * erro e ação destrutiva — jamais como estética de "você está devendo".
 *
 * Todo par texto/fundo daqui foi medido (WCAG 2.1, piso 4,5:1), todo anel de
 * categoria foi medido como objeto gráfico (piso 3:1) e toda dupla de semânticas
 * que pode aparecer lado a lado foi medida em CIEDE2000 (piso ΔE 15) antes de
 * virar código. A tabela está em docs/design-system.md, seção 1. Ver ADR 0011.
 */
export const colors = {
  background: '#F8FAFC', // fundo de tela
  surface: '#FFFFFF', // card, campo, bolha do assistente
  neutralSurface: '#F1F5F9', // badge neutro, bolha do assistente, área recuada
  border: '#E2E8F0', // divisor DENTRO de card; o card em si não tem borda

  ink: '#0F172A', // texto principal
  inkSoft: '#5C6B80', // texto secundário — passa 4,5:1 nas três superfícies

  primary: '#017A70', // ação: botão, link, aba ativa (branco por cima: 5,23:1)
  primaryHover: '#016258', // estado pressionado
  primaryBright: '#029488', // marca de gráfico — validada por script, ver 4b.
  //                           NUNCA como fundo de texto.
  primarySoft: '#99F6E4', // anel de foco
  primarySurface: '#F0FDFA', // badge, banner informativo, bolha do usuário
  primaryDeep: '#134E4A', // texto sobre `primarySurface`
  onPrimary: '#FFFFFF',

  /**
   * Conquista, economia, insight. Violeta, como no Budgi — 5,70:1 sobre branco,
   * então é texto direto, sem a acrobacia de pastilha que o lime exigia.
   */
  accent: '#7C3AED',
  accentSurface: '#F5F3FF',

  warning: '#B45309', // atraso e atenção factual, sem alarme
  warningSurface: '#FEF3C7',
  warningBorder: '#FDE68A',

  danger: '#B91C1C', // usar quase nunca; jamais como estética dominante
  dangerSurface: '#FEF2F2',
  dangerBorder: '#FECACA',

  /** Botão circular de enviar do chat — o único elemento escuro do app. */
  inkFill: '#18181B',
} as const;

/**
 * Anel do ícone de categoria. É COR DE OBJETO GRÁFICO, medida contra o piso de
 * 3:1, não contra o de texto — e ela nunca informa sozinha: o glifo e o rótulo
 * ao lado carregam o significado.
 *
 * São quatro matizes, não seis, e a razão é medida: o coral fica a ΔE 11,9 do
 * âmbar e o violeta a ΔE 12,4 do azul (OKLab, validador de dataviz). Dois anéis
 * que se confundem não acrescentam nada. Este conjunto passa separação de CVD
 * com folga — pior par ΔE 17,9 em deuteranopia.
 *
 * O violeta ficou de fora de propósito por um segundo motivo: ele é o `accent`
 * do sistema, e cor semântica reservada não vira "categoria 5".
 */
export const categoria = {
  teal: '#0D9488',
  azul: '#2563EB',
  magenta: '#BE185D',
  ambar: '#D97706',
} as const;

export type CategoriaCor = keyof typeof categoria;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 14, lg: 20, xl: 24, pill: 999 } as const;

/**
 * Nunito Sans, carregada em app/_layout.tsx. Com fontes customizadas o React
 * Native não deriva peso a partir de `fontWeight` de forma confiável entre
 * plataformas — cada peso é uma família própria.
 *
 * Ela foi escolhida por uma razão medida, não estética: **os dígitos já são de
 * largura fixa por padrão** (variação 0,00px entre 0 e 9). Isso dispensa
 * `fontVariant: ['tabular-nums']`, cujo suporte com fonte customizada é
 * justamente o que não dá para garantir entre iOS e Android. Figtree, a primeira
 * escolha, não tem `tnum` nem dígitos tabulares: o "1" mede 16,5px onde o "0"
 * mede 25,6px, e uma coluna de reais dançaria.
 */
export const fontFamily = {
  regular: 'NunitoSans_400Regular',
  medium: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
} as const;

/**
 * Escala do Budgi: números protagonistas moderados, não display gigante. O
 * tracking é quase neutro — a fonte é humanista, e apertar o espacejamento dela
 * desfaz o ar que é justamente a característica do reference.
 */
export const typography = {
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.medium },
  title: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.bold, letterSpacing: -0.2 },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  numeric: { fontSize: 18, lineHeight: 24, fontFamily: fontFamily.bold },
  /** Número protagonista de uma tela. */
  display: { fontSize: 32, lineHeight: 38, fontFamily: fontFamily.bold, letterSpacing: -0.5 },
  /** Número de destaque dentro de card menor, e título de tela. */
  displaySm: { fontSize: 26, lineHeight: 32, fontFamily: fontFamily.bold, letterSpacing: -0.4 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.bold, letterSpacing: 1.6 },
} as const;

/**
 * Sombra difusa e larga, sem borda: no Budgi quem separa a superfície é a
 * sombra, não uma linha. `elevation` cobre o Android e as propriedades `shadow*`
 * cobrem o iOS — sempre defina as duas.
 */
export const shadow = {
  card: {
    // Medido em aparelho: com 0,05 de opacidade o card SUMIA no fundo depois que
    // a borda saiu. Sem borda, a sombra é a única coisa que separa a superfície,
    // e precisa ser sutil sem ser invisível.
    shadowColor: '#0F172A',
    shadowOpacity: 0.09,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  soft: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
  /** Composer e botões flutuantes, que precisam se destacar da lista atrás. */
  float: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;
