import { Pressable, Text, StyleSheet } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Provedor = 'apple' | 'google';

interface Props {
  provedor: Provedor;
  label: string;
  onPress?: () => void;
  /** Sem handler o botão nasce inerte, e o `accessibilityState` diz isso. */
  disabled?: boolean;
}

/**
 * Apple e Google na tela de entrada.
 *
 * NÃO SAI DO `Button`, e por dois motivos concretos: `Button` aceita só
 * `label: string`, sem slot de ícone, e nenhum dos seus quatro `variant` é o par
 * da concepção — papel com texto grafite para a Apple, grafite-2 com borda para
 * o Google. Empurrar isso para dentro do `Button` acrescentaria uma variante que
 * só esta tela usa.
 *
 * ÍCONE EM `FontAwesome`, E ESTA É A ÚNICA EXCEÇÃO DO APP à família única de
 * ícones. `Feather` não tem as marcas da Apple e do Google — são logotipos, não
 * pictogramas, e nenhum conjunto geométrico os traz. Usar um `smartphone` no
 * lugar seria pior: o reconhecimento do botão social É o logotipo.
 *
 * HOJE OS DOIS NASCEM DESLIGADOS. Não existe Sign in with Apple nem Google
 * Sign-In no backend — o que há em `backend/` sobre Apple e Google é compra
 * in-app e exclusão de conta, coisa diferente. Enquanto for assim, o botão é
 * `disabled` de verdade (com `accessibilityState`, para o leitor de tela dizer o
 * mesmo que o olho vê) e quem explica é a legenda embaixo do par. Botão que
 * aceita o toque e não faz nada é pior que botão apagado.
 */
export function BotaoSocial({ provedor, label, onPress, disabled }: Props) {
  const inerte = disabled || !onPress;
  const claro = provedor === 'apple';

  return (
    <Pressable
      onPress={onPress}
      disabled={inerte}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inerte }}
      style={({ pressed }) => [
        styles.base,
        claro ? styles.claro : styles.escuro,
        inerte && styles.inerte,
        pressed && !inerte && styles.pressionado,
      ]}
    >
      <FontAwesome
        name={provedor}
        size={18}
        color={claro ? colors.background : colors.ink}
      />
      <Text style={[styles.label, claro ? styles.labelClaro : styles.labelEscuro]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    // 56pt: é CTA principal de tela, o mesmo piso do `Button size="lg"`.
    minHeight: 56,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  claro: { backgroundColor: colors.ink },
  escuro: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  inerte: { opacity: 0.45 },
  pressionado: { opacity: 0.85 },
  label: { ...typography.bodyStrong },
  labelClaro: { color: colors.background },
  labelEscuro: { color: colors.ink },
});
