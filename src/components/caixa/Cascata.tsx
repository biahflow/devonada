import { View, Text, StyleSheet } from 'react-native';
import { MoneyText } from '../ui/MoneyText';
import { colors, spacing, typography } from '../../theme/theme';

export interface Degrau {
  rotulo: string;
  centavos: number;
  /** Uma linha explicando de onde o número saiu. */
  contexto?: string;
}

interface Props {
  bruta: number;
  degraus: Degrau[];
  totalRotulo: string;
  total: number;
}

/**
 * A cascata do caixa: a renda no topo, o que sai dela em degraus, e o que sobra.
 *
 * Não é gráfico de propósito. Uma barra por degrau viraria comparação visual
 * entre gastos, e a pergunta que esta tela responde não é "o que pesa mais" — é
 * "o que sobra". A subtração encadeada em texto responde isso direto.
 *
 * Cada linha de saída leva um menos explícito: sem ele, uma coluna de números
 * pode ser lida como soma, e a leitura errada aqui muda a decisão do usuário.
 */
export function Cascata({ bruta, degraus, totalRotulo, total }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.linha}>
        <Text style={styles.rotuloTopo}>Renda do mês</Text>
        <MoneyText centavos={bruta} size="numeric" />
      </View>

      {degraus.map((d) => (
        <View key={d.rotulo} style={styles.bloco}>
          <View style={styles.linha}>
            <Text style={styles.rotulo}>{d.rotulo}</Text>
            <View style={styles.valorSaida}>
              <Text style={styles.menos}>−</Text>
              <MoneyText centavos={d.centavos} size="body" tone="inkSoft" />
            </View>
          </View>
          {d.contexto ? <Text style={styles.contexto}>{d.contexto}</Text> : null}
        </View>
      ))}

      <View style={styles.divisor} />

      <View style={styles.linha}>
        <Text style={styles.rotuloTotal}>{totalRotulo}</Text>
        {/* Negativo é exibido como negativo. Zerar ou esconder aqui apagaria a
            informação mais importante que esta tela tem a dar. */}
        <MoneyText centavos={total} size="numeric" tone={total < 0 ? 'warning' : 'accent'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  bloco: { gap: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rotuloTopo: { ...typography.bodyStrong, color: colors.ink },
  rotulo: { ...typography.body, color: colors.inkSoft, flexShrink: 1, paddingRight: spacing.md },
  rotuloTotal: { ...typography.bodyStrong, color: colors.ink },
  valorSaida: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  menos: { ...typography.body, color: colors.inkSoft },
  contexto: { ...typography.caption, color: colors.inkSoft },
  divisor: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
