import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  title: string;
  /**
   * Palavra átona antes do título, em peso regular: "Suas **dívidas**".
   * É a assinatura tipográfica do reference — o peso misto na mesma linha faz o
   * cabeçalho falar em vez de rotular. Prefira isto ao `eyebrow`.
   */
  titleLead?: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, titleLead, eyebrow, description, action }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.texts}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} accessibilityRole="header">
          {titleLead ? <Text style={styles.lead}>{titleLead} </Text> : null}
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  texts: { flex: 1, gap: spacing.xs },
  eyebrow: { ...typography.eyebrow, color: colors.primary, textTransform: 'uppercase' },
  title: { ...typography.displaySm, color: colors.ink },
  lead: { fontFamily: typography.body.fontFamily },
  description: { ...typography.caption, color: colors.inkSoft },
  action: { paddingTop: spacing.xs },
});
