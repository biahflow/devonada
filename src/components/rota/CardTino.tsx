import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { ResumoDividas } from '../../api/types';
import { proximaAcao } from '../../util/proximaAcao';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * O card do Tino — a primeira coisa acionável da Rota.
 *
 * Ele existe porque o princípio nº 3 da marca é "ação, não retrovisor": o
 * painel inteiro abaixo dele serve para sustentar esta frase, e não o
 * contrário. Se um dia a Rota abrir sem uma próxima ação clara, o produto virou
 * um dashboard.
 *
 * A frase vem de `proximaAcao()`, determinística. O dot verde é presença, não
 * status de dívida: é o Tino dizendo "estou aqui".
 *
 * Desde o M10 a frase pode começar pelo custo diário dos juros. O número vem
 * pronto de `custoDiarioJuros`, no resumo — este componente não calcula, não
 * arredonda e não decide quando a frase aparece; quem decide é `proximaAcao()`,
 * e o docstring de lá diz por quê.
 */
export function CardTino({ resumo }: { resumo: ResumoDividas }) {
  const router = useRouter();
  const acao = proximaAcao(resumo);

  return (
    <Pressable
      onPress={() => router.push(acao.destino as never)}
      accessibilityRole="button"
      accessibilityLabel={`${acao.texto} ${acao.rotuloCta}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressionado]}
    >
      <View style={styles.dot} />
      <View style={styles.corpo}>
        <Text style={styles.texto}>
          <Text style={styles.prefixo}>Próxima ação: </Text>
          {acao.texto}
        </Text>
        <Text style={styles.cta}>{acao.rotuloCta} →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  pressionado: { opacity: 0.85 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  corpo: { flex: 1, gap: spacing.sm },
  texto: { ...typography.caption, color: colors.inkSoft, lineHeight: 20 },
  prefixo: { fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },
  cta: { ...typography.caption, color: colors.primary, fontFamily: typography.bodyStrong.fontFamily },
});
