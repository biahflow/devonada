import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { ErroDeMutacao } from '../../../src/components/ui/ErroDeMutacao';
import { MetaForm } from '../../../src/components/metas/MetaForm';
import { useCriarMeta } from '../../../src/hooks/useMetas';
import { spacing } from '../../../src/theme/theme';

export default function NovaMetaScreen() {
  const router = useRouter();
  const criar = useCriarMeta();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Rota de chegada"
          title="Nova meta"
          description="Aposentadoria, estudo, uma viagem. Você diz quanto e até quando."
          onBack={() => router.back()}
        />

        <ErroDeMutacao error={criar.error} fallback={'Não deu para salvar. Tente de novo.'} />

        <MetaForm
          submitLabel="Salvar meta"
          submitting={criar.isPending}
          onSubmit={(input) => criar.mutate(input, { onSuccess: () => router.back() })}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
});
