import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/theme';

/** O "ou" entre o login social e o e-mail. Duas telas usam, então mora aqui. */
export function Divisor({ label = 'ou' }: { label?: string }) {
  return (
    <View style={styles.linha}>
      <View style={styles.traco} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.traco} />
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  traco: { flex: 1, height: 1, backgroundColor: colors.border },
  label: { ...typography.caption, color: colors.inkSoft },
});
