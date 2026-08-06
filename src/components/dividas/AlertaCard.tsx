import { View, Text, StyleSheet } from 'react-native';
import type { AlertaContrato } from '../../api/contratos';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * Cláusula que merece atenção.
 *
 * Postura obrigatória (guardrail 3): isto é SINAL PARA INVESTIGAR, nunca
 * afirmação de ilegalidade. A copy vinda do backend é curada nessa linha, e o
 * rodapé reforça. Mesma posição já adotada em `possivelPrescricao`.
 *
 * O trecho é texto puro — conteúdo de contrato é entrada não confiável.
 */
export function AlertaCard({ alerta }: { alerta: AlertaContrato }) {
  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{alerta.titulo}</Text>
      <Text style={styles.explicacao}>{alerta.explicacao}</Text>

      {alerta.trecho ? (
        <View style={styles.citacao}>
          <Text style={styles.trecho} selectable>
            {alerta.trecho}
          </Text>
          {alerta.pagina ? <Text style={styles.pagina}>página {alerta.pagina}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.rodape}>
        Vale conferir com quem entende. Isto é um sinal para investigar, não uma conclusão jurídica.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  titulo: { ...typography.bodyStrong, color: colors.warning },
  explicacao: { ...typography.caption, color: colors.ink, fontSize: 14, lineHeight: 20 },
  citacao: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    gap: 2,
  },
  trecho: { ...typography.caption, color: colors.inkSoft },
  pagina: { ...typography.caption, color: colors.inkSoft, fontSize: 11 },
  rodape: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
});
