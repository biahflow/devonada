import { View, Text, StyleSheet } from 'react-native';
import type { CampoExtraido, Confianca } from '../../api/contratos';
import { Badge } from '../ui/Badge';
import { colors, radius, spacing, typography } from '../../theme/theme';

interface Props {
  rotulo: string;
  campo: CampoExtraido<unknown> | undefined;
  /** Como o valor deve aparecer. Formatação é do chamador — aqui só exibe. */
  valorFormatado?: string;
}

const CONFIANCA: Record<Confianca, { label: string; tone: 'primario' | 'atencao' | 'alto' }> = {
  alta: { label: 'Confiança alta', tone: 'primario' },
  media: { label: 'Confere isso', tone: 'atencao' },
  baixa: { label: 'Confere isso', tone: 'alto' },
};

/**
 * Exibe um campo proposto pela extração com a evidência que o sustenta.
 *
 * Duas regras de guardrail visíveis aqui:
 * - Sem `trecho` do contrato, não há valor a mostrar. Número sem evidência é
 *   palpite do modelo, e palpite não se apresenta como dado.
 * - O trecho é renderizado como TEXTO PURO. Conteúdo de contrato é entrada não
 *   confiável (guardrail 7.3): nunca markdown, nunca HTML, nunca link.
 */
export function CampoRevisao({ rotulo, campo, valorFormatado }: Props) {
  const temEvidencia = !!campo?.trecho;
  const temValor = campo?.valor !== null && campo?.valor !== undefined;
  const preenchido = temEvidencia && temValor;

  return (
    <View style={styles.container}>
      <View style={styles.cabecalho}>
        <Text style={styles.rotulo}>{rotulo}</Text>
        {preenchido && campo ? <Badge {...CONFIANCA[campo.confianca]} /> : null}
      </View>

      {preenchido ? (
        <Text style={styles.valor}>{valorFormatado}</Text>
      ) : (
        <Text style={styles.ausente}>
          {temValor
            ? 'encontrado, mas sem trecho que comprove — preencha à mão'
            : 'não encontramos no contrato'}
        </Text>
      )}

      {campo?.trecho ? (
        <View style={styles.citacao}>
          <Text style={styles.trecho} selectable>
            {campo.trecho}
          </Text>
          {campo.pagina ? <Text style={styles.pagina}>página {campo.pagina}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, paddingVertical: spacing.sm },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  valor: { ...typography.bodyStrong, color: colors.ink },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
  citacao: {
    backgroundColor: colors.background,
    borderLeftWidth: 3,
    borderLeftColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  trecho: { ...typography.caption, color: colors.inkSoft },
  pagina: { ...typography.caption, color: colors.inkSoft, fontSize: 11 },
});
