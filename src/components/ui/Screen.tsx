import type { ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme/theme';

interface Props {
  children: ReactNode;
  /** Sem padding horizontal — para listas que sangram até a borda. */
  flush?: boolean;
  edges?: readonly Edge[];
  style?: ViewStyle;
}

/** Wrapper de toda rota: safe area, fundo e respiro horizontal padrão. */
export function Screen({ children, flush, edges = ['top'], style }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.content, !flush && styles.padded, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg },
});
