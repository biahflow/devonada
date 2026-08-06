import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import type { PlanoSugeridoCardData } from '../../api/types';
import { MoneyText } from '../ui/MoneyText';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { formatMes } from '../../util/mes';

const NOMES = {
  avalanche: 'avalanche',
  bola_de_neve: 'bola de neve',
} as const;

/**
 * Plano de quitação dentro da conversa.
 *
 * Os números saem da MESMA simulação do M4 — o backend chama
 * `domain/simulacao.py`, e o app não refaz conta nenhuma. A data de liberdade
 * vai em `accent`, nunca em alarme: é o número emocional do produto
 * (`docs/domain.md`, seção 4).
 *
 * O card mostra uma estratégia; a comparação entre as duas mora no simulador,
 * para onde ele leva.
 */
export function PlanoSugeridoCard({ data }: { data: PlanoSugeridoCardData }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/dividas/simulador')}
      accessibilityRole="button"
      accessibilityLabel="Abrir o simulador de quitação"
      style={styles.card}
    >
      <Text style={styles.eyebrow}>Plano pela {NOMES[data.estrategia]}</Text>

      <Text style={styles.rotulo}>Data de liberdade</Text>
      <Text style={styles.liberdade}>{formatMes(data.dataLiberdade)}</Text>

      <View style={styles.linha}>
        <Text style={styles.rotulo}>Tempo</Text>
        <Text style={styles.valor}>
          {data.mesesAteQuitacao === 1 ? '1 mês' : `${data.mesesAteQuitacao} meses`}
        </Text>
      </View>

      {data.aporteExtraMensal > 0 ? (
        <View style={styles.linha}>
          <Text style={styles.rotulo}>Pagando a mais por mês</Text>
          <MoneyText centavos={data.aporteExtraMensal} size="body" />
        </View>
      ) : null}

      <View style={styles.linha}>
        <Text style={styles.rotulo}>Economia com o aporte</Text>
        {data.economia === undefined || data.economia === null ? (
          <Text style={styles.ausente}>ainda não calculado</Text>
        ) : (
          <MoneyText centavos={data.economia} size="body" tone="accent" />
        )}
      </View>

      <View style={styles.acao}>
        <Text style={styles.acaoTexto}>Comparar as duas estratégias</Text>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    minHeight: 48,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  liberdade: { ...typography.display, color: colors.accent, marginBottom: spacing.sm },
  linha: { gap: 2, marginTop: spacing.xs },
  valor: { ...typography.body, color: colors.ink },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
  acao: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  acaoTexto: { ...typography.caption, color: colors.primary },
});
