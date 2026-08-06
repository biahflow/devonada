/**
 * Tokens de design.
 *
 * Tese emocional do produto: reduzir ansiedade, não gerar alarme. Por isso o
 * primário é um verde sereno (fôlego / progresso) e não o vermelho dos apps
 * de finanças tradicionais. Vermelho existe só como `danger`, usado com muita
 * parcimônia. Fundo é um papel levemente esverdeado, deliberadamente diferente
 * do cream+terracota padrão.
 */
export const colors = {
  background: '#F3F5F2',
  surface: '#FFFFFF',

  ink: '#1B2B26',       // texto principal (verde-tinta profundo)
  inkSoft: '#5A6B64',   // texto secundário / legendas

  primary: '#2F6F5E',   // verde sereno = ação com calma
  primarySoft: '#DCEAE4',
  accent: '#C9A24B',    // dourado quente: progresso, economia

  userBubble: '#2F6F5E',
  userBubbleText: '#FFFFFF',
  assistantBubble: '#FFFFFF',

  border: '#E2E7E3',
  danger: '#A5493D',    // usar quase nunca; jamais como estética dominante
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const typography = {
  body: { fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
  caption: { fontSize: 13, lineHeight: 18 },
  numeric: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
} as const;
