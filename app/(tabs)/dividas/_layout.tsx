import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/theme';

/** Pilha da aba de dívidas. M1 acrescenta [id].tsx e nova.tsx aqui. */
export default function DividasLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
