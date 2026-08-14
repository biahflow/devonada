import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/theme';

export default function MetasLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
