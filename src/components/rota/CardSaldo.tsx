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
 * `rotaPercorridaBps` e `saldoInicialDaRota` vêm prontos de
 * `GET /v1/dividas/resumo`, calculados no servidor contra o maior saldo já
 * registrado — o card não deriva mais essa conta localmente contra o
 * primeiro ponto de `evolucaoSaldo`, que era recortado pelo mês selecionado e
 * podia andar para trás (ADR 0019, item 4; guardrail 1.2).
 *
 * A LINHA DE PROGRESSO SÓ APARECE COM HISTÓRICO DE VERDADE: os dois campos
 * vêm `null` juntos quando quem cadastrou hoje tem um ponto só — "0%
 * percorrido" no primeiro dia seria desanimador **e falso**, a pessoa não
 * deixou de andar, ela acabou de chegar. `0` é diferente de `null`: com
 * histórico e zero percorrido, a barra aparece vazia, não escondida.
 *
 * A ETIQUETA É INTEIRA, e `formatBasisPoints` NÃO serve aqui. Aquele utilitário
 * existe para taxa de juros — o docstring dele diz "250 = 2,50% a.m." —, e duas
 * casas decimais são exatas onde o número é dinheiro disfarçado. Numa barra de
 * progresso elas são ruído: "27,40% da rota percorrida" lê como taxa, não como
 * avanço. Arredondar para exibir não é derivar (guardrail 1.2): a porcentagem
 * vem pronta do servidor, e o cliente só escolhe como escrevê-la — o mesmo que
 * `formatBRL` faz com centavos.
 *
 * A LARGURA DA BARRA usa a fração exata, não o inteiro arredondado: o traço não
 * tem por que perder precisão que o texto descarta só por legibilidade.
 */
export function CardSaldo({ resumo }: { resumo: ResumoDividas }) {
  const { saldoInicialDaRota, rotaPercorridaBps } = resumo;

  return (
    <Card>
      <Text style={styles.microlabel}>Falta quitar</Text>
      <MoneyText centavos={resumo.totalDevido} size="display" tone="debt" />

      {rotaPercorridaBps !== null && saldoInicialDaRota !== null ? (
        <>
          <View style={styles.trilha}>
            <View
              testID="rota-preenchimento"
              style={[styles.preenchimento, { width: `${rotaPercorridaBps / 100}%` }]}
            />
          </View>
          <Text style={styles.contexto}>
            {Math.round(rotaPercorridaBps / 100)}% da rota percorrida · você começou com{' '}
            <MoneyText
              centavos={saldoInicialDaRota}
              size="body"
              tone="inkSoft"
              style={styles.inline}
            />
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
