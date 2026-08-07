import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from './Button';
import { Feedback } from './Feedback';
import { ApiError, ehPaywall } from '../../api/client';
import { spacing } from '../../theme/theme';

interface Props {
  error: unknown;
  /** Frase para o que não é `ApiError` — rede caída, erro sem corpo. */
  fallback?: string;
}

/**
 * O erro de uma escrita, com o caminho de saída quando ele é o paywall.
 *
 * POR QUE UM COMPONENTE, e não um tratamento central em `src/api/client.ts`: o
 * 402 não tem uma resposta só. Ele acontece no meio de uma ação concreta —
 * cadastrar uma dívida, fechar o mês, mandar uma mensagem —, e a única coisa
 * certa a fazer é dizer o que houve ali mesmo e oferecer o caminho, sem tirar
 * a pessoa da tela e sem perder o que ela digitou. O `client.ts` não sabe qual
 * ação era, e adivinharia navegando para longe dela.
 *
 * A MENSAGEM VEM DO SERVIDOR. Ele já responde em pt-BR e para leigo (`erro_http`
 * em `main.py`), e reescrevê-la aqui criaria uma segunda cópia da mesma frase
 * para divergir na primeira mudança.
 *
 * `warning` e não `error` no caso do paywall (guardrail 4): não deu errado —
 * está fora do plano. Vermelho aqui trataria "sua assinatura venceu" como falha
 * do usuário.
 */
export function ErroDeMutacao({ error, fallback = 'Não deu para salvar. Tente de novo.' }: Props) {
  const router = useRouter();

  if (!error) return null;

  const mensagem = error instanceof ApiError ? error.message : fallback;

  if (!ehPaywall(error)) {
    return <Feedback tone="error" message={mensagem} />;
  }

  return (
    <View style={styles.bloco}>
      <Feedback tone="warning" message={mensagem} />
      <Button label="Ver assinatura" onPress={() => router.push('/painel/assinatura')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: spacing.md },
});
