import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { FormField } from '../../../../src/components/ui/FormField';
import { CurrencyInput } from '../../../../src/components/ui/CurrencyInput';
import { PercentInput } from '../../../../src/components/ui/PercentInput';
import { DateField } from '../../../../src/components/ui/DateField';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { useRenegociar } from '../../../../src/hooks/useParcelas';
import type { IsoDate } from '../../../../src/api/types';
import { colors, spacing, typography } from '../../../../src/theme/theme';

export default function Renegociar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const renegociar = useRenegociar(id);

  const [novoValor, setNovoValor] = useState(0);
  const [parcelas, setParcelas] = useState('');
  const [taxa, setTaxa] = useState(0);
  const [primeiroVencimento, setPrimeiroVencimento] = useState<IsoDate | undefined>();
  const [observacao, setObservacao] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});

  function confirmar() {
    const encontrados: Record<string, string> = {};
    const total = Number.parseInt(parcelas, 10);
    if (novoValor <= 0) encontrados.valor = 'Informe o novo valor acordado.';
    if (!total || total < 1) encontrados.parcelas = 'Informe em quantas parcelas ficou.';
    if (!primeiroVencimento) encontrados.data = 'Informe quando vence a primeira.';

    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    // Confirmação explícita: as parcelas pendentes serão substituídas, e isso
    // não tem desfazer (guardrail 7.2).
    Alert.alert(
      'Registrar a renegociação?',
      'As parcelas ainda não pagas serão substituídas pelas novas. O que você já pagou continua no histórico.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Registrar',
          onPress: () =>
            renegociar.mutate(
              {
                novoValor,
                novoTotalParcelas: total!,
                primeiroVencimento: primeiroVencimento!,
                ...(taxa > 0 ? { novaTaxaJurosMensal: taxa } : {}),
                ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
              },
              { onSuccess: () => router.replace(`/dividas/${id}/plano`) },
            ),
        },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Acordo"
          title="Novas condições"
          description="Anote o que ficou combinado. As condições antigas continuam no histórico."
        />

        <Card>
          <Text style={styles.aviso}>
            O que você já pagou não some. Só as parcelas pendentes são substituídas pelas novas
            condições.
          </Text>
        </Card>

        <ErroDeMutacao error={renegociar.error} fallback={'Não deu para registrar. Tente de novo.'} />

        <View style={styles.form}>
          <CurrencyInput
            label="Novo valor total"
            value={novoValor}
            onChangeValue={setNovoValor}
            error={erros.valor}
            hint="O valor combinado no acordo."
          />

          <FormField
            label="Em quantas parcelas"
            value={parcelas}
            onChangeText={setParcelas}
            keyboardType="number-pad"
            error={erros.parcelas}
            placeholder="12"
          />

          <DateField
            label="Primeiro vencimento"
            value={primeiroVencimento}
            onChangeValue={setPrimeiroVencimento}
            error={erros.data}
          />

          <PercentInput
            label="Nova taxa de juros"
            value={taxa}
            onChangeValue={setTaxa}
            optional
            hint="Se o acordo mudou a taxa."
          />

          <FormField
            label="Observação"
            value={observacao}
            onChangeText={setObservacao}
            optional
            placeholder="Acordo por telefone, protocolo 12345"
          />

          <Button
            label="Registrar renegociação"
            onPress={confirmar}
            loading={renegociar.isPending}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  aviso: { ...typography.caption, color: colors.inkSoft },
  form: { gap: spacing.lg },
});
