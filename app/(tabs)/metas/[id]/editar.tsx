import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { MetaForm } from '../../../../src/components/metas/MetaForm';
import { useAtualizarMeta, useExcluirMeta, useMetasNomeadas } from '../../../../src/hooks/useMetas';
import { spacing } from '../../../../src/theme/theme';

/**
 * Editar uma meta.
 *
 * LÊ DA LISTA JÁ EM CACHE em vez de buscar por id: não existe `GET /v1/metas/{id}`
 * porque a coleção de metas de uma pessoa cabe numa resposta, e um endpoint de
 * item só para esta tela seria contrato a mais para manter (ADR 0002 — a leitura
 * sai do cache que a aba já buscou).
 */
export default function EditarMeta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { metas, isPending, error, refetch } = useMetasNomeadas();
  const atualizar = useAtualizarMeta(id);
  const excluir = useExcluirMeta(id);

  const voltar = () => router.back();
  const meta = metas.find((m) => m.id === id);

  if (isPending) {
    return (
      <Screen>
        <PageHeader eyebrow="Meta" title="Carregando" onBack={voltar} />
        <LoadingState label="Carregando a meta" />
      </Screen>
    );
  }

  if (error || !meta) {
    return (
      <Screen>
        <PageHeader eyebrow="Meta" title="Não deu para abrir" onBack={voltar} />
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  function confirmarExclusao() {
    Alert.alert(
      'Excluir esta meta?',
      'Ela sai da sua lista. O dinheiro que você já guardou continua seu — o que sai é o registro da meta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => excluir.mutate(undefined, { onSuccess: voltar }),
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
          eyebrow="Rota de chegada"
          title={meta.nome}
          description="Atualize o quanto já guardou — é isso que move a barra."
          onBack={voltar}
        />

        <ErroDeMutacao
          error={atualizar.error ?? excluir.error}
          fallback={'Não deu para salvar. Tente de novo.'}
        />

        <MetaForm
          inicial={meta}
          submitLabel="Salvar meta"
          submitting={atualizar.isPending}
          onSubmit={(input) => atualizar.mutate(input, { onSuccess: voltar })}
          onExcluir={confirmarExclusao}
          excluindo={excluir.isPending}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
});
