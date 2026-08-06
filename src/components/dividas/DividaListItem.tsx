import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { Divida } from '../../api/types';
import { CriticidadeBadge } from '../ui/Badge';
import { MoneyText } from '../ui/MoneyText';
import { colors, radius, shadow, spacing, typography } from '../../theme/theme';
import { isoParaBR } from '../../util/date';

interface Props {
  divida: Divida;
  onPress: () => void;
}

export function DividaListItem({ divida, onPress }: Props) {
  const quitada = divida.situacao === 'quitada';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${divida.credor}, ver detalhes`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.linhaTopo}>
        <Text style={styles.credor} numberOfLines={1}>
          {divida.credor}
        </Text>
        <Feather name="chevron-right" size={20} color={colors.inkSoft} />
      </View>

      <MoneyText
        centavos={divida.saldoDevedor ?? divida.valorCobrado}
        size="numeric"
        tone={quitada ? 'inkSoft' : 'ink'}
      />

      <View style={styles.linhaBase}>
        <CriticidadeBadge tipo={divida.tipo} />
        {divida.proximoVencimento ? (
          <Text style={styles.meta}>Vence em {isoParaBR(divida.proximoVencimento)}</Text>
        ) : quitada ? (
          <Text style={styles.quitada}>Quitada</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  pressed: { opacity: 0.9 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  credor: { ...typography.bodyStrong, color: colors.ink, flex: 1 },
  linhaBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: { ...typography.caption, color: colors.inkSoft },
  quitada: { ...typography.caption, color: colors.accent },
});
