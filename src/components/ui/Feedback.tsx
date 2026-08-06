import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Tone = 'info' | 'success' | 'warning' | 'error';

interface Props {
  message: string;
  tone?: Tone;
}

const tones: Record<Tone, { bg: string; border: string; fg: string }> = {
  info: { bg: colors.primarySurface, border: colors.primarySoft, fg: colors.primaryDeep },
  success: { bg: colors.primarySurface, border: colors.primarySoft, fg: colors.success },
  warning: { bg: colors.accentSoft, border: colors.accent, fg: colors.warning },
  error: { bg: colors.dangerSurface, border: colors.dangerBorder, fg: colors.danger },
};

export function Feedback({ message, tone = 'info' }: Props) {
  const { bg, border, fg } = tones[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: bg, borderColor: border }]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
    >
      <Text style={[styles.text, { color: fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  text: { ...typography.caption, fontSize: 14, lineHeight: 20 },
});
