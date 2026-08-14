import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../theme/theme';

interface Props {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * Superfície elevada sobre o grafite. **Com borda**, e a razão inverteu com o
 * tema: no claro quem separava o card do fundo era a sombra difusa, e a borda
 * denunciava o desenho antigo. No escuro a sombra é invisível — preto sobre
 * grafite não separa nada —, então quem carrega a hierarquia é a cor da
 * superfície mais esta linha de 1px. Ver theme.ts, `shadow`.
 */
export function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },
});
