import { useState } from 'react';
import { Platform, Pressable, Text, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FormField, fieldStyles } from './FormField';
import type { IsoDate } from '../../api/types';
import { colors, typography } from '../../theme/theme';
import { dateParaIso, isoParaBR, isoParaDate } from '../../util/date';

interface Props {
  label: string;
  value: IsoDate | undefined;
  onChangeValue: (iso: IsoDate) => void;
  error?: string;
  hint?: string;
  optional?: boolean;
  maximumDate?: Date;
}

export function DateField({
  label,
  value,
  onChangeValue,
  error,
  hint,
  optional,
  maximumDate,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const texto = isoParaBR(value);

  return (
    <FormField label={label} error={error} hint={hint} optional={optional}>
      <>
        <Pressable
          onPress={() => setAberto(true)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: texto || 'nenhuma data escolhida' }}
          style={[fieldStyles.input, styles.pressable, !!error && styles.error]}
        >
          <Text style={texto ? styles.valor : styles.placeholder}>{texto || 'DD/MM/AAAA'}</Text>
        </Pressable>

        {aberto ? (
          <DateTimePicker
            value={isoParaDate(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={maximumDate}
            onChange={(event, date) => {
              // No Android o picker é modal: fecha sozinho em qualquer desfecho.
              if (Platform.OS === 'android') setAberto(false);
              if (event.type === 'set' && date) onChangeValue(dateParaIso(date));
            }}
          />
        ) : null}
      </>
    </FormField>
  );
}

const styles = StyleSheet.create({
  pressable: { justifyContent: 'center' },
  valor: { ...typography.body, color: colors.ink },
  placeholder: { ...typography.body, color: colors.inkSoft },
  error: { borderColor: colors.danger },
});
