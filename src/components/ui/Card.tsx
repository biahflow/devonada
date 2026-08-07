import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme/theme';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * Superfície branca flutuando sobre o fundo. **Sem borda** — quem separa o card
 * do fundo é a sombra difusa, não uma linha. É a assinatura do reference, e a
 * borda de 1px que existia aqui era o que mais denunciava o desenho anterior.
 */
export function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
});
