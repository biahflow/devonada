import { View, Text, StyleSheet } from 'react-native';
import type { CriticidadeTipo } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

interface Props {
  label: string;
  tone?: 'neutro' | 'primario' | 'progresso' | 'atencao' | 'alto';
}

const tones = {
  neutro: { bg: colors.neutralSurface, fg: colors.inkSoft },
  primario: { bg: colors.primarySurface, fg: colors.primaryDeep },
  progresso: { bg: colors.accentSoft, fg: colors.warning },
  atencao: { bg: colors.accentSoft, fg: colors.warning },
  alto: { bg: colors.dangerSurface, fg: colors.danger },
} as const;

export function Badge({ label, tone = 'neutro' }: Props) {
  const { bg, fg } = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

/**
 * Criticidade não é julgamento moral do gasto — é medida de consequência.
 * `juros_abusivos` é a única situação em que a família do vermelho aparece fora
 * de erro, e ainda assim num tom suave: é classificação de custo, não repreensão.
 */
const criticidade: Record<CriticidadeTipo, { label: string; tone: Props['tone'] }> = {
  essencial: { label: 'Essencial', tone: 'primario' },
  com_garantia: { label: 'Com garantia', tone: 'atencao' },
  juros_abusivos: { label: 'Juros altos', tone: 'alto' },
  consumo: { label: 'Consumo', tone: 'neutro' },
};

export function CriticidadeBadge({ tipo }: { tipo: CriticidadeTipo }) {
  const { label, tone } = criticidade[tipo];
  return <Badge label={label} tone={tone} />;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: { ...typography.caption, fontSize: 12 },
});
