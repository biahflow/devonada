import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/theme';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled }: Props) {
  const [value, setValue] = useState('');

  function submit() {
    const texto = value.trim();
    if (!texto) return;
    onSend(texto);
    setValue('');
  }

  const podeEnviar = value.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder="Escreva aqui…"
        placeholderTextColor={colors.inkSoft}
        multiline
        editable={!disabled}
      />
      <Pressable
        onPress={submit}
        disabled={!podeEnviar}
        accessibilityRole="button"
        style={[styles.send, !podeEnviar && styles.sendDisabled]}
      >
        <Text style={styles.sendText}>Enviar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
  send: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { ...typography.bodyStrong, color: colors.userBubbleText },
});
