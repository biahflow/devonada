import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Tone = 'info' | 'success' | 'warning' | 'error';

interface Props {
  message: string;
  tone?: Tone;
}

/**
 * `success` usa o violeta em vez de um verde próprio: qualquer verde de
 * confirmação ficava a ΔE 1,6 do teal de ação — a mesma cor, na prática.
 * Ver ADR 0011.
 */
const tones: Record<Tone, { bg: string; border: string; fg: string }> = {
  info: { bg: colors.primarySurface, border: colors.primarySoft, fg: colors.primaryDeep },
  success: { bg: colors.accentSurface, border: colors.accent, fg: colors.accent },
  warning: { bg: colors.warningSurface, border: colors.warningBorder, fg: colors.warning },
  error: { bg: colors.dangerSurface, border: colors.dangerBorder, fg: colors.dangerText },
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
