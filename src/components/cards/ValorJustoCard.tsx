import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import type { ValorJustoCardData } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { formatBRL } from '../../util/money';
import { Button } from '../ui/Button';

/**
 * Card assinatura do produto: pega o valor cobrado vs. o valor justo (calculado
 * no backend) e entrega a mensagem pronta pra negociar. O disclaimer no rodapé
 * é parte da postura "ferramenta educacional, não aconselhamento jurídico".
 *
 * `valorJusto` NÃO é estimativa (ADR 0008): é o cobrado menos a soma dos pontos
 * contestáveis, cada um com fonte legal própria. O card mostra o resultado; a
 * tela de revisão mostra achado por achado, com o trecho do contrato. Por isso
 * o card leva para lá — usando `dividaId`, campo tipado, nunca id extraído do
 * texto da mensagem (guardrail 7.3).
 */
export function ValorJustoCard({ data }: { data: ValorJustoCardData }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const economia = data.valorCobrado - data.valorJusto;

  async function copiarScript() {
    // O script virou blocos tipados por canal (M12). No chat o card mantém um
    // copiar único — junta os blocos na ordem em que se mandam. A leitura bloco
    // a bloco, com seletor de canal, mora na tela de revisão (ScriptCard).
    await Clipboard.setStringAsync(data.script.blocos.map((b) => b.texto).join('\n\n'));
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

      <Pressable
        onPress={() => router.push(`/dividas/${data.dividaId}/revisao`)}
        accessibilityRole="button"
        accessibilityLabel={`Ver ponto a ponto o que vale contestar na dívida com ${data.credor}`}
        style={styles.acao}
      >
        <Text style={styles.acaoTexto}>Ver ponto a ponto</Text>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </Pressable>

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
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // Alvo de toque de 48pt (guardrail de acessibilidade do DoD).
    minHeight: 48,
  },
  acaoTexto: { ...typography.caption, color: colors.primary },
  fundamentos: { gap: 2, marginTop: spacing.xs },
  fundamento: { ...typography.caption, color: colors.inkSoft },
  disclaimer: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
