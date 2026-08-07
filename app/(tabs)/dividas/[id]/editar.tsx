import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { DividaForm } from '../../../../src/components/dividas/DividaForm';
import { useAtualizarDivida, useDivida } from '../../../../src/hooks/useDividas';
import { paramsParaProposta, temProposta } from '../../../../src/util/proposta';
import { spacing } from '../../../../src/theme/theme';

export default function EditarDivida() {
  const params = useLocalSearchParams<{ id: string }>();
  const { id } = params;
  const router = useRouter();
  const { data, isPending, error, refetch } = useDivida(id);
  const atualizar = useAtualizarDivida(id);

  // Rascunho vindo do chat (guardrail 7.2), já revalidado campo a campo.
  const proposta = paramsParaProposta(params);
  const veioDaConversa = temProposta(params);

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
        <PageHeader
          eyebrow="Edição"
          title={divida.credor}
          description={
            veioDaConversa
              ? 'Marquei o que entendi da nossa conversa. Confira antes de salvar.'
              : 'Corrija o que mudou.'
          }
        />

        <ErroDeMutacao error={atualizar.error} fallback={'Não deu para salvar. Tente de novo.'} />

        <DividaForm
          // O campo proposto entra POR CIMA do que está salvo; o resto continua
          // como está no banco. Nada disso é gravado até ela tocar em salvar.
          inicial={{ ...divida, ...proposta }}
          submitLabel="Salvar alterações"
          submitting={atualizar.isPending}
          onSubmit={(input) => atualizar.mutate(input, { onSuccess: () => router.back() })}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
});
