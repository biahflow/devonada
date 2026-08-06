import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, eyebrow, description, action }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.texts}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  texts: { flex: 1, gap: spacing.xs },
  eyebrow: { ...typography.eyebrow, color: colors.primary, textTransform: 'uppercase' },
  title: { ...typography.display, color: colors.ink },
  description: { ...typography.caption, color: colors.inkSoft },
  action: { paddingTop: spacing.xs },
});
