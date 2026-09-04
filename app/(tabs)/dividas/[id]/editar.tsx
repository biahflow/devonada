import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { Feedback } from '../../../../src/components/ui/Feedback';
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

  // Nos três ramos, não só no de conteúdo: formulário que não carrega sem saída
  // é tela travada (ADR 0016).
  const voltar = () => router.back();

  if (isPending) {
    return (
      <Screen>
        <PageHeader eyebrow="Edição" title="Carregando" onBack={voltar} />
        <LoadingState label="Carregando a dívida" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <PageHeader eyebrow="Edição" title="Não deu para abrir" onBack={voltar} />
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const { divida } = data;
  // Com carnê, mudar o valor cobrado recalcula as parcelas pendentes no
  // backend (F-019 em andamento). Quem tem carnê precisa saber disso ANTES de
  // salvar, não descobrir depois na tela de plano.
  const temCarne = (divida.totalParcelas ?? 0) > 0;

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
          onBack={voltar}
        />

        <ErroDeMutacao error={atualizar.error} fallback={'Não deu para salvar. Tente de novo.'} />

        {temCarne ? (
          <Feedback
            tone="warning"
            message="Se você mudar o valor cobrado, as parcelas ainda não pagas deste carnê serão recalculadas para o valor novo ao salvar. As parcelas já pagas não mudam."
          />
        ) : null}

        <DividaForm
          // O campo proposto entra POR CIMA do que está salvo; o resto continua
          // como está no banco. Nada disso é gravado até ela tocar em salvar.
          //
          // OS CAMPOS SÃO LISTADOS, e não espalhados da dívida inteira, porque
          // `Divida` passou a devolver `extracaoId` (F-019) e o `DividaForm`
          // repassa esse campo para o corpo da submissão — é assim que a criação
          // a partir de documento liga a dívida à extração. Aqui a submissão é um
          // PATCH, e PATCH não liga documento: o campo viajaria e o servidor o
          // ignoraria em silêncio (ADR 0025, decisão 1). Ligar ou trocar
          // documento tem rota própria, em `dividas/[id]/documento`.
          inicial={{
            credor: divida.credor,
            valorCobrado: divida.valorCobrado,
            dataOrigem: divida.dataOrigem,
            tipo: divida.tipo,
            taxaJurosMensal: divida.taxaJurosMensal,
            totalParcelas: divida.totalParcelas,
            ...proposta,
          }}
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
