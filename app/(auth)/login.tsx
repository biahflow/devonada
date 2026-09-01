import { useEffect, useState } from 'react';
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
import { useEntrar, useEntrarComProvedor } from '../../src/hooks/useConta';
import { ErroSocial, provedoresDisponiveis } from '../../src/social';
import type { ProvedorSocial } from '../../src/api/types';
import { ApiError } from '../../src/api/client';
import { colors, spacing, typography } from '../../src/theme/theme';

/**
 * Entrar / criar conta — a tela 11 da concepção.
 *
 * SOCIAL PRIMEIRO NA ORDEM VISUAL, e-mail depois do divisor. Não é modismo: quem
 * chega aqui está ansioso e cada campo é uma chance de desistir. Os dois botões
 * de cima existem no desenho porque um dia serão o caminho de menor esforço.
 *
 * ELES FUNCIONAM DESDE O M13 (ADR 0023) — quando o aparelho e a configuração
 * permitem. Quem responde por isso é `src/social/provedoresDisponiveis()`: a
 * Apple pergunta ao próprio aparelho (`isAvailableAsync`, que é falso no Expo Go
 * e no Android), e o Google depende do client id estar configurado.
 *
 * O QUE NÃO ESTÁ DISPONÍVEL NÃO APARECE COMO BOTÃO MORTO. Com nenhum dos dois
 * disponíveis, a tela volta ao par desligado com a legenda — que é o estado de
 * quem abre no Expo Go ou antes de as credenciais existirem. Botão que aceita o
 * toque e não faz nada é pior que botão apagado; botão apagado ao lado de um
 * aceso, pior ainda, porque parece defeito.
 *
 * A CONCEPÇÃO MOSTRAVA UM CAMPO SÓ ("Entrar com e-mail"), o que sugere link
 * mágico. O backend é e-mail + senha (`POST /v1/auth/login`). Os dois campos ficam
 * abaixo do divisor: preserva a ordem da tela sem inventar um fluxo que o
 * servidor não tem.
 */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erroLocal, setErroLocal] = useState<string | undefined>();
  // `null` é AINDA PERGUNTANDO, e é diferente de lista vazia. Com os dois
  // colapsados num só, quem tem a Apple disponível via o par desligado e a
  // legenda 'chega com a publicação nas lojas' piscarem antes do botão de
  // verdade aparecer — a tela afirmava por um instante o contrário do que ia
  // mostrar. Perguntando, o bloco social não desenha nada.
  const [sociais, setSociais] = useState<ProvedorSocial[] | null>(null);
  const entrar = useEntrar();
  const entrarPorProvedor = useEntrarComProvedor();

  // A disponibilidade é uma pergunta ao aparelho, e ela é assíncrona: quem sabe
  // se há Sign in with Apple neste binário é o próprio aparelho.
  useEffect(() => {
    let vivo = true;
    provedoresDisponiveis()
      .then((lista) => {
        if (vivo) setSociais(lista);
      })
      // Falhar em PERGUNTAR é o mesmo que não ter: a tela cai no par desligado
      // com a legenda, em vez de ficar em branco para sempre.
      .catch(() => {
        if (vivo) setSociais([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  function entrarCom(provedor: ProvedorSocial) {
    setErroLocal(undefined);
    entrarPorProvedor.mutate(provedor, {
      onSuccess: (resultado) => {
        // Cancelou a folha do provedor: nada acontece, e nada é dito.
        if (!resultado.cancelado) router.replace('/');
      },
    });
  }

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

  const erroDeEntrada = mensagemDeErro(entrar.error) ?? mensagemDeErro(entrarPorProvedor.error);

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
          {sociais === null ? null : sociais.length === 0 ? (
            <>
              <BotaoSocial provedor="apple" label="Continuar com Apple" />
              <BotaoSocial provedor="google" label="Continuar com Google" />
              <Text style={styles.legendaSocial}>
                Entrar pela Apple ou pelo Google chega com a publicação nas lojas. Por enquanto, é
                por e-mail.
              </Text>
            </>
          ) : (
            sociais.map((provedor) => (
              <BotaoSocial
                key={provedor}
                provedor={provedor}
                label={provedor === 'apple' ? 'Continuar com Apple' : 'Continuar com Google'}
                onPress={() => entrarCom(provedor)}
                // Os dois se desligam juntos enquanto um deles está em voo: dois
                // fluxos de identidade abertos ao mesmo tempo terminariam em duas
                // sessões, e a última a chegar sobrescreveria a outra em silêncio.
                disabled={entrarPorProvedor.isPending}
              />
            ))
          )}
        </View>

        <Divisor />

        {/* UM LUGAR SÓ PARA O ERRO das três entradas. A frase do servidor vem
            do `ApiError`; a do provedor, do `ErroSocial`, que já nasce em pt-BR
            dentro de `src/social/`. O `else` genérico cobre queda de rede. */}
        {erroDeEntrada ? <Feedback tone="error" message={erroDeEntrada} /> : null}

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

/**
 * A frase que a tela mostra para um erro de entrada.
 *
 * `ApiError` e `ErroSocial` já trazem texto em pt-BR pensado para leigo — o
 * primeiro veio do servidor, o segundo de `src/social/`. Qualquer outra coisa é
 * falha de rede ou defeito, e aí a frase é nossa: mostrar `e.message` cru
 * colocaria "Network request failed" na cara de quem está ansioso.
 */
function mensagemDeErro(erro: unknown): string | undefined {
  if (!erro) return undefined;
  if (erro instanceof ApiError || erro instanceof ErroSocial) return erro.message;
  return 'Não deu para entrar agora. Tente de novo.';
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
