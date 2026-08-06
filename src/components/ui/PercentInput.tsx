import { TextInput, StyleSheet } from 'react-native';
import { FormField, fieldStyles } from './FormField';
import { colors, typography } from '../../theme/theme';
import { formatBasisPoints } from '../../util/percent';

/** Teto de segurança: 999,99% a.m. em basis points. */
const MAX_BPS = 99_999;

interface Props {
  label: string;
  /** Valor em BASIS POINTS inteiros (250 = 2,50%). */
  value: number;
  /** Recebe BASIS POINTS inteiros. Nunca é chamado com fracionário. */
  onChangeValue: (bps: number) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
}

/**
 * Entrada de taxa de juros. Espelha o CurrencyInput: o estado é sempre inteiro
 * e o usuário digita da direita para a esquerda. Nunca parseFloat, nunca string
 * com vírgula circulando pela lógica.
 */
export function PercentInput({ label, value, onChangeValue, error, hint, optional }: Props) {
  function handleChangeText(text: string) {
    const digits = text.replace(/\D/g, '');
    if (digits === '') {
      onChangeValue(0);
      return;
    }
    const bps = Number.parseInt(digits.slice(0, 5), 10);
    onChangeValue(Math.min(bps, MAX_BPS));
  }

  return (
    <FormField label={label} error={error} hint={hint} optional={optional}>
      <TextInput
        accessibilityLabel={label}
        value={value === 0 ? '' : formatBasisPoints(value)}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        placeholder="0,00%"
        placeholderTextColor={colors.inkSoft}
        style={[fieldStyles.input, styles.percent, !!error && styles.error]}
      />
    </FormField>
  );
}

const styles = StyleSheet.create({
  percent: { ...typography.numeric, fontVariant: ['tabular-nums'], color: colors.ink },
  error: { borderColor: colors.danger },
});
