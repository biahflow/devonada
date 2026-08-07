import { useState } from 'react';
import { ScrollView, RefreshControl, View, Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Button } from '../../../src/components/ui/Button';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { GrupoDeLista } from '../../../src/components/ui/GrupoDeLista';
import { DividaListItem } from '../../../src/components/dividas/DividaListItem';
import { useDividas } from '../../../src/hooks/useDividas';
import { ROTULO_ORDEM, type OrdemDivida } from '../../../src/util/dividas';
import { colors, radius, spacing, typography } from '../../../src/theme/theme';

const ORDENS: readonly OrdemDivida[] = ['criticidade', 'valor', 'vencimento'];

export default function ListaDividas() {
  const router = useRouter();
  const [ordem, setOrdem] = useState<OrdemDivida>('criticidade');
  const { dividas, isPending, error, refetch, isRefetching } = useDividas(ordem);

  const cabecalho = (
    <PageHeader
      titleLead="Suas"
      title="dívidas"
      description="Um retrato honesto do que existe hoje, sem susto."
      action={
        <Button
          label="Ler contrato"
          onPress={() => router.push('/dividas/contrato')}
          variant="secondary"
        />
      }
    />
  );

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        <LoadingState label="Carregando suas dívidas" />
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

  if (dividas.length === 0) {
    return (
      <Screen>
        {cabecalho}
        <EmptyState
          icon="file-text"
          title="Nenhuma dívida cadastrada"
          description="Mande o contrato e eu preencho para você conferir. Ou cadastre à mão, se preferir."
          actionLabel="Ler um contrato"
          onAction={() => router.push('/dividas/contrato')}
          secondaryLabel="Cadastrar à mão"
          onSecondary={() => router.push('/dividas/nova')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View>
          {cabecalho}
          <View style={styles.chips} accessibilityRole="radiogroup">
            {ORDENS.map((valor) => {
              const ativo = valor === ordem;
              return (
                <Pressable
                  key={valor}
                  onPress={() => setOrdem(valor)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                  style={[styles.chip, ativo && styles.chipAtivo]}
                >
                  <Text style={[styles.chipLabel, ativo && styles.chipLabelAtivo]}>
                    {ROTULO_ORDEM[valor]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Um card com divisores, não linhas soltas no fundo. Visto em device: a
            lista solta perdia o ritmo do reference, que agrupa tudo numa
            superfície só. `ScrollView` no lugar de `FlatList` porque a lista de
            dívidas de uma pessoa cabe na memória — é o mesmo padrão do painel. */}
        <GrupoDeLista>
          {dividas.map((item, i) => (
            <View key={item.id}>
              {i > 0 ? <View style={styles.divisor} /> : null}
              <DividaListItem divida={item} onPress={() => router.push(`/dividas/${item.id}`)} />
            </View>
          ))}
        </GrupoDeLista>

        <Button
          label="Simular quitação"
          onPress={() => router.push('/dividas/simulador')}
          variant="secondary"
          style={styles.rodape}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { paddingBottom: spacing.xxxl },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.lg },
  chip: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  chipAtivo: { backgroundColor: colors.primarySurface, borderColor: colors.primary },
  chipLabel: { ...typography.caption, color: colors.inkSoft },
  chipLabelAtivo: { ...typography.caption, color: colors.primaryDeep },
  divisor: { height: 1, backgroundColor: colors.border },
  rodape: { marginTop: spacing.lg },
});
