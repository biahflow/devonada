import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { ChatMessage } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * As duas bolhas são CLARAS, como no reference: o assistente em `neutralSurface`
 * e o usuário num tinto de teal. Quem identifica o assistente é a marca ao lado
 * da bolha, não a cor de fundo dela — uma bolha sólida de cor de ação num app de
 * dívida pesa mais do que precisa.
 */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser ? (
        <View style={styles.marca} accessibilityElementsHidden>
          <Feather name="trending-down" size={14} color={colors.primary} />
        </View>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={styles.text}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  marca: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  userBubble: { backgroundColor: colors.primarySurface },
  assistantBubble: { backgroundColor: colors.neutralSurface },
  text: { ...typography.body, color: colors.ink },
});
