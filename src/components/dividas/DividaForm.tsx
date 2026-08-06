import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NovaDivida } from '../../api/debts';
import type { CriticidadeTipo } from '../../api/types';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DateField } from '../ui/DateField';
import { FormField } from '../ui/FormField';
import { OptionGroup, type Option } from '../ui/OptionGroup';
import { PercentInput } from '../ui/PercentInput';
import { spacing } from '../../theme/theme';

/** Rótulos e explicações vêm de docs/domain.md, seção 2. Criticidade mede
 *  consequência de não pagar — nunca julga o gasto que originou a dívida. */
const CRITICIDADES: readonly Option<CriticidadeTipo>[] = [
  {
    value: 'juros_abusivos',
    label: 'Juros altos',
    description: 'Rotativo do cartão, cheque especial. É o que cresce mais rápido.',
  },
  {
    value: 'com_garantia',
    label: 'Com garantia',
    description: 'Financiamento de casa ou carro. Há risco de perder o bem.',
  },
  {
    value: 'essencial',
    label: 'Essencial',
    description: 'Água, luz, gás, aluguel. Cobre o básico da vida.',
  },
  {
    value: 'consumo',
    label: 'Consumo',
    description: 'Varejo, cartão comum, parcelamento. Costuma ter espaço para negociar.',
  },
];

interface Props {
  inicial?: Partial<NovaDivida>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (input: NovaDivida) => void;
}

interface Erros {
  credor?: string;
  valorCobrado?: string;
  dataOrigem?: string;
  tipo?: string;
}

/**
 * Formulário compartilhado por cadastro e edição. Não conhece api/ nem
 * navegação: recebe valores iniciais e devolve o input pronto.
 */
export function DividaForm({ inicial, submitLabel, submitting, onSubmit }: Props) {
  const [credor, setCredor] = useState(inicial?.credor ?? '');
  const [valorCobrado, setValorCobrado] = useState(inicial?.valorCobrado ?? 0);
  const [dataOrigem, setDataOrigem] = useState(inicial?.dataOrigem);
  const [tipo, setTipo] = useState<CriticidadeTipo | undefined>(inicial?.tipo);
  const [taxaJurosMensal, setTaxaJurosMensal] = useState(inicial?.taxaJurosMensal ?? 0);
  const [erros, setErros] = useState<Erros>({});

  function submeter() {
    const encontrados: Erros = {};
    if (!credor.trim()) encontrados.credor = 'Informe quem está cobrando.';
    if (valorCobrado <= 0) encontrados.valorCobrado = 'Informe o valor cobrado.';
    if (!dataOrigem) encontrados.dataOrigem = 'Informe quando a dívida começou.';
    if (!tipo) encontrados.tipo = 'Escolha uma classificação.';

    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    onSubmit({
      credor: credor.trim(),
      valorCobrado,
      dataOrigem: dataOrigem!,
      tipo: tipo!,
      // 0 significa "não informado" — enviar 0 faria o backend tratar como
      // taxa zero, que é uma afirmação diferente de ausência.
      ...(taxaJurosMensal > 0 ? { taxaJurosMensal } : {}),
    });
  }

  return (
    <View style={styles.form}>
      <FormField
        label="Credor"
        value={credor}
        onChangeText={setCredor}
        error={erros.credor}
        placeholder="Nubank, Banco Teste S/A…"
        autoCapitalize="words"
      />

      <CurrencyInput
        label="Valor cobrado"
        value={valorCobrado}
        onChangeValue={setValorCobrado}
        error={erros.valorCobrado}
        hint="O quanto estão pedindo hoje."
      />

      <DateField
        label="Quando começou"
        value={dataOrigem}
        onChangeValue={setDataOrigem}
        error={erros.dataOrigem}
        maximumDate={new Date()}
      />

      <OptionGroup
        label="Classificação"
        options={CRITICIDADES}
        value={tipo}
        onChangeValue={setTipo}
        error={erros.tipo}
      />

      <PercentInput
        label="Juros ao mês"
        value={taxaJurosMensal}
        onChangeValue={setTaxaJurosMensal}
        optional
        hint="Se souber. Sem ela o simulador não consegue ordenar por juros."
      />

      <Button label={submitLabel} onPress={submeter} loading={submitting} style={styles.submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
});
