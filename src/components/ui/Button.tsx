import { Pressable, Text, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** `lg` é o CTA principal de uma tela. `md` (48pt) segue sendo o piso. */
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

/**
 * `danger` NÃO tem fundo vermelho, e isso é regra de marca, não descuido: neste
 * app não existe botão vermelho, nem para ação destrutiva (ADR 0015). O
 * vermelho aqui aparece só no texto e na borda, e quem carrega o peso da ação
 * irreversível é a confirmação — um diálogo dedicado —, não a cor do botão.
 *
 * Modo de falha que isso previne: uma tela cheia de vermelho vista por alguém
 * que já está com medo do próprio extrato. O vermelho é o status da dívida, e
 * gastá-lo num botão de "excluir" tira dele o significado que a marca inteira
 * depende que ele tenha.
 */
const container: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primarySoft },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.dangerBorder },
  ghost: { backgroundColor: 'transparent' },
};

const labelColor: Record<Variant, string> = {
  primary: colors.onPrimary,
  secondary: colors.primary,
  danger: colors.dangerText,
  ghost: colors.inkSoft,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  accessibilityHint,
}: Props) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      // Explícito, e não herdado do texto: em `loading` o rótulo é substituído
      // pelo spinner, e sem isto o botão fica sem nome nenhum para o leitor de
      // tela justamente no instante em que a pessoa espera saber o que está
      // acontecendo.
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.lg,
        container[variant],
        inactive && styles.inactive,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant]} />
      ) : (
        <Text
          // `numberOfLines={1}`: sem ele o Android quebra o rótulo em duas linhas
          // e a segunda é cortada pela altura do botão — a palavra some SEM
          // NENHUM SINAL. Visto em device: "Voltar ao painel" virava "Voltar ao".
          // Com reticências o problema fica visível, que é o mínimo aceitável.
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.label, size === 'lg' && styles.labelLg, { color: labelColor[variant] }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  lg: { minHeight: 56, paddingHorizontal: spacing.xl },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  label: { ...typography.bodyStrong },
  labelLg: { fontSize: 17 },
});
