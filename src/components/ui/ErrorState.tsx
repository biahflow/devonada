import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { ApiError } from '../../api/client';
import { env } from '../../config/env';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../../theme/theme';

interface Props {
  error: unknown;
  onRetry?: () => void;
}

/**
 * Distingue "sem conexão" (ApiError.status 0) de falha do servidor, porque a
 * ação do usuário é diferente em cada caso. Este é o único componente de ui/
 * que conhece um tipo da camada de api/ — o formato do erro é, aqui,
 * informação de apresentação.
 */
function describe(error: unknown): { title: string; message: string } {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      // Raro depois do M8: um 401 só chega até aqui se a renovação silenciosa
      // falhou, e nesse caso `client.ts` já derrubou a sessão e o `_layout` já
      // está levando a pessoa ao login. A frase existe para o instante entre as
      // duas coisas — e não manda procurar nada, porque não há o que fazer.
      return {
        title: 'Sua sessão terminou',
        message: 'Estamos levando você de volta à tela de entrada.',
      };
    }
    if (error.status === 0) {
      return {
        title: 'Sem conexão',
        message: 'Confira sua internet e tente de novo. Nada do que você fez foi perdido.',
      };
    }
    if (error.status === 404) {
      // 404 tem dois sentidos reais: o recurso sumiu, ou o app está falando com
      // um servidor que não é o do devo.nada. A dica de ambiente só existe em
      // desenvolvimento — foi o que faltou para diagnosticar rápido quando outro
      // projeto ocupou a porta 8000 e respondeu 404 em tudo.
      return {
        title: 'Não encontramos isso',
        message: __DEV__
          ? `Pode ter sido removido, ou o app não está falando com o servidor certo.\n\nAPI: ${env.apiBaseUrl}`
          : 'Pode ter sido removido, ou o app não está conseguindo falar com o servidor certo.',
      };
    }
    if (error.status >= 500) {
      return {
        title: 'O servidor tropeçou',
        message: 'Não foi culpa sua. Tente de novo em instantes.',
      };
    }
    return { title: 'Não deu certo', message: error.message };
  }
  return { title: 'Não deu certo', message: 'Algo saiu do esperado. Tente de novo.' };
}

export function ErrorState({ error, onRetry }: Props) {
  const { title, message } = describe(error);
  const sessaoAcabou = error instanceof ApiError && error.status === 401;

  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.iconCircle}>
        <Feather name="cloud-off" size={24} color={colors.inkSoft} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {/* Sem sessão, "tentar de novo" só repete o 401 — e o redirecionamento
          para o login já está a caminho. Oferecer o botão convidaria a insistir
          numa ação que não pode dar certo. */}
      {onRetry && !sessaoAcabou ? (
        <Button label="Tentar de novo" onPress={onRetry} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.title, color: colors.ink, textAlign: 'center' },
  message: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
  action: { marginTop: spacing.md, alignSelf: 'stretch' },
  actionSecundaria: { alignSelf: 'stretch' },
});
