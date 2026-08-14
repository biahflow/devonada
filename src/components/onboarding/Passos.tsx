import { View, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius, spacing } from '../../theme/theme';

const TOTAL = 3;

interface Props {
  atual: 1 | 2 | 3;
  /**
   * A seta de voltar do onboarding.
   *
   * Vive aqui, e não num `PageHeader`, porque as telas do onboarding não usam
   * `PageHeader` — o título delas é uma chamada de impacto em `typography.display`
   * de 28pt, não um cabeçalho de seção. O `Passos` é o elemento mais alto das
   * três, então é ele que carrega a saída.
   *
   * O passo 1 não recebe: é o destino do `<Redirect>` de `app/_layout.tsx` e não
   * há para onde voltar. No passo 2 ela recua um item da fila, ou sai para o
   * passo 1 quando a fila está no começo.
   */
  onVoltar?: () => void;
}

/**
 * Os três traços do topo do onboarding.
 *
 * Existem para responder "quanto falta?" antes de a pessoa perguntar. Quem está
 * endividado e com medo abandona formulário sem fim — saber que são três passos
 * é o que faz o segundo parecer valer a pena.
 */
export function Passos({ atual, onVoltar }: Props) {
  return (
    <View style={styles.faixa}>
      {onVoltar ? (
        <Pressable
          onPress={onVoltar}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}
        >
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </Pressable>
      ) : null}

      <View style={styles.linha} accessibilityLabel={`Passo ${atual} de ${TOTAL}`}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <View key={i} style={[styles.traco, i < atual && styles.feito]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  voltar: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    // Cancela o `paddingHorizontal` do `Screen`, como no `PageHeader`.
    marginLeft: -spacing.lg,
  },
  pressionado: { opacity: 0.6 },
  linha: { flexDirection: 'row', gap: spacing.xs, flex: 1 },
  traco: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSurface,
  },
  feito: { backgroundColor: colors.primary },
});
