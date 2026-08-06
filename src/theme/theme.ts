/**
 * Tokens de design. Fonte da verdade dos valores; o porquê está em
 * docs/design-system.md.
 *
 * Tese emocional do produto: reduzir ansiedade, não gerar alarme. O primário é
 * um verde pine (fôlego / progresso) e o acento é dourado — a cor da economia e
 * do avanço. Vermelho existe só como `danger`, para erro e ação destrutiva;
 * jamais como estética de "você está devendo". Ver ADR 0004.
 */
export const colors = {
  background: '#F3F5F2',
  surface: '#FFFFFF',

  ink: '#17201C', // texto principal (quase preto esverdeado)
  inkSoft: '#5A6B64', // texto secundário / legendas

  primary: '#1F6045', // pine-600 — ação principal
  primaryHover: '#194D39', // pine-700 — estado pressionado
  primarySoft: '#D6EEE2', // pine-100 — anel de foco, superfície suave
  primarySurface: '#EDF7F2', // pine-50 — badge, fundo de ícone ativo
  primaryDeep: '#123126', // pine-900 — painel escuro, texto sobre pine-50
  onPrimary: '#FFFFFF', // texto/ícone sobre superfície primária

  accent: '#C9A24B', // dourado — progresso, economia, liberdade
  accentSoft: '#F7EFD9',

  border: '#E2E7E3',
  neutralSurface: '#EEF1EE', // badge neutro

  success: '#2F6F5E',
  warning: '#B07D2B', // atraso e atenção factual, sem alarme
  danger: '#A5493D', // usar quase nunca; jamais como estética dominante
  dangerSurface: '#FBEAE6', // fundo suave de erro e de "juros altos"
  dangerBorder: '#F0C9C1',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

/**
 * Inter, carregada em app/_layout.tsx. Com fontes customizadas o React Native
 * não deriva peso a partir de `fontWeight` de forma confiável entre plataformas
 * — cada peso é uma família própria.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: fontFamily.medium },
  title: { fontSize: 20, lineHeight: 28, fontFamily: fontFamily.bold, letterSpacing: -0.4 },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  numeric: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.bold },
  display: { fontSize: 28, lineHeight: 34, fontFamily: fontFamily.bold, letterSpacing: -0.8 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.bold, letterSpacing: 1.6 },
} as const;

/**
 * Sombras suaves, nunca duras. `elevation` cobre o Android e as propriedades
 * `shadow*` cobrem o iOS — sempre defina as duas.
 */
export const shadow = {
  card: {
    shadowColor: '#16281F',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  soft: {
    shadowColor: '#16281F',
    shadowOpacity: 0.06,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;
