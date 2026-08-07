import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { formatBasisPoints } from '../../util/percent';

interface Props {
  rotulo: string;
  /** Proporção em BASIS POINTS inteiros (2200 = 22,00%). */
  bps: number;
  /** Acima disto, o medidor sinaliza atenção. Em basis points. */
  limiteBps?: number;
  contexto?: string;
}

/**
 * Medidor de proporção com limiar.
 *
 * Duas regras do produto visíveis aqui:
 * - Acima do limite usa `warning`, NUNCA `danger`. Estar endividado não é erro
 *   nem ação destrutiva; vermelho de alarme é justamente o que este app não faz.
 * - O estado é anunciado por ÍCONE E TEXTO, nunca por cor sozinha — quem não
 *   distingue as cores precisa da mesma informação.
 */
export function Meter({ rotulo, bps, limiteBps, contexto }: Props) {
  const acimaDoLimite = limiteBps !== undefined && bps > limiteBps;
  const preenchimento = Math.min(100, Math.max(0, bps / 100));
  // Duas cores para o mesmo estado: o texto precisa passar 4,5:1 e a barra
  // precisa passar o piso de croma. `primary` cumpre a primeira e reprova a
  // segunda — numa barra fina ele lê como cinza (docs/design-system.md, 4b).
  const tomTexto = acimaDoLimite ? colors.warning : colors.primary;
  const tomBarra = acimaDoLimite ? colors.warning : colors.primaryBright;

  return (
    <View style={styles.container}>
      <View style={styles.cabecalho}>
        <Text style={styles.rotulo}>{rotulo}</Text>
        <Text style={[styles.valor, { color: tomTexto }]}>{formatBasisPoints(bps)}</Text>
      </View>

      <View style={styles.trilho}>
        <View
          style={[styles.preenchimento, { width: `${preenchimento}%`, backgroundColor: tomBarra }]}
        />
        {limiteBps !== undefined ? (
          <View style={[styles.limiar, { left: `${Math.min(100, limiteBps / 100)}%` }]} />
        ) : null}
      </View>

      {acimaDoLimite ? (
        <View style={styles.aviso}>
          <Feather name="alert-triangle" size={14} color={colors.warning} />
          <Text style={styles.avisoTexto}>
            Acima do limite saudável. Dá para renegociar — o simulador ajuda a escolher por onde
            começar.
          </Text>
        </View>
      ) : contexto ? (
        <Text style={styles.contexto}>{contexto}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  valor: { ...typography.numeric },
  trilho: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSurface,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  preenchimento: { height: '100%', borderRadius: radius.pill },
  limiar: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: colors.inkSoft,
    opacity: 0.5,
  },
  aviso: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  avisoTexto: { ...typography.caption, color: colors.inkSoft, flex: 1 },
  contexto: { ...typography.caption, color: colors.inkSoft },
});
