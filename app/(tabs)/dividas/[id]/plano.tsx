import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Button } from '../../../../src/components/ui/Button';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { ParcelaItem } from '../../../../src/components/dividas/ParcelaItem';
import { useParcelas, usePagarParcela } from '../../../../src/hooks/useParcelas';
import { dateParaIso } from '../../../../src/util/date';
import { colors, spacing, typography } from '../../../../src/theme/theme';

export default function PlanoDePagamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { parcelas, isPending, error, refetch } = useParcelas(id);
  const pagar = usePagarParcela(id);

  const cabecalho = (
    <PageHeader
      eyebrow="Plano"
      title="Suas parcelas"
      description="Marque o que já pagou. O painel acompanha sozinho."
      onBack={() => router.back()}
    />
  );

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        <LoadingState label="Carregando o carnê" />
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

  if (parcelas.length === 0) {
    return (
      <Screen>
        {cabecalho}
        <EmptyState
          icon="calendar"
          title="Sem carnê para esta dívida"
          description="Você pode informar o número de parcelas e a data da primeira ao editar a dívida."
          actionLabel="Editar dívida"
          onAction={() => router.push(`/dividas/${id}/editar`)}
          secondaryLabel="Registrar renegociação"
          onSecondary={() => router.push(`/dividas/${id}/renegociar`)}
        />
      </Screen>
    );
  }

  const pagas = parcelas.filter((p) => p.situacao === 'paga').length;

  return (
    <Screen>
      <FlatList
        data={parcelas}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <View>
            {cabecalho}
            <Text style={styles.progresso}>
              {pagas} de {parcelas.length} pagas
            </Text>
            <ErroDeMutacao error={pagar.error} fallback={'Não deu para registrar o pagamento. Tente de novo.'} />
          </View>
        }
        renderItem={({ item }) => (
          <ParcelaItem
            parcela={item}
            pagando={pagar.isPending && pagar.variables?.parcelaId === item.id}
            onPagar={() =>
              pagar.mutate({
                parcelaId: item.id,
                input: { pagoEm: dateParaIso(new Date()), valorPago: item.valor },
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separador} />}
        ListFooterComponent={
          <Button
            label="Registrar renegociação"
            onPress={() => router.push(`/dividas/${id}/renegociar`)}
            variant="ghost"
            style={styles.rodape}
          />
        }
        contentContainerStyle={styles.lista}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingBottom: spacing.xxxl },
  progresso: { ...typography.caption, color: colors.inkSoft, paddingBottom: spacing.md },
  separador: { height: spacing.md },
  rodape: { marginTop: spacing.lg },
});
