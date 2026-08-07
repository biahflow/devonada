import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  /** Cabeçalho do período: "Sexta, dia 15", "Novembro de 2026". */
  periodo: string;
  /** Rótulo do rodapé. Sem ele, o grupo não fecha com total. */
  totalRotulo?: string;
  /** Passe um `MoneyText` — esta camada não formata dinheiro. */
  total?: ReactNode;
  children: ReactNode;
}

/**
 * Card com cabeçalho de período, linhas e rodapé de total — como o extrato do
 * reference agrupa por dia.
 *
 * O rodapé é opcional porque nem toda lista soma: um cronograma de parcelas
 * fecha com total, uma lista de dívidas por criticidade não.
 */
export function GrupoDeLista({ periodo, totalRotulo, total, children }: Props) {
  return (
    <Card>
      <Text style={styles.periodo} accessibilityRole="header">
        {periodo}
      </Text>

      <View style={styles.linhas}>{children}</View>

      {total !== undefined ? (
        <View style={styles.rodape}>
          <Text style={styles.totalRotulo}>{totalRotulo ?? 'Total'}</Text>
          {total}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  periodo: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.xs },
  linhas: { gap: 0 },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  totalRotulo: { ...typography.bodyStrong, color: colors.ink },
});
