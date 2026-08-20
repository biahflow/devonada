import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * A regra de ouro nº 1, dita na tela em que a pessoa mais desconfia.
 *
 * Quem chega aqui já foi tratado como oportunidade de venda por todo app
 * financeiro que instalou — e o modelo de negócio deste produto é literalmente
 * o oposto: ele ganha dinheiro por assinatura justamente para nunca precisar
 * ganhar oferecendo crédito a quem está endividado.
 *
 * Isso não é copy de marketing, é a promessa que sustenta a confiança que o
 * Tino precisa manter.
 * Se um dia o produto passar a oferecer crédito, ESTE COMPONENTE PRECISA SAIR
 * ANTES — deixá-lo no ar seria mentir para quem acreditou.
 */
export function NotaDePrivacidade() {
  return (
    <View style={styles.caixa}>
      <Text style={styles.texto}>
        <Text style={styles.forte}>Seus dados nunca viram oferta de crédito.</Text> A gente não
        vende, não repassa e não te oferece empréstimo. Nunca.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  texto: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  forte: { color: colors.ink, fontFamily: typography.bodyStrong.fontFamily },
});
