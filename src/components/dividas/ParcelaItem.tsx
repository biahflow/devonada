import { View, Text, StyleSheet } from 'react-native';
import type { Parcela } from '../../api/types';
import { Button } from '../ui/Button';
import { MoneyText } from '../ui/MoneyText';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { isoParaBR } from '../../util/date';

interface Props {
  parcela: Parcela;
  onPagar: () => void;
  pagando?: boolean;
}

/**
 * Uma linha do carnê.
 *
 * Cor por situação segue o guardrail 4: paga em `accent`, porque é conquista;
 * atrasada em `warning`, NUNCA em `danger`. Atraso é fato de calendário, não
 * erro do usuário — e este app não existe para soar como o credor dele.
 */
export function ParcelaItem({ parcela, onPagar, pagando }: Props) {
  const paga = parcela.situacao === 'paga';
  const atrasada = parcela.situacao === 'atrasada';

  return (
    <View style={[styles.card, paga && styles.cardPaga]}>
      <View style={styles.linha}>
        <View style={styles.info}>
          <Text style={styles.numero}>
            Parcela {parcela.numero} de {parcela.total}
          </Text>
          <Text style={atrasada ? styles.atrasada : styles.data}>
            {atrasada ? 'atrasada · ' : ''}
            {isoParaBR(parcela.vencimento)}
          </Text>
        </View>
        <MoneyText centavos={parcela.valor} size="body" tone={paga ? 'inkSoft' : 'ink'} />
      </View>

      {paga ? (
        <Text style={styles.paga}>Paga em {isoParaBR(parcela.pagoEm ?? undefined)}</Text>
      ) : (
        <Button
          label="Marcar como paga"
          onPress={onPagar}
          variant="secondary"
          loading={pagando}
          accessibilityHint={`Parcela ${parcela.numero} de ${parcela.total}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardPaga: { backgroundColor: colors.background, borderColor: colors.accent, borderWidth: 2 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { gap: 2, flex: 1 },
  numero: { ...typography.bodyStrong, color: colors.ink },
  data: { ...typography.caption, color: colors.inkSoft },
  atrasada: { ...typography.caption, color: colors.warning },
  paga: { ...typography.caption, color: colors.accent },
});
