import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { ValorJustoCardData } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { formatBRL } from '../../util/money';
import { Button } from '../ui/Button';

/**
 * Card assinatura do produto: pega o valor cobrado vs. o valor justo (calculado
 * no backend) e entrega a mensagem pronta pra negociar. O disclaimer no rodapé
 * é parte da postura "ferramenta educacional, não aconselhamento jurídico".
 */
export function ValorJustoCard({ data }: { data: ValorJustoCardData }) {
  const [copiado, setCopiado] = useState(false);
  const economia = data.valorCobrado - data.valorJusto;

  async function copiarScript() {
    await Clipboard.setStringAsync(data.script);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Valor justo estimado · {data.credor}</Text>

      <View style={styles.comparativo}>
        <View style={styles.coluna}>
          <Text style={styles.legenda}>Cobrado</Text>
          <Text style={styles.cobrado}>{formatBRL(data.valorCobrado)}</Text>
        </View>
        <Text style={styles.seta}>→</Text>
        <View style={styles.coluna}>
          <Text style={styles.legenda}>Justo</Text>
          <Text style={styles.justo}>{formatBRL(data.valorJusto)}</Text>
        </View>
      </View>

      {economia > 0 && (
        <Text style={styles.economia}>
          Dá pra economizar {formatBRL(economia)} nesta negociação.
        </Text>
      )}

      {data.fundamentos && data.fundamentos.length > 0 && (
        <View style={styles.fundamentos}>
          {data.fundamentos.map((f, i) => (
            <Text key={i} style={styles.fundamento}>
              • {f}
            </Text>
          ))}
        </View>
      )}

      <Button
        label={copiado ? 'Copiado ✓' : 'Copiar mensagem de negociação'}
        onPress={copiarScript}
        style={{ marginTop: spacing.sm }}
      />

      <Text style={styles.disclaimer}>Estimativa educacional. Não é aconselhamento jurídico.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparativo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  coluna: { gap: 2 },
  legenda: { ...typography.caption, color: colors.inkSoft },
  cobrado: { ...typography.numeric, color: colors.inkSoft, textDecorationLine: 'line-through' },
  justo: { ...typography.numeric, color: colors.primary },
  seta: { ...typography.title, color: colors.inkSoft, paddingHorizontal: spacing.sm },
  economia: {
    ...typography.bodyStrong,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  fundamentos: { gap: 2, marginTop: spacing.xs },
  fundamento: { ...typography.caption, color: colors.inkSoft },
  disclaimer: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
