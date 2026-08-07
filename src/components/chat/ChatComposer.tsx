import { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius, shadow, spacing, typography } from '../../theme/theme';

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
        // Placeholder não é rótulo: leitor de tela pode não anunciá-lo, e ele
        // some assim que a pessoa começa a digitar.
        accessibilityLabel="Mensagem"
        placeholder="Escreva aqui…"
        placeholderTextColor={colors.inkSoft}
        multiline
        editable={!disabled}
      />
      <Pressable
        onPress={submit}
        disabled={!podeEnviar}
        accessibilityRole="button"
        accessibilityLabel="Enviar"
        style={[styles.send, !podeEnviar && styles.sendDisabled]}
      >
        <Feather name="send" size={20} color={colors.surface} />
      </Pressable>
    </View>
  );
}

/**
 * Campo em pílula flutuante e botão circular escuro, como no reference. Sem
 * borda superior: o composer flutua sobre a conversa em vez de ser separado
 * dela por uma linha.
 */
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    ...typography.body,
    color: colors.ink,
    ...shadow.float,
  },
  send: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.inkFill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  sendDisabled: { opacity: 0.4 },
});
