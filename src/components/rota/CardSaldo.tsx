import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { MoneyText } from '../ui/MoneyText';
import type { ResumoDividas } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * O saldo devedor e o quanto da rota já foi percorrido.
 *
 * A BARRA ENCHE COM O QUE JÁ FOI FEITO, nunca com o que falta. É a mesma
 * decisão do design system: progresso é "quanto eu já andei", e a versão
 * invertida transformaria a tela num medidor de dívida restante — que é o que
 * o app do banco faz.
 *
 * A LINHA DE PROGRESSO SÓ APARECE COM HISTÓRICO DE VERDADE. `evolucaoSaldo`
 * acumula a partir do dia em que a dívida entrou (docs/backend.md), então quem
 * cadastrou hoje tem um ponto só — e "0% percorrido" no primeiro dia seria
 * desanimador **e falso**: a pessoa não deixou de andar, ela acabou de chegar.
 * Sem ponto anterior maior que o saldo de hoje, o card mostra só o número.
 */
export function CardSaldo({ resumo }: { resumo: ResumoDividas }) {
  const inicio = resumo.evolucaoSaldo[0]?.saldo;
  const temHistorico = inicio !== undefined && inicio > resumo.totalDevido;
  const percorrido = temHistorico
    ? Math.round(((inicio - resumo.totalDevido) / inicio) * 100)
    : undefined;

  return (
    <Card>
      <Text style={styles.microlabel}>Falta quitar</Text>
      <MoneyText centavos={resumo.totalDevido} size="display" tone="debt" />

      {percorrido !== undefined && inicio !== undefined ? (
        <>
          <View style={styles.trilha}>
            <View style={[styles.preenchimento, { width: `${percorrido}%` }]} />
          </View>
          <Text style={styles.contexto}>
            {percorrido}% da rota percorrida · você começou com{' '}
            <MoneyText centavos={inicio} size="body" tone="inkSoft" style={styles.inline} />
          </Text>
        </>
      ) : (
        <Text style={styles.contexto}>
          {resumo.quantidadeDividas === 1
            ? 'em 1 dívida'
            : `em ${resumo.quantidadeDividas} dívidas`}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  microlabel: {
    ...typography.eyebrow,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  trilha: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSurface,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  preenchimento: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  contexto: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.sm },
  inline: { ...typography.caption, color: colors.inkSoft },
});
