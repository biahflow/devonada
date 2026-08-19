import { ScrollView, RefreshControl, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { TopbarMarca } from '../../../src/components/rota/TopbarMarca';
import { Button } from '../../../src/components/ui/Button';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { MetaCard } from '../../../src/components/metas/MetaCard';
import { useMetasNomeadas } from '../../../src/hooks/useMetas';
import { spacing } from '../../../src/theme/theme';

/**
 * A Rota de Chegada — tela 09 da concepção.
 *
 * MESMA MECÂNICA DA ROTA DE SAÍDA, SEMÂNTICA INVERTIDA: lá a barra encolhe até
 * zero, aqui ela cresce até o alvo. Quem sai da dívida não deveria cair num app
 * vazio; é o mesmo hábito de olhar o número toda semana, agora apontado para
 * onde a pessoa quer chegar.
 *
 * O CAMINHO DE VOLTA PARA DÍVIDAS FICA AQUI, e não é detalhe de conveniência.
 * Na fase verde esta aba OCUPA O LUGAR da aba Dívidas (ver `(tabs)/_layout.tsx`),
 * então sem este botão quem quitou tudo e contraiu uma dívida nova não teria como
 * cadastrá-la — a comemoração viraria beco sem saída. Ver ADR 0017.
 */
export default function Metas() {
  const router = useRouter();
  const { metas, isPending, error, refetch, isRefetching } = useMetasNomeadas();

  const cabecalho = (
    <>
      <TopbarMarca />
      <PageHeader
        titleLead="Suas"
        title="metas"
        description="Para onde o dinheiro vai agora que ele é seu."
      />
    </>
  );

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        <LoadingState label="Carregando suas metas" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        {cabecalho}
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (metas.length === 0) {
    return (
      <Screen>
        {cabecalho}
        <EmptyState
          icon="target"
          title="Nenhuma meta ainda"
          description="Reserva de emergência, uma viagem, trocar de carro. Você diz quanto e até quando; eu digo quanto separar por mês."
          actionLabel="Criar uma meta"
          onAction={() => router.push('/metas/nova')}
          secondaryLabel="Ver minhas dívidas"
          onSecondary={() => router.push('/dividas')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {cabecalho}

        <View style={styles.lista}>
          {metas.map((meta) => (
            <MetaCard
              key={meta.id}
              meta={meta}
              onPress={() => router.push(`/metas/${meta.id}/editar`)}
            />
          ))}
        </View>

        <View style={styles.rodape}>
          <Button
            label="+ Nova meta (aposentadoria, estudo...)"
            variant="secondary"
            onPress={() => router.push('/metas/nova')}
          />
          <Button
            label="Ver minhas dívidas"
            variant="ghost"
            onPress={() => router.push('/dividas')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl },
  lista: { gap: spacing.md },
  rodape: { gap: spacing.sm, marginTop: spacing.lg },
});
