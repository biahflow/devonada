import { View, Text, StyleSheet } from 'react-native';
import { MoneyText } from './MoneyText';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  rotulo: string;
  /** Em CENTAVOS. `undefined` significa que o backend ainda não calculou. */
  centavos?: number;
  /** Alternativa a `centavos` para valores que não são dinheiro. */
  texto?: string;
  contexto?: string;
  destaque?: boolean;
}

/**
 * Número protagonista. Não é gráfico e não deve virar um: um valor único se lê
 * melhor como número grande do que como barra de um item só.
 *
 * Ausência NUNCA vira zero — "R$ 0,00" afirma que não se deve nada, que é
 * diferente de "o backend ainda não calculou".
 */
export function StatTile({ rotulo, centavos, texto, contexto, destaque }: Props) {
  const ausente = centavos === undefined && !texto;

  return (
    <View style={styles.container}>
      <Text style={styles.rotulo}>{rotulo}</Text>

      {ausente ? (
        <Text style={styles.ausente}>ainda não calculado</Text>
      ) : centavos !== undefined ? (
        <MoneyText
          centavos={centavos}
          size={destaque ? 'display' : 'numeric'}
          tone={destaque ? 'ink' : 'ink'}
        />
      ) : (
        <Text style={destaque ? styles.textoDestaque : styles.texto}>{texto}</Text>
      )}

      {contexto ? <Text style={styles.contexto}>{contexto}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  texto: { ...typography.numeric, color: colors.ink },
  textoDestaque: { ...typography.display, color: colors.ink },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
  contexto: { ...typography.caption, color: colors.inkSoft },
});
