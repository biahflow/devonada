import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/theme';

export interface Option<T extends string> {
  value: T;
  label: string;
  /** Uma linha explicando a escolha. Some quando a opção não está selecionada. */
  description?: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T | undefined;
  onChangeValue: (value: T) => void;
  error?: string;
}

export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChangeValue,
  error,
}: Props<T>) {
  const selecionada = options.find((o) => o.value === value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((option) => {
          const ativo = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChangeValue(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              style={({ pressed }) => [
                styles.chip,
                ativo && styles.chipAtivo,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipLabel, ativo && styles.chipLabelAtivo]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : selecionada?.description ? (
        <Text style={styles.description}>{selecionada.description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.bodyStrong, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  chipAtivo: { backgroundColor: colors.primarySurface, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  chipLabel: { ...typography.body, color: colors.inkSoft },
  chipLabelAtivo: { ...typography.bodyStrong, color: colors.primaryDeep },
  description: { ...typography.caption, color: colors.inkSoft },
  error: { ...typography.caption, color: colors.dangerText },
});
