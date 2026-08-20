import { KeyboardAvoidingView, Platform, View, Text, StyleSheet } from 'react-native';
import { useChat } from '../hooks/useChat';
import { MessageList } from '../components/chat/MessageList';
import { ChatComposer } from '../components/chat/ChatComposer';
import { LoadingState } from '../components/ui/LoadingState';
import { colors, spacing, typography } from '../theme/theme';

export function ChatScreen() {
  const { messages, carregando, sending, error, send } = useChat();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Seu buddy financeiro</Text>
        <Text style={styles.subtitle}>Um passo de cada vez.</Text>
      </View>

      <View style={styles.flex}>
        {carregando ? (
          <LoadingState label="Retomando a conversa" />
        ) : (
          <MessageList messages={messages} />
        )}
      </View>

      {/* Faixa, e não ErrorState de tela cheia: mesmo sem histórico dá para
          conversar. Nenhum erro daqui ganha ação — o 401, que era o único que
          ganhava, deixou de precisar: a sessão se renova sozinha, e quando não
          dá, o app já está indo para o login. */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error.texto}</Text>
        </View>
      ) : null}

      <ChatComposer onSend={send} disabled={sending} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.title, color: colors.ink },
  subtitle: { ...typography.caption, color: colors.inkSoft },
  errorBox: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  error: {
    ...typography.caption,
    color: colors.dangerText,
    textAlign: 'center',
  },
});
