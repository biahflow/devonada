import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { PontoEvolucao } from '../../api/types';
import { colors, spacing, typography } from '../../theme/theme';
import { caminhoDeLinha, escalarSerie } from '../../util/grafico';
import { formatBRL } from '../../util/money';
import { formatMesCurto } from '../../util/mes';

interface Props {
  pontos: readonly PontoEvolucao[];
  largura: number;
  altura?: number;
}

const PADDING = 12;
const RAIO_MARCADOR = 5;

/**
 * Evolução do saldo devedor. SÉRIE ÚNICA — por isso não leva legenda: o título
 * da seção já nomeia o que está desenhado.
 *
 * Regras que vieram da validação de paleta e do tom do produto:
 * - linha em `primaryBright`, 2px, sem preenchimento sob a curva. A cor de ação
 *   não serve aqui: numa linha fina ela fica abaixo do piso de croma e lê como
 *   cinza. `primaryBright` é a versão que passa croma e contraste;
 * - eixo recessivo, começando na base da área — nada de eixo truncado que
 *   transforme uma variação de 3% num despencar dramático;
 * - rótulo direto só no primeiro e no último ponto, nunca um número em cada.
 */
export function LinhaEvolucao({ pontos, largura, altura = 140 }: Props) {
  if (pontos.length === 0) {
    return (
      <Text style={styles.vazio}>
        Ainda não há histórico suficiente. A curva aparece depois de alguns meses de uso.
      </Text>
    );
  }

  const valores = pontos.map((p) => p.saldo);
  const { pontos: coords } = escalarSerie(valores, largura - PADDING * 2, altura, PADDING);
  const deslocados = coords.map((c) => ({ x: c.x + PADDING, y: c.y }));

  const primeiro = pontos[0]!;
  const ultimo = pontos[pontos.length - 1]!;
  const coordPrimeira = deslocados[0]!;
  const coordUltima = deslocados[deslocados.length - 1]!;

  return (
    <View style={styles.container}>
      <Svg width={largura} height={altura}>
        <Line
          x1={0}
          y1={altura - 1}
          x2={largura}
          y2={altura - 1}
          stroke={colors.border}
          strokeWidth={1}
        />

        {deslocados.length > 1 ? (
          <Path
            d={caminhoDeLinha(deslocados)}
            stroke={colors.primaryBright}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}

        <Circle
          cx={coordPrimeira.x}
          cy={coordPrimeira.y}
          r={RAIO_MARCADOR}
          fill={colors.surface}
          stroke={colors.primaryBright}
          strokeWidth={2}
        />
        {deslocados.length > 1 ? (
          <Circle
            cx={coordUltima.x}
            cy={coordUltima.y}
            r={RAIO_MARCADOR}
            fill={colors.primaryBright}
            stroke={colors.surface}
            strokeWidth={2}
          />
        ) : null}
      </Svg>

      <View style={styles.extremos}>
        <View>
          <Text style={styles.mes}>{formatMesCurto(primeiro.mes)}</Text>
          <Text style={styles.valor}>{formatBRL(primeiro.saldo)}</Text>
        </View>
        {pontos.length > 1 ? (
          <View style={styles.direita}>
            <Text style={styles.mes}>{formatMesCurto(ultimo.mes)}</Text>
            <Text style={styles.valor}>{formatBRL(ultimo.saldo)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  extremos: { flexDirection: 'row', justifyContent: 'space-between' },
  direita: { alignItems: 'flex-end' },
  mes: { ...typography.caption, color: colors.inkSoft, fontSize: 11 },
  valor: { ...typography.caption, color: colors.ink },
  vazio: { ...typography.caption, color: colors.inkSoft },
});
