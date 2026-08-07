import { Text, StyleSheet, type TextStyle } from 'react-native';
import { colors, typography } from '../../theme/theme';
import { formatBRL } from '../../util/money';

type Size = 'body' | 'numeric' | 'display';
type Tone = 'ink' | 'inkSoft' | 'accent' | 'onPrimary' | 'warning';

interface Props {
  /** Valor em CENTAVOS inteiros. Nunca reais, nunca float. */
  centavos: number;
  size?: Size;
  tone?: Tone;
  /** Risca o valor — usado para "cobrado" ao lado do "justo". */
  strikethrough?: boolean;
  style?: TextStyle;
}

const sizes: Record<Size, TextStyle> = {
  body: typography.body,
  numeric: typography.numeric,
  display: typography.display,
};

const tones: Record<Tone, string> = {
  ink: colors.ink,
  inkSoft: colors.inkSoft,
  accent: colors.accent,
  onPrimary: colors.onPrimary,
  // Para valor negativo que o usuário precisa notar — capacidade que não fecha.
  // `warning`, nunca `danger`: quem chega nesse número já está com medo, e o
  // vermelho de alarme é o que os apps tradicionais fazem (guardrail 4).
  warning: colors.warning,
};

/**
 * Única superfície de exibição de dinheiro. Centraliza `formatBRL` e os
 * tabular-nums para que uma mudança de formatação aconteça num arquivo só.
 */
export function MoneyText({
  centavos,
  size = 'numeric',
  tone = 'ink',
  strikethrough,
  style,
}: Props) {
  return (
    <Text
      style={[
        sizes[size],
        styles.tabular,
        { color: tones[tone] },
        strikethrough && styles.strike,
        style,
      ]}
    >
      {formatBRL(centavos)}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  strike: { textDecorationLine: 'line-through' },
});
