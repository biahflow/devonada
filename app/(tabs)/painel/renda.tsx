import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Feedback } from '../../../src/components/ui/Feedback';
import { FormField } from '../../../src/components/ui/FormField';
import { CurrencyInput } from '../../../src/components/ui/CurrencyInput';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { useAtualizarPerfil, usePerfil } from '../../../src/hooks/usePainel';
import { HORA_MAXIMA, HORA_MINIMA, horaValida } from '../../../src/notificacoes';
import type { PerfilFinanceiro } from '../../../src/api/types';
import { ApiError } from '../../../src/api/client';
import { colors, spacing, typography } from '../../../src/theme/theme';

export default function Renda() {
  const router = useRouter();
  const { perfil, isPending, error, refetch } = usePerfil();

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando seu perfil" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return <Formulario inicial={perfil ?? {}} onPronto={() => router.back()} />;
}

function Formulario({ inicial, onPronto }: { inicial: PerfilFinanceiro; onPronto: () => void }) {
  const [renda, setRenda] = useState(inicial.rendaMensal ?? 0);
  const [dependentes, setDependentes] = useState(String(inicial.dependentes ?? 0));
  const [hora, setHora] = useState(inicial.horaLembrete ?? '09:00');
  const [antecedencia, setAntecedencia] = useState(String(inicial.diasAntecedenciaLembrete ?? 3));
  const [erro, setErro] = useState<string | undefined>();
  const [erroHora, setErroHora] = useState<string | undefined>();
  const atualizar = useAtualizarPerfil();

  function salvar() {
    let invalido = false;

    if (renda <= 0) {
      setErro('Informe sua renda mensal.');
      invalido = true;
    } else {
      setErro(undefined);
    }

    // Faixa limitada de propósito: nada deve tocar de madrugada.
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) || !horaValida(hora)) {
      setErroHora(`Escolha um horário entre ${HORA_MINIMA}:00 e ${HORA_MAXIMA}:00.`);
      invalido = true;
    } else {
      setErroHora(undefined);
    }

    if (invalido) return;

    atualizar.mutate(
      {
        rendaMensal: renda,
        dependentes: Number.parseInt(dependentes, 10) || 0,
        horaLembrete: hora,
        diasAntecedenciaLembrete: Number.parseInt(antecedencia, 10) || 0,
      },
      { onSuccess: onPronto },
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
          eyebrow="Seu contexto"
          title="Sua renda"
          description="Serve para calcular quanto das suas contas cabe no orçamento — e o que não pode ser sacrificado."
        />

        <Card>
          <Text style={styles.explicacao}>
            Guardamos só o valor. Não pedimos holerite, não conferimos com ninguém e você pode mudar
            quando quiser.
          </Text>
        </Card>

        {atualizar.error ? (
          <Feedback
            tone="error"
            message={
              atualizar.error instanceof ApiError
                ? atualizar.error.message
                : 'Não deu para salvar. Tente de novo.'
            }
          />
        ) : null}

        <View style={styles.form}>
          <CurrencyInput
            label="Renda mensal"
            value={renda}
            onChangeValue={setRenda}
            error={erro}
            hint="O que entra por mês, somando tudo."
          />

          <FormField
            label="Pessoas que dependem de você"
            value={dependentes}
            onChangeText={setDependentes}
            keyboardType="number-pad"
            optional
            hint="Entra no cálculo do mínimo existencial."
          />

          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Lembretes de vencimento</Text>
            <Text style={styles.explicacao}>
              O aviso aparece no seu aparelho, no horário que você escolher. Nada dispara de
              madrugada.
            </Text>
          </View>

          <FormField
            label="Horário do aviso"
            value={hora}
            onChangeText={setHora}
            error={erroHora}
            placeholder="09:00"
            keyboardType="numbers-and-punctuation"
            hint={`Entre ${HORA_MINIMA}:00 e ${HORA_MAXIMA}:00.`}
          />

          <FormField
            label="Avisar com quantos dias de antecedência"
            value={antecedencia}
            onChangeText={setAntecedencia}
            keyboardType="number-pad"
            placeholder="3"
          />

          <Button label="Salvar" onPress={salvar} loading={atualizar.isPending} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  explicacao: { ...typography.caption, color: colors.inkSoft },
  secao: { gap: spacing.xs, marginTop: spacing.md },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink },
  form: { gap: spacing.lg },
});
