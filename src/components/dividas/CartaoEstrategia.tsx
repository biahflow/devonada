import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { MoneyText } from '../ui/MoneyText';
import { colors, spacing, typography } from '../../theme/theme';
import type { Simulacao } from '../../api/types';

const NOMES = {
  avalanche: 'Avalanche',
  bola_de_neve: 'Bola de neve',
} as const;

const EXPLICACOES = {
  avalanche: 'Ataca primeiro a dívida de juros mais altos.',
  bola_de_neve: 'Ataca primeiro a menor dívida, para encerrar uma logo.',
} as const;

interface Props {
  simulacao: Simulacao;
  selecionada: boolean;
  onSelecionar: () => void;
}

/**
 * Uma estratégia simulada.
 *
 * NENHUM número aqui é calculado: todos vêm de campos da resposta. O cartão
 * também não rotula nenhuma das duas como "a certa" — a estratégia que o
 * usuário não abandona vale mais que a ótima no papel (docs/domain.md, seção 4).
 */
export function CartaoEstrategia({ simulacao, selecionada, onSelecionar }: Props) {
  const nome = NOMES[simulacao.estrategia];

  return (
    <Pressable
      onPress={onSelecionar}
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionada }}
      accessibilityLabel={`Estratégia ${nome}`}
      style={styles.toque}
    >
      <Card style={selecionada ? styles.selecionada : undefined}>
        <Text style={styles.nome}>{nome}</Text>
        <Text style={styles.explicacao}>{EXPLICACOES[simulacao.estrategia]}</Text>

        <View style={styles.linha}>
          <Text style={styles.rotulo}>Livre em</Text>
          <Text style={styles.valorTexto}>
            {simulacao.mesesAteQuitacao === 1 ? '1 mês' : `${simulacao.mesesAteQuitacao} meses`}
          </Text>
        </View>

        <View style={styles.linha}>
          <Text style={styles.rotulo}>Juros no total</Text>
          <MoneyText centavos={simulacao.totalJurosPagos} size="body" />
        </View>

        <View style={styles.linha}>
          <Text style={styles.rotulo}>Economia com o aporte</Text>
          {/* Ausência é ausência: o cenário de pagar só o mínimo pode nunca
              quitar, e nesse caso não há economia a afirmar. */}
          {simulacao.economiaVsMinimo === undefined || simulacao.economiaVsMinimo === null ? (
            <Text style={styles.ausente}>ainda não calculado</Text>
          ) : (
            <MoneyText centavos={simulacao.economiaVsMinimo} size="body" tone="accent" />
          )}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toque: { flex: 1 },
  selecionada: { borderColor: colors.primary, borderWidth: 2 },
  nome: { ...typography.bodyStrong, color: colors.ink },
  explicacao: { ...typography.caption, color: colors.inkSoft, marginBottom: spacing.md },
  linha: { gap: 2, marginTop: spacing.sm },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  valorTexto: { ...typography.body, color: colors.ink },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
});
