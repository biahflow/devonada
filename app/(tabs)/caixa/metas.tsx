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
import { PercentInput } from '../../../src/components/ui/PercentInput';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { useAtualizarMetas, useMetas } from '../../../src/hooks/useCaixa';
import type { MetasCaixa } from '../../../src/api/types';
import { ApiError } from '../../../src/api/client';
import { colors, spacing, typography } from '../../../src/theme/theme';

export default function MetasCaixaScreen() {
  const router = useRouter();
  const { metas, isPending, error, refetch } = useMetas();

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando suas metas" />
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

  return <Formulario inicial={metas ?? {}} onPronto={() => router.back()} />;
}

function Formulario({ inicial, onPronto }: { inicial: MetasCaixa; onPronto: () => void }) {
  const [imposto, setImposto] = useState(inicial.impostoBps ?? 0);
  const [reservaAporte, setReservaAporte] = useState(inicial.reservaAporte ?? 0);
  const [reservaSaldo, setReservaSaldo] = useState(inicial.reservaSaldo ?? 0);
  const [reservaMeses, setReservaMeses] = useState(String(inicial.reservaMetaMeses ?? ''));
  const [aposentadoria, setAposentadoria] = useState(inicial.aposentadoriaAporte ?? 0);
  const [rendimento, setRendimento] = useState(inicial.rendimentoEsperadoBps ?? 0);
  const atualizar = useAtualizarMetas();

  function salvar() {
    const meses = Number.parseInt(reservaMeses, 10);
    atualizar.mutate(
      {
        // Zero vira ausência: campo não preenchido tem de sobreviver como
        // ausente, e é assim que o usuário desfaz uma meta.
        impostoBps: imposto > 0 ? imposto : null,
        reservaAporte: reservaAporte > 0 ? reservaAporte : null,
        reservaSaldo: reservaSaldo > 0 ? reservaSaldo : null,
        reservaMetaMeses: Number.isFinite(meses) && meses > 0 ? meses : null,
        aposentadoriaAporte: aposentadoria > 0 ? aposentadoria : null,
        rendimentoEsperadoBps: rendimento > 0 ? rendimento : null,
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
          eyebrow="Caixa"
          title="Seus potes"
          description="Imposto, reserva e aposentadoria. Todos opcionais — o que você não preencher simplesmente não entra na conta."
        />

        <Card>
          <Text style={styles.explicacao}>
            A ordem entre reserva, dívida e aposentadoria é escolha sua. O app mostra os números e
            não decide por você: qual vem primeiro depende de quanto sua dívida custa e de quanto
            seu investimento rende, e o segundo número só você tem.
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
          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Imposto</Text>
            <Text style={styles.explicacao}>
              Se você é PJ, parte do que entra não é seu. Informe o percentual do seu
              enquadramento — não estimamos por você, porque errar para menos faz você gastar
              dinheiro que é do governo. Sem preencher, nada é reservado.
            </Text>
          </View>

          <PercentInput
            label="Percentual reservado para imposto"
            value={imposto}
            onChangeValue={setImposto}
            optional
            hint="Seu contador sabe o número exato."
          />

          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Reserva de emergência</Text>
            <Text style={styles.explicacao}>
              Com renda que varia, o colchão importa mais: é ele que impede que um mês fraco vire
              dívida nova.
            </Text>
          </View>

          <CurrencyInput
            label="Quanto separa por mês"
            value={reservaAporte}
            onChangeValue={setReservaAporte}
            optional
            hint="É o único dos três campos de reserva que sai do seu mês."
          />
          <CurrencyInput
            label="Quanto já tem guardado"
            value={reservaSaldo}
            onChangeValue={setReservaSaldo}
            optional
          />
          <FormField
            label="Meta, em meses de custo de vida"
            value={reservaMeses}
            onChangeText={setReservaMeses}
            keyboardType="number-pad"
            optional
            hint="Renda variável costuma pedir mais fôlego que renda fixa."
          />

          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Aposentadoria</Text>
          </View>

          <CurrencyInput
            label="Quanto separa por mês"
            value={aposentadoria}
            onChangeValue={setAposentadoria}
            optional
          />
          <PercentInput
            label="Rendimento que você espera, ao mês"
            value={rendimento}
            onChangeValue={setRendimento}
            optional
            hint="Sem este número não comparamos dívida com investimento — não projetamos rendimento por conta própria."
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
