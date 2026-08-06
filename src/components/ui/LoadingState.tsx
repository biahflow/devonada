import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  /** O que está carregando. Spinner mudo não informa nada. */
  label: string;
}

export function LoadingState({ label }: Props) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  label: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
});
