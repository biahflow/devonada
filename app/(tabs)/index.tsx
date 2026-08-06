import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatScreen } from '../../src/screens/ChatScreen';
import { colors } from '../../src/theme/theme';

export default function ChatTab() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ChatScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
