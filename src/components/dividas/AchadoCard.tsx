import { View, Text, StyleSheet } from 'react-native';
import type { Achado } from '../../api/types';
import { MoneyText } from '../ui/MoneyText';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * Um ponto do contrato que vale contestar (M6).
 *
 * Postura obrigatória (guardrail 3): é CONVITE A INVESTIGAR, nunca sentença.
 * Toda a copy — título, explicação, fonte, como conferir — vem curada do
 * backend, e este componente não a reescreve nem a resume: reescrever aqui
 * abriria o caminho para uma afirmação que a fonte não sustenta.
 *
 * `warning` e nunca `danger`: o assunto já assusta sozinho (guardrail 4).
 *
 * Achado SEM `valorContestavel` não é rodapé nem nota de pé de página — é irmão
 * visual dos outros. Ele não soma no `valorJusto` porque quantificá-lo exigiria
 * reamortizar o contrato (ADR 0008), o que não o torna menos relevante para
 * quem vai negociar.
 *
 * `evidencia` é texto de contrato — entrada não confiável, renderizada como
 * texto puro e selecionável para a pessoa copiar.
 */
export function AchadoCard({ achado }: { achado: Achado }) {
  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{achado.titulo}</Text>

      {achado.valorContestavel ? (
        <View style={styles.valor}>
          <Text style={styles.valorLegenda}>Valor a contestar</Text>
          <MoneyText centavos={achado.valorContestavel} tone="ink" />
        </View>
      ) : null}

      <Text style={styles.explicacao}>{achado.explicacao}</Text>

      {achado.evidencia ? (
        <View style={styles.citacao}>
          <Text style={styles.trecho} selectable>
            {achado.evidencia}
          </Text>
        </View>
      ) : null}

      <View style={styles.conferir}>
        <Text style={styles.conferirLabel}>Como conferir</Text>
        <Text style={styles.conferirTexto}>{achado.comoConferir}</Text>
      </View>

      <Text style={styles.fonte}>{achado.fonte}</Text>
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
  valor: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    gap: 2,
  },
  valorLegenda: { ...typography.caption, color: colors.inkSoft },
  explicacao: { ...typography.caption, color: colors.ink, fontSize: 14, lineHeight: 20 },
  citacao: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  trecho: { ...typography.caption, color: colors.inkSoft },
  conferir: { marginTop: spacing.xs, gap: 2 },
  conferirLabel: {
    ...typography.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  conferirTexto: { ...typography.caption, color: colors.ink, fontSize: 14, lineHeight: 20 },
  fonte: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs, fontSize: 11 },
});
