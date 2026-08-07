import { Stack } from 'expo-router';
import { colors } from '../../src/theme/theme';

/**
 * As telas de conta ficam FORA de `(tabs)/`, de propósito.
 *
 * Login com a barra de abas embaixo é convite a tocar numa aba que vai 401ar —
 * e mostrar quatro abas de dado financeiro a quem ainda não entrou anuncia um
 * app que a pessoa ainda não tem.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
