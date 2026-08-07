import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Feedback } from '../../../src/components/ui/Feedback';
import { DividaForm } from '../../../src/components/dividas/DividaForm';
import { useCriarDivida } from '../../../src/hooks/useDividas';
import { ApiError } from '../../../src/api/client';
import { paramsParaProposta, temProposta } from '../../../src/util/proposta';
import { spacing } from '../../../src/theme/theme';

export default function NovaDivida() {
  const router = useRouter();
  const criar = useCriarDivida();

  // Rascunho vindo do chat (guardrail 7.2). Os parâmetros são validados de
  // novo: o que não passa abre vazio, em vez de entrar errado no formulário.
  const params = useLocalSearchParams();
  const proposta = paramsParaProposta(params);
  const veioDaConversa = temProposta(params);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Cadastro"
          title="Nova dívida"
          description={
            veioDaConversa
              ? 'Preenchi com o que entendi da nossa conversa. Confira antes de salvar.'
              : 'Só o que você já sabe. O resto o buddy ajuda a descobrir.'
          }
        />

        {criar.error ? (
          <Feedback
            tone="error"
            message={
              criar.error instanceof ApiError
                ? criar.error.message
                : 'Não deu para salvar. Tente de novo.'
            }
          />
        ) : null}

        <DividaForm
          inicial={proposta}
          submitLabel="Salvar dívida"
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
