import { View, Text, StyleSheet } from 'react-native';
import type { InfoCardData } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

export function InfoCard({ data }: { data: InfoCardData }) {
  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{data.titulo}</Text>
      <Text style={styles.corpo}>{data.corpo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  titulo: { ...typography.bodyStrong, color: colors.ink },
  corpo: { ...typography.body, color: colors.inkSoft },
});
