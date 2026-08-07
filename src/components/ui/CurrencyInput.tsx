import { TextInput, StyleSheet } from 'react-native';
import { FormField, fieldStyles } from './FormField';
import { colors, typography } from '../../theme/theme';
import { formatBRL } from '../../util/money';

/** Teto de segurança: R$ 999.999.999,99 em centavos. Evita overflow de dígito. */
const MAX_CENTAVOS = 99_999_999_999;

interface Props {
  label: string;
  /** Valor em CENTAVOS inteiros. */
  value: number;
  /** Recebe CENTAVOS inteiros. Nunca é chamado com fracionário. */
  onChangeValue: (centavos: number) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
}

/**
 * Entrada de dinheiro. O estado é sempre CENTAVO INTEIRO: o usuário digita da
 * direita para a esquerda e a máscara sai de formatBRL.
 *
 * Nunca use parseFloat aqui, nem mantenha o valor como string com vírgula. É
 * este componente que impede a classe de bug descrita em docs/guardrails.md,
 * seção 1.1 — a mesma quantia exibida com um centavo de diferença em duas telas.
 */
export function CurrencyInput({
  label,
  value,
  onChangeValue,
  error,
  hint,
  optional,
  placeholder,
}: Props) {
  function handleChangeText(text: string) {
    // Só os dígitos importam. Vírgula, ponto e "R$" são ruído da máscara.
    const digits = text.replace(/\D/g, '');
    if (digits === '') {
      onChangeValue(0);
      return;
    }
    // Number.parseInt sobre dígitos puros é aritmética inteira — não há
    // ponto flutuante em nenhum momento do caminho.
    const centavos = Number.parseInt(digits.slice(0, 11), 10);
    onChangeValue(Math.min(centavos, MAX_CENTAVOS));
  }

  return (
    <FormField label={label} error={error} hint={hint} optional={optional}>
      <TextInput
        accessibilityLabel={label}
        value={value === 0 ? '' : formatBRL(value)}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        placeholder={placeholder ?? 'R$ 0,00'}
        placeholderTextColor={colors.inkSoft}
        style={[fieldStyles.input, styles.money, !!error && styles.error]}
      />
    </FormField>
  );
}

const styles = StyleSheet.create({
  money: { ...typography.numeric, color: colors.ink },
  error: { borderColor: colors.danger },
});
