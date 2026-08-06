import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { IsoMes } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { ehAnterior, formatMes, mesAnterior, mesSeguinte } from '../../util/mes';

interface Props {
  mes: IsoMes;
  /** Teto de navegação. Não existe saldo devedor de mês que não aconteceu. */
  maximo: IsoMes;
  onChange: (mes: IsoMes) => void;
}

export function SeletorDeMes({ mes, maximo, onChange }: Props) {
  const podeAvancar = ehAnterior(mes, maximo);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onChange(mesAnterior(mes))}
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
        style={styles.seta}
      >
        <Feather name="chevron-left" size={20} color={colors.primary} />
      </Pressable>

      <Text style={styles.mes} accessibilityLiveRegion="polite">
        {formatMes(mes)}
      </Text>

      <Pressable
        onPress={() => podeAvancar && onChange(mesSeguinte(mes))}
        disabled={!podeAvancar}
        accessibilityRole="button"
        accessibilityLabel="Mês seguinte"
        accessibilityState={{ disabled: !podeAvancar }}
        style={[styles.seta, !podeAvancar && styles.setaInativa]}
      >
        <Feather name="chevron-right" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  seta: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setaInativa: { opacity: 0.35 },
  mes: { ...typography.bodyStrong, color: colors.ink, textTransform: 'capitalize' },
});
