import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/ui/FormField';
import { Feedback } from '../../src/components/ui/Feedback';
import { useRedefinirSenha } from '../../src/hooks/useConta';
import { ApiError } from '../../src/api/client';
import { spacing } from '../../src/theme/theme';

const SENHA_MINIMA = 8;

export default function RedefinirSenha() {
  const router = useRouter();
  const { email: emailDaRota } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailDaRota ?? '');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<{ codigo?: string; senha?: string }>({});
  const redefinir = useRedefinirSenha();

  function submeter() {
    const novos: typeof erros = {};
    if (!/^\d{6}$/.test(codigo)) novos.codigo = 'O código tem 6 dígitos.';
    if (senha.length < SENHA_MINIMA) novos.senha = `Use pelo menos ${SENHA_MINIMA} caracteres.`;

    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    // Redefinir já abre sessão — a pessoa acabou de provar quem é duas vezes, e
    // mandá-la digitar a senha nova no login em seguida seria cerimônia.
    redefinir.mutate({ email, codigo, senha }, { onSuccess: () => router.replace('/') });
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
          title="Nova senha"
          description="Se esse e-mail estiver cadastrado, o código chega em instantes. Confira também o spam."
        />

        {redefinir.error ? (
          <Feedback
            tone="error"
            message={
              redefinir.error instanceof ApiError
                ? redefinir.error.message
                : 'Não deu para redefinir agora. Tente de novo.'
            }
          />
        ) : null}

        <View style={styles.form}>
          <FormField
            label="E-mail da conta"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <FormField
            label="Código de 6 dígitos"
            value={codigo}
            onChangeText={setCodigo}
            error={erros.codigo}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />

          <FormField
            label="Nova senha"
            value={senha}
            onChangeText={setSenha}
            error={erros.senha}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            hint="Trocar a senha encerra a sessão em todos os aparelhos."
            onSubmitEditing={submeter}
          />

          <Button
            label="Salvar nova senha"
            onPress={submeter}
            loading={redefinir.isPending}
            size="lg"
          />
          <Button label="Voltar" onPress={() => router.back()} variant="ghost" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  form: { gap: spacing.lg },
});
