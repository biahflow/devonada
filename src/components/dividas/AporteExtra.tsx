import { View, Text, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { CurrencyInput } from '../ui/CurrencyInput';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { formatBRL } from '../../util/money';

/** Passo do slider: R$ 10,00 em centavos. Nunca produz valor fracionário. */
const PASSO = 1000;

/**
 * Teto do slider quando não há margem conhecida. É limite de CONTROLE, não
 * número exibido como fato — o campo continua aceitando qualquer valor acima
 * dele.
 */
const TETO_PADRAO = 200000;

const ATALHOS = [10000, 30000, 50000];

interface Props {
  /** Em CENTAVOS inteiros. */
  centavos: number;
  onChange: (centavos: number) => void;
  /** Margem disponível do painel, em centavos, quando o usuário informou a renda. */
  margemDisponivel?: number;
}

/**
 * Quanto o usuário consegue pagar por mês além das parcelas mínimas.
 *
 * Slider E campo sobre o MESMO estado em centavos inteiros: arrastar serve para
 * explorar o efeito, digitar serve para o valor exato. O slider anda em passos
 * de R$ 10,00 e o campo é o `CurrencyInput` de sempre — nenhum dos dois chega a
 * ver um float (guardrail 1.1).
 */
export function AporteExtra({ centavos, onChange, margemDisponivel }: Props) {
  const teto = margemDisponivel && margemDisponivel > PASSO ? margemDisponivel : TETO_PADRAO;
  // O slider não encolhe abaixo do que já está digitado: o marcador ficaria
  // preso na ponta enquanto o campo mostra outro número.
  const maximo = Math.max(teto, centavos, PASSO);

  return (
    <View style={styles.container}>
      <CurrencyInput
        label="Aporte extra por mês"
        value={centavos}
        onChangeValue={onChange}
        hint="O que você consegue pagar além das parcelas mínimas."
      />

      {/* Rótulo próprio, diferente do campo: dois controles com o mesmo nome
          fariam o leitor de tela anunciar "Aporte extra por mês" duas vezes sem
          dizer qual é qual. */}
      <Slider
        accessibilityLabel="Ajustar o aporte pelo slider"
        accessibilityHint="Arraste para escolher quanto pagar além das parcelas mínimas"
        style={styles.slider}
        minimumValue={0}
        maximumValue={maximo}
        step={PASSO}
        value={centavos}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />

      <View style={styles.extremos}>
        <Text style={styles.extremo}>R$ 0,00</Text>
        <Text style={styles.extremo}>{formatBRL(maximo)}</Text>
      </View>

      <View style={styles.atalhos}>
        {ATALHOS.map((valor) => (
          <Pressable
            key={valor}
            accessibilityRole="button"
            accessibilityLabel={`Aporte de ${formatBRL(valor)}`}
            onPress={() => onChange(valor)}
            style={[styles.atalho, centavos === valor && styles.atalhoAtivo]}
          >
            <Text style={[styles.atalhoTexto, centavos === valor && styles.atalhoTextoAtivo]}>
              {formatBRL(valor)}
            </Text>
          </Pressable>
        ))}
        {margemDisponivel !== undefined && margemDisponivel > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Usar toda a margem disponível"
            onPress={() => onChange(margemDisponivel)}
            style={[styles.atalho, centavos === margemDisponivel && styles.atalhoAtivo]}
          >
            <Text
              style={[
                styles.atalhoTexto,
                centavos === margemDisponivel && styles.atalhoTextoAtivo,
              ]}
            >
              Toda a sobra
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  slider: { width: '100%', height: 48 },
  extremos: { flexDirection: 'row', justifyContent: 'space-between' },
  extremo: { ...typography.caption, color: colors.inkSoft },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  atalho: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  atalhoAtivo: { borderColor: colors.primary, backgroundColor: colors.primarySurface },
  atalhoTexto: { ...typography.caption, color: colors.inkSoft },
  atalhoTextoAtivo: { ...typography.caption, color: colors.primaryDeep },
});
