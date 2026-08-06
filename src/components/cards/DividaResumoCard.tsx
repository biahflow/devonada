import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import type { DividaResumoCardData } from '../../api/types';
import { CriticidadeBadge } from '../ui/Badge';
import { MoneyText } from '../ui/MoneyText';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { isoParaBR } from '../../util/date';

/**
 * Retrato de uma dívida dentro da conversa.
 *
 * Nenhum número é calculado aqui — todos vêm de campos que o backend preencheu
 * lendo o banco. O card é o PONTO DE ENTRADA para a tela de detalhe, não um
 * substituto dela: quem quiser agir vai para `dividas/[id]`.
 *
 * O deep link usa `data.dividaId`, um campo tipado. Nunca um id extraído do
 * texto da mensagem (guardrail 7.3).
 */
export function DividaResumoCard({ data }: { data: DividaResumoCardData }) {
  const router = useRouter();
  const quitada = data.situacao === 'quitada';

  return (
    <Pressable
      onPress={() => router.push(`/dividas/${data.dividaId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Abrir a dívida com ${data.credor}`}
      style={styles.card}
    >
      <View style={styles.topo}>
        <Text style={styles.credor} numberOfLines={1}>
          {data.credor}
        </Text>
        <CriticidadeBadge tipo={data.criticidade} />
      </View>

      <View style={styles.linha}>
        <Text style={styles.rotulo}>{quitada ? 'Quitada' : 'Saldo devedor'}</Text>
        {data.saldoDevedor === undefined || data.saldoDevedor === null ? (
          <Text style={styles.ausente}>ainda não calculado</Text>
        ) : (
          <MoneyText centavos={data.saldoDevedor} size="numeric" />
        )}
      </View>

      {data.proximoVencimento && !quitada ? (
        <Text style={styles.vencimento}>
          Próximo vencimento em {isoParaBR(data.proximoVencimento)}
        </Text>
      ) : null}

      <View style={styles.acao}>
        <Text style={styles.acaoTexto}>Ver a dívida</Text>
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
    gap: spacing.sm,
    // Alvo de toque confortável: o card inteiro é o botão.
    minHeight: 48,
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  credor: { ...typography.bodyStrong, color: colors.ink, flex: 1 },
  linha: { gap: 2 },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
  vencimento: { ...typography.caption, color: colors.inkSoft },
  acao: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  acaoTexto: { ...typography.caption, color: colors.primary },
});
