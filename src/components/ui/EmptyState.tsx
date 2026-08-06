import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../../theme/theme';

interface Props {
  title: string;
  /** Uma linha orientando o próximo passo. Vazio é oportunidade, não beco. */
  description: string;
  icon?: keyof typeof Feather.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  /** Caminho alternativo. Vazio nunca deve ter uma saída só. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyState({
  title,
  description,
  icon = 'inbox',
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.frame}>
        <View style={styles.iconCircle}>
          <Feather name={icon} size={24} color={colors.primary} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
        {actionLabel && onAction ? (
          <Button
            label={actionLabel}
            onPress={onAction}
            variant="secondary"
            style={styles.action}
          />
        ) : null}
        {secondaryLabel && onSecondary ? (
          <Button
            label={secondaryLabel}
            onPress={onSecondary}
            variant="ghost"
            style={styles.secondary}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  frame: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.title, color: colors.ink, textAlign: 'center' },
  description: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
  secondary: { alignSelf: 'stretch' },
});
