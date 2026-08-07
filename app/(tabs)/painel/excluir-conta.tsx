import { useState } from 'react';
import { Alert, ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { FormField } from '../../../src/components/ui/FormField';
import { Feedback } from '../../../src/components/ui/Feedback';
import { useExcluirConta } from '../../../src/hooks/useConta';
import { ApiError } from '../../../src/api/client';
import { colors, spacing, typography } from '../../../src/theme/theme';

/**
 * O que some. A lista vem ANTES da senha e antes do botão, de propósito: a
 * pessoa decide sabendo o tamanho do que está apagando, não depois.
 */
const O_QUE_SOME = [
  'Suas dívidas, parcelas, pagamentos e renegociações',
  'Seu caixa: renda, gastos, provisões, metas e fechamentos',
  'O que foi lido dos contratos que você enviou',
  'Todo o histórico de conversa com o assistente',
  'Sua conta e o acesso em todos os aparelhos',
];

export default function ExcluirConta() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const excluir = useExcluirConta();

  function confirmar() {
    if (!senha) {
      setErro('Digite sua senha para confirmar.');
      return;
    }
    setErro(undefined);

    // Confirmação nativa além da senha (guardrails, seção 7.2). É a ação mais
    // destrutiva do produto e não tem desfazer.
    Alert.alert(
      'Excluir sua conta?',
      'Tudo o que você cadastrou é apagado agora e não dá para recuperar depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            excluir.mutate(senha, {
              onSuccess: () => router.replace('/login'),
            }),
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
          eyebrow="Sua conta"
          title="Excluir minha conta"
          description="Apaga de vez tudo o que guardamos sobre você. Não é possível desfazer."
        />

        {excluir.error ? (
          <Feedback
            tone="error"
            message={
              excluir.error instanceof ApiError
                ? excluir.error.message
                : 'Não deu para excluir agora. Tente de novo.'
            }
          />
        ) : null}

        <Card>
          <Text style={styles.tituloLista}>O que é apagado</Text>
          <View style={styles.lista}>
            {O_QUE_SOME.map((item) => (
              <Text key={item} style={styles.item}>
                • {item}
              </Text>
            ))}
          </View>
          <Text style={styles.nota}>
            O arquivo do contrato que você envia nunca chega a ser guardado: ele é lido e descartado
            na mesma hora, então não há o que apagar depois.
          </Text>
        </Card>

        <View style={styles.form}>
          <FormField
            label="Sua senha"
            value={senha}
            onChangeText={setSenha}
            error={erro}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            hint="Pedimos de novo para que ninguém apague sua conta com o celular na sua mão."
          />

          <Button
            label="Excluir minha conta"
            onPress={confirmar}
            loading={excluir.isPending}
            variant="danger"
          />
          <Button label="Cancelar" onPress={() => router.back()} variant="ghost" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  tituloLista: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  lista: { gap: spacing.xs },
  item: { ...typography.caption, color: colors.inkSoft },
  nota: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.md },
  form: { gap: spacing.lg },
});
