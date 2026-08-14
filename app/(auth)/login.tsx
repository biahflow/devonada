import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { Brand } from '../../src/components/ui/Brand';
import { NotaDePrivacidade } from '../../src/components/ui/NotaDePrivacidade';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/ui/FormField';
import { Feedback } from '../../src/components/ui/Feedback';
import { BotaoSocial } from '../../src/components/auth/BotaoSocial';
import { Divisor } from '../../src/components/auth/Divisor';
import { useEntrar } from '../../src/hooks/useConta';
import { ApiError } from '../../src/api/client';
import { colors, spacing, typography } from '../../src/theme/theme';

/**
 * Entrar / criar conta — a tela 11 da concepção.
 *
 * SOCIAL PRIMEIRO NA ORDEM VISUAL, e-mail depois do divisor. Não é modismo: quem
 * chega aqui está ansioso e cada campo é uma chance de desistir. Os dois botões
 * de cima existem no desenho porque um dia serão o caminho de menor esforço.
 *
 * ELES AINDA NÃO FUNCIONAM, e a tela não finge que funcionam — ver
 * `BotaoSocial`. Não há Sign in with Apple nem Google Sign-In no backend, então
 * nascem `disabled` com a legenda dizendo o porquê.
 *
 * A CONCEPÇÃO MOSTRAVA UM CAMPO SÓ ("Entrar com e-mail"), o que sugere link
 * mágico. O backend é e-mail + senha (`POST /v1/sessao`). Os dois campos ficam
 * abaixo do divisor: preserva a ordem da tela sem inventar um fluxo que o
 * servidor não tem.
 */
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
        {/* O wordmark, e não um `PageHeader` com "devo.nada" escrito em
            eyebrow: aqui a marca precisa aparecer como marca, com o ponto. Ele
            fica `neutro` porque ainda não há sessão — e portanto nada a
            reportar sobre a rota de ninguém. */}
        <View style={styles.marca}>
          <Brand size="md" />
        </View>

        <View style={styles.chamada}>
          <Text style={styles.titulo}>Vamos começar{'\n'}sua rota.</Text>
          <Text style={styles.subtitulo}>
            Sem julgamento, sem burocracia. Em 3 minutos você já sabe quanto sua dívida realmente
            vale.
          </Text>
        </View>

        <View style={styles.social}>
          <BotaoSocial provedor="apple" label="Continuar com Apple" />
          <BotaoSocial provedor="google" label="Continuar com Google" />
          <Text style={styles.legendaSocial}>
            Entrar pela Apple ou pelo Google chega com a publicação nas lojas. Por enquanto, é por
            e-mail.
          </Text>
        </View>

        <Divisor />

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

          <Button label="Entrar com e-mail" onPress={submeter} loading={entrar.isPending} size="lg" />

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

        <NotaDePrivacidade />

        {/* SEM LINK, de propósito: não existe URL de termos nem de política em
            `src/config/env.ts`, `app.json` ou `.env.example` — a única página
            pública do backend é `/exclusao`. Link que não vai a lugar nenhum é
            pior que a frase sozinha. Vira link quando as páginas existirem. */}
        <Text style={styles.legal}>
          Ao continuar você aceita os Termos e a Política de Privacidade.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  marca: { alignItems: 'flex-start', marginTop: spacing.sm },
  chamada: { gap: spacing.sm },
  // Archivo Black, porque é chamada de impacto em duas linhas — o único lugar
  // fora de número onde a display entra (design-system, seção 3).
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
  rodape: { gap: spacing.sm, marginTop: spacing.xl, alignItems: 'stretch' },
  explicacao: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
  legal: { ...typography.caption, color: colors.inkSoft, textAlign: 'center', lineHeight: 18 },
});
