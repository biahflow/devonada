import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MoneyText } from '../ui/MoneyText';
import { formatBasisPoints } from '../../util/percent';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  /** `null` é NUNCA DECLAROU — diferente de `0`, que é escolha legítima. */
  compromissoPercentualBps: number | null;
  /** O que a escolha custa neste mês, em centavos. Vem PRONTO do servidor. */
  compromissoPercentual: number | null;
  /** Leva à declaração (`/caixa/compromisso`) — no vazio, para criar; no cheio, para ajustar. */
  onDeclarar: () => void;
}

/**
 * O card de compromisso percentual na aba Caixa (F-011, ADR 0021, decisão 4),
 * no molde do `RespiroCard`.
 *
 * DOIS ESTADOS. Sem compromisso declarado (`compromissoPercentualBps === null`),
 * CONVIDA a declarar e NÃO SUGERE valor, faixa nem percentual — a ADR 0009 proíbe
 * coeficiente de alocação sem fonte, e a 0021 reafirma "quem não declarar não
 * tem". Com compromisso declarado, mostra o percentual e o valor em centavos que
 * o servidor mandou.
 *
 * NENHUM VALOR É CALCULADO AQUI: `compromissoPercentual` chega em centavos,
 * aplicado sobre a renda líquida típica no servidor (guardrail 1.2).
 */
export function CompromissoCard({
  compromissoPercentualBps,
  compromissoPercentual,
  onDeclarar,
}: Props) {
  if (compromissoPercentualBps === null) {
    return (
      <Card>
        <Text style={styles.titulo}>Compromisso percentual</Text>
        <Text style={styles.convite}>
          Se sua renda oscila, comprometer um percentual do que entra segura melhor que um valor
          fixo — o mês fraco não derruba o plano. Você escolhe o percentual; a gente reserva sobre o
          que de fato sobra depois do imposto.
        </Text>
        <Button label="Declarar compromisso" onPress={onDeclarar} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.topo}>
        <Text style={styles.titulo}>Compromisso deste mês</Text>
        <Text style={styles.percentual}>{formatBasisPoints(compromissoPercentualBps)}</Text>
      </View>

      {/* O valor em centavos vem PRONTO do servidor — o cliente não multiplica
          bps por renda (guardrail 1.2). `?? 0` é só piso de exibição para um
          campo que, com bps declarado, não deveria chegar nulo. */}
      <MoneyText centavos={compromissoPercentual ?? 0} size="numeric" tone="ink" />
      <Text style={styles.legenda}>reservado por mês sobre o que entra</Text>

      <Button label="Ajustar percentual" onPress={onDeclarar} variant="ghost" />
    </Card>
  );
}

const styles = StyleSheet.create({
  titulo: { ...typography.bodyStrong, color: colors.ink },
  convite: {
    ...typography.body,
    color: colors.inkSoft,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  percentual: { ...typography.bodyStrong, color: colors.ink },
  legenda: { ...typography.caption, color: colors.inkSoft, marginTop: 2 },
});
