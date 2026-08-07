import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { FormField } from '../../../src/components/ui/FormField';
import { Feedback } from '../../../src/components/ui/Feedback';
import { clearToken, setToken } from '../../../src/api/client';
import { colors, spacing, typography } from '../../../src/theme/theme';

/**
 * Tela de configuração de beta, não de produto.
 *
 * O backend exige `Authorization: Bearer` e o app nunca tinha como enviar —
 * `setToken` existia em src/api/client.ts e ninguém o chamava. Sai quando
 * entrar login de verdade (Fase 5).
 */
export default function ConfigurarToken() {
  const router = useRouter();
  const { valor } = useLocalSearchParams<{ valor?: string }>();
  const [token, setValor] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const jaAplicou = useRef(false);

  /**
   * Entrada por deep link (`npm run token:qr`): a câmera do celular abre esta
   * tela já com o token, porque digitar 43 caracteres à mão não é um caminho
   * que alguém percorre até o fim.
   *
   * Só em `__DEV__`. Um build de produção que aceitasse token por URL deixaria
   * qualquer link definir com quem o app fala.
   */
  useEffect(() => {
    if (!__DEV__ || !valor || jaAplicou.current) return;
    jaAplicou.current = true;
    setSalvando(true);
    setToken(valor)
      .then(() => setSalvo(true))
      .catch(() => setErro('Não deu para guardar o token neste aparelho.'))
      .finally(() => setSalvando(false));
  }, [valor]);

  async function salvar() {
    const limpo = token.trim();
    if (!limpo) {
      setErro('Cole o token do servidor.');
      return;
    }
    setErro(undefined);
    setSalvando(true);
    try {
      await setToken(limpo);
      setSalvo(true);
      setValor('');
    } finally {
      setSalvando(false);
    }
  }

  async function limpar() {
    await clearToken();
    setSalvo(false);
    setValor('');
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Beta"
          title="Conexão com o servidor"
          description="Cole aqui o token que está no .env do backend para o app conseguir falar com ele."
        />

        <Card>
          <Text style={styles.explicacao}>
            O token fica guardado com criptografia no aparelho e nunca aparece em tela depois de
            salvo. É uma medida temporária de beta — quando houver login, esta tela some.
          </Text>
        </Card>

        {salvo ? (
          <Feedback
            tone="success"
            message="Token salvo. Volte ao painel ou às dívidas para carregar seus dados."
          />
        ) : null}

        <View style={styles.form}>
          <FormField
            label="Token"
            value={token}
            onChangeText={setValor}
            error={erro}
            placeholder="Cole o valor de BUDDY_API_TOKEN"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <Button label="Salvar token" onPress={salvar} loading={salvando} />
          <Button label="Apagar token salvo" onPress={limpar} variant="ghost" />
          <Button label="Voltar ao painel" onPress={() => router.back()} variant="ghost" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  explicacao: { ...typography.caption, color: colors.inkSoft },
  form: { gap: spacing.md },
});
