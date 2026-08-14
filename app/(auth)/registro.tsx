import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { Brand } from '../../src/components/ui/Brand';
import { NotaDePrivacidade } from '../../src/components/ui/NotaDePrivacidade';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/ui/FormField';
import { Feedback } from '../../src/components/ui/Feedback';
import { BotaoSocial } from '../../src/components/auth/BotaoSocial';
import { Divisor } from '../../src/components/auth/Divisor';
import { useRegistrar } from '../../src/hooks/useConta';
import { ApiError } from '../../src/api/client';
import { colors, spacing, typography } from '../../src/theme/theme';

/** O mesmo mínimo do servidor. A validação local é conveniência; a regra é lá. */
const SENHA_MINIMA = 8;

export default function Registro() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<{ email?: string; senha?: string; confirmacao?: string }>({});
  const registrar = useRegistrar();

  function submeter() {
    const novos: typeof erros = {};
    if (!email.includes('@')) novos.email = 'Confira o e-mail.';
    if (senha.length < SENHA_MINIMA)
      novos.senha = `Use pelo menos ${SENHA_MINIMA} caracteres.`;
    if (senha !== confirmacao) novos.confirmacao = 'As duas senhas precisam ser iguais.';

    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    registrar.mutate({ email, senha }, { onSuccess: () => router.replace('/') });
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.marca}>
          <Brand size="md" />
        </View>

        <View style={styles.chamada}>
          <Text style={styles.titulo}>Sua rota{'\n'}começa aqui.</Text>
          <Text style={styles.subtitulo}>
            É o que permite abrir o app em outro aparelho e não perder o que você já preencheu.
          </Text>
        </View>

        {/* Mesmo par da tela de entrar, pela mesma razão: as duas telas não
            podem divergir na ordem nem na promessa. Ver `BotaoSocial`. */}
        <View style={styles.social}>
          <BotaoSocial provedor="apple" label="Continuar com Apple" />
          <BotaoSocial provedor="google" label="Continuar com Google" />
          <Text style={styles.legendaSocial}>
            Criar conta pela Apple ou pelo Google chega com a publicação nas lojas. Por enquanto, é
            por e-mail.
          </Text>
        </View>

        <Divisor />

        {registrar.error ? (
          <Feedback
            tone="error"
            message={
              registrar.error instanceof ApiError
                ? registrar.error.message
                : 'Não deu para criar a conta agora. Tente de novo.'
            }
          />
        ) : null}

        <View style={styles.form}>
          <FormField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            error={erros.email}
            placeholder="voce@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            hint="É por ele que você recupera o acesso se esquecer a senha."
          />

          <FormField
            label="Senha"
            value={senha}
            onChangeText={setSenha}
            error={erros.senha}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            hint={`No mínimo ${SENHA_MINIMA} caracteres. Uma frase que só você lembra funciona melhor que símbolos.`}
          />

          <FormField
            label="Repita a senha"
            value={confirmacao}
            onChangeText={setConfirmacao}
            error={erros.confirmacao}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={submeter}
          />

          <Button label="Criar conta" onPress={submeter} loading={registrar.isPending} size="lg" />
          <Button label="Já tenho conta" onPress={() => router.back()} variant="ghost" />
        </View>

        <Card>
          <Text style={styles.explicacao}>
            Guardamos o que você cadastra aqui — dívidas, renda e gastos — para montar seus planos.
            Você pode apagar tudo a qualquer momento, pelo próprio app.
          </Text>
        </Card>

        <NotaDePrivacidade />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  marca: { alignItems: 'flex-start', marginTop: spacing.sm },
  chamada: { gap: spacing.sm },
  titulo: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.9,
    color: colors.ink,
  },
  subtitulo: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  social: { gap: spacing.sm },
  legendaSocial: { ...typography.caption, color: colors.inkSoft, lineHeight: 18 },
  form: { gap: spacing.lg },
  explicacao: { ...typography.caption, color: colors.inkSoft },
});
