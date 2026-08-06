import type { ReactNode } from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  /** Mostrado quando não há erro. Nunca os dois ao mesmo tempo. */
  hint?: string;
  optional?: boolean;
  /** Substitui o TextInput padrão — usado pelo CurrencyInput e por seletores. */
  children?: ReactNode;
}

export function FormField({ label, error, hint, optional, children, ...input }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional ? <Text style={styles.optional}>Opcional</Text> : null}
      </View>

      {children ?? (
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.inkSoft}
          style={[styles.input, !!error && styles.inputError]}
          {...input}
        />
      )}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  input: {
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...typography.bodyStrong, color: colors.ink },
  optional: { ...typography.caption, color: colors.inkSoft },
  input: fieldStyles.input,
  inputError: { borderColor: colors.danger },
  error: { ...typography.caption, color: colors.danger },
  hint: { ...typography.caption, color: colors.inkSoft },
});
