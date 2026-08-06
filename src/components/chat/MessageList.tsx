import { useRef } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import type { ChatMessage } from '../../api/types';
import { MessageBubble } from './MessageBubble';
import { ActionCard } from '../cards/ActionCard';
import { spacing } from '../../theme/theme';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const ref = useRef<FlatList<ChatMessage>>(null);

  return (
    <FlatList
      ref={ref}
      data={messages}
      keyExtractor={(m) => m.id}
      contentContainerStyle={styles.content}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
      renderItem={({ item }) => (
        <View>
          <MessageBubble message={item} />
          {item.cards?.map((card, i) => (
            <View key={i} style={styles.cardWrap}>
              <ActionCard card={card} />
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.md },
  cardWrap: { paddingHorizontal: spacing.lg, marginTop: spacing.xs, marginBottom: spacing.sm },
});
