import { useEffect, useState } from 'react';
import { Alert, ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { FormField } from '../../../src/components/ui/FormField';
import { Feedback } from '../../../src/components/ui/Feedback';
import {
  useExcluirConta,
  useExcluirContaComProvedor,
} from '../../../src/hooks/useConta';
import { provedorDaSessao } from '../../../src/api/sessao';
import { ErroSocial } from '../../../src/social';
import type { ProvedorSocial } from '../../../src/api/types';
import { BotaoSocial } from '../../../src/components/auth/BotaoSocial';
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

/**
 * A reconfirmação depende de como esta pessoa entra (M13, ADR 0023).
 *
 * Quem tem senha digita a senha, como sempre. Quem entrou pela Apple ou pelo
 * Google nunca escolheu uma — pedir senha dessa pessoa a deixaria SEM COMO
 * EXCLUIR A CONTA, e um app que oferece login social e não deixa excluir a conta
 * reprova na diretriz 5.1.1(v) da Apple, que é a diretriz que esta tela existe
 * para cumprir. Ela reapresenta o provedor: um toque com biometria ou senha do
 * sistema, mesmo custo de intenção que digitar a senha.
 *
 * QUEM RESPONDE "COMO ESTA PESSOA ENTRA" É O APARELHO, não uma rota: o
 * `src/api/sessao.ts` guarda por onde a sessão foi aberta. `null` significa
 * e-mail e senha — e é também o padrão de quem não sabe, que é o comportamento
 * conservador certo: quem entrou por senha TEM senha.
 */
export default function ExcluirConta() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  // `undefined` é AINDA PERGUNTANDO; `null` é "entra por senha". Colapsar os
  // dois faria o campo de senha piscar na cara de quem entra pela Apple, e a
  // tela afirmaria por um instante o contrário do que ia mostrar.
  const [provedor, setProvedor] = useState<ProvedorSocial | null | undefined>(undefined);
  const excluir = useExcluirConta();
  const excluirPorProvedor = useExcluirContaComProvedor();

  useEffect(() => {
    let vivo = true;
    provedorDaSessao()
      .then((lido) => {
        if (vivo) setProvedor(lido);
      })
      // Falhar em ler cai na senha, que é o caminho de sempre e o conservador:
      // quem entrou por senha tem senha.
      .catch(() => {
        if (vivo) setProvedor(null);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * O alerta nativo vem ANTES do provedor e antes da senha ser conferida: ele é
   * sobre a decisão, e as duas coisas seguintes são sobre a identidade. Inverter
   * faria a pessoa provar quem é para só então descobrir o tamanho do que ia
   * apagar.
   */
  function perguntar(excluirDeVerdade: () => void) {
    // Confirmação nativa além da credencial (guardrails, seção 7.2). É a ação
    // mais destrutiva do produto e não tem desfazer.
    Alert.alert(
      'Excluir sua conta?',
      'Tudo o que você cadastrou é apagado agora e não dá para recuperar depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: excluirDeVerdade },
      ],
    );
  }

  function confirmar() {
    if (!senha) {
      setErro('Digite sua senha para confirmar.');
      return;
    }
    setErro(undefined);

    perguntar(() =>
      excluir.mutate({ senha }, { onSuccess: () => router.replace('/login') }),
    );
  }

  function confirmarPeloProvedor(qual: ProvedorSocial) {
    setErro(undefined);
    perguntar(() =>
      excluirPorProvedor.mutate(qual, {
        onSuccess: (resultado) => {
          // Fechou a folha do provedor: a conta continua lá, e nada é dito.
          if (!resultado.cancelado) router.replace('/login');
        },
      }),
    );
  }

  const erroDaExclusao =
    mensagemDeErro(excluir.error) ?? mensagemDeErro(excluirPorProvedor.error);

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

        {erroDaExclusao ? <Feedback tone="error" message={erroDaExclusao} /> : null}

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
          {provedor === undefined ? null : provedor ? (
            <>
              <Text style={styles.explicacaoProvedor}>
                Você entra {provedor === 'apple' ? 'pela Apple' : 'pelo Google'}, então é por lá que
                confirmamos que é você. Pedimos de novo para que ninguém apague sua conta com o
                celular na sua mão.
              </Text>
              <BotaoSocial
                provedor={provedor}
                label={
                  provedor === 'apple'
                    ? 'Confirmar com a Apple e excluir'
                    : 'Confirmar com o Google e excluir'
                }
                onPress={() => confirmarPeloProvedor(provedor)}
                disabled={excluirPorProvedor.isPending}
              />
            </>
          ) : (
            <>
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
            </>
          )}
          <Button label="Cancelar" onPress={() => router.back()} variant="ghost" />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** A mesma disciplina da tela de entrada: frase do servidor, do provedor, ou a nossa. */
function mensagemDeErro(erro: unknown): string | undefined {
  if (!erro) return undefined;
  if (erro instanceof ApiError || erro instanceof ErroSocial) return erro.message;
  return 'Não deu para excluir agora. Tente de novo.';
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  tituloLista: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  lista: { gap: spacing.xs },
  item: { ...typography.caption, color: colors.inkSoft },
  nota: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.md },
  form: { gap: spacing.lg },
  explicacaoProvedor: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
});
