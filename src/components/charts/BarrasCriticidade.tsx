import { View, Text, StyleSheet } from 'react-native';
import type { TotalPorCriticidade } from '../../api/types';
import { CriticidadeBadge } from '../ui/Badge';
import { MoneyText } from '../ui/MoneyText';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { proporcoes } from '../../util/grafico';

interface Props {
  itens: readonly TotalPorCriticidade[];
}

/**
 * Distribuição do total devido por criticidade.
 *
 * As barras usam UM ÚNICO TOM, não uma cor por categoria. A decisão veio da
 * validação de paleta (docs/design-system.md, seção de dados): quatro matizes
 * tirados desta paleta falharam no piso de distinção — pine e o neutro ficam
 * indistinguíveis mesmo para quem enxerga todas as cores.
 *
 * A identidade vem do `CriticidadeBadge` ao lado, onde a cor semântica já
 * funciona em escala de badge. Cor por categoria aqui seria redundante com o
 * rótulo, sem acrescentar informação.
 */
export function BarrasCriticidade({ itens }: Props) {
  if (itens.length === 0) {
    return <Text style={styles.vazio}>Nada distribuído ainda.</Text>;
  }

  const larguras = proporcoes(itens.map((i) => i.total));

  return (
    <View style={styles.container}>
      {itens.map((item, i) => (
        <View key={item.tipo} style={styles.linha}>
          <View style={styles.cabecalho}>
            <CriticidadeBadge tipo={item.tipo} />
            <MoneyText centavos={item.total} size="body" />
          </View>

          <View style={styles.trilho}>
            <View style={[styles.barra, { width: `${(larguras[i] ?? 0) * 100}%` }]} />
          </View>

          <Text style={styles.quantidade}>
            {item.quantidade === 1 ? '1 dívida' : `${item.quantidade} dívidas`}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  linha: { gap: spacing.xs },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trilho: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSurface,
    overflow: 'hidden',
  },
  barra: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  quantidade: { ...typography.caption, color: colors.inkSoft, fontSize: 11 },
  vazio: { ...typography.caption, color: colors.inkSoft },
});
