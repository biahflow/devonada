import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/ui/FormField';
import { Feedback } from '../../src/components/ui/Feedback';
import { useEntrar } from '../../src/hooks/useConta';
import { ApiError } from '../../src/api/client';
import { colors, spacing, typography } from '../../src/theme/theme';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLocal, setErroLocal] = useState<string | undefined>();
  const entrar = useEntrar();

  function submeter() {
    if (!email.trim() || !senha) {
      setErroLocal('Preencha o e-mail e a senha.');
      return;
    }
    setErroLocal(undefined);
    // `replace`, não `push`: o botão de voltar do Android levaria de volta ao
    // login depois de entrar.
    entrar.mutate({ email, senha }, { onSuccess: () => router.replace('/') });
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Buddy Financeiro"
          title="Entrar"
          description="Suas dívidas, seu caixa e suas conversas ficam guardados na sua conta."
        />

        {entrar.error ? (
          <Feedback
            tone="error"
            message={
              entrar.error instanceof ApiError
                ? entrar.error.message
                : 'Não deu para entrar agora. Tente de novo.'
            }
          />
        ) : null}

        <View style={styles.form}>
          <FormField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            error={erroLocal}
            placeholder="voce@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
          />

          <FormField
            label="Senha"
            value={senha}
            onChangeText={setSenha}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            // Sem isto, o gerenciador de senhas do sistema não se oferece para
            // preencher nem para salvar.
            textContentType="password"
            onSubmitEditing={submeter}
          />

          <Button label="Entrar" onPress={submeter} loading={entrar.isPending} size="lg" />

          <Button
            label="Esqueci minha senha"
            onPress={() => router.push('/esqueci-senha')}
            variant="ghost"
          />
        </View>

        <View style={styles.rodape}>
          <Text style={styles.explicacao}>Ainda não tem conta?</Text>
          <Button label="Criar conta" onPress={() => router.push('/registro')} variant="secondary" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  form: { gap: spacing.lg },
  rodape: { gap: spacing.sm, marginTop: spacing.xl, alignItems: 'stretch' },
  explicacao: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
});
