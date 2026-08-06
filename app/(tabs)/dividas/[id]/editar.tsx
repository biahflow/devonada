import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Feedback } from '../../../../src/components/ui/Feedback';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { DividaForm } from '../../../../src/components/dividas/DividaForm';
import { useAtualizarDivida, useDivida } from '../../../../src/hooks/useDividas';
import { ApiError } from '../../../../src/api/client';
import { spacing } from '../../../../src/theme/theme';

export default function EditarDivida() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isPending, error, refetch } = useDivida(id);
  const atualizar = useAtualizarDivida(id);

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando a dívida" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const { divida } = data;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader eyebrow="Edição" title={divida.credor} description="Corrija o que mudou." />

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

        <DividaForm
          inicial={divida}
          submitLabel="Salvar alterações"
          submitting={atualizar.isPending}
          onSubmit={(input) => atualizar.mutate(input, { onSuccess: () => router.back() })}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxl, gap: spacing.lg },
});
