import { useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/ui/FormField';
import { Feedback } from '../../src/components/ui/Feedback';
import { usePedirCodigo } from '../../src/hooks/useConta';
import { spacing } from '../../src/theme/theme';

export default function EsqueciSenha() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const pedir = usePedirCodigo();

  function submeter() {
    if (!email.includes('@')) {
      setErro('Confira o e-mail.');
      return;
    }
    setErro(undefined);
    pedir.mutate(email, {
      // Sucesso e "e-mail não existe" são a mesma resposta do servidor, então
      // são o mesmo caminho aqui. A tela seguinte não afirma que o código foi
      // enviado — ela pede o código, que é o que a pessoa faria de qualquer
      // forma se ele tivesse chegado.
      onSuccess: () => router.push({ pathname: '/redefinir-senha', params: { email } }),
    });
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
          title="Esqueci minha senha"
          description="Enviamos um código de 6 dígitos para o seu e-mail. Ele vale por 30 minutos."
        />

        {pedir.error ? (
          <Feedback tone="error" message="Não deu para pedir o código agora. Tente de novo." />
        ) : null}

        <View style={styles.form}>
          <FormField
            label="E-mail da conta"
            value={email}
            onChangeText={setEmail}
            error={erro}
            placeholder="voce@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            onSubmitEditing={submeter}
          />

          <Button label="Enviar código" onPress={submeter} loading={pedir.isPending} size="lg" />
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
