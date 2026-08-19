import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatScreen } from '../../src/screens/ChatScreen';
import { TopbarMarca } from '../../src/components/rota/TopbarMarca';
import { colors, spacing } from '../../src/theme/theme';

export default function ChatTab() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/*
        A topbar fica FORA do `ChatScreen`, e não dentro: o chat rola, e o
        wordmark rolando para fora da tela levaria embora o ponto de status
        justamente na aba onde a conversa é longa. Aqui ele fica fixo no topo,
        como nas outras abas.
      */}
      <View style={styles.topo}>
        <TopbarMarca />
      </View>
      <ChatScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // O `ChatScreen` cuida do próprio respiro horizontal; a topbar precisa do
  // dela, senão o wordmark encosta na borda.
  topo: { paddingHorizontal: spacing.lg },
});
