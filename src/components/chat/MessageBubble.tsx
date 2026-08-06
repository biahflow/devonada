import { View, Text, StyleSheet } from 'react-native';
import type { ChatMessage } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: spacing.xs, paddingHorizontal: spacing.lg },
  rowUser: { alignItems: 'flex-end' },
  rowAssistant: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: '86%',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { ...typography.body },
  userText: { color: colors.onPrimary },
  assistantText: { color: colors.ink },
});
