import { Stack } from 'expo-router';
import { colors } from '../../src/theme/theme';

/**
 * A celebração, fora do grupo de abas.
 *
 * SEM BARRA DE ABAS, de propósito: uma barra de destinos embaixo de uma tela de
 * celebração a transforma em modal decorativo — a pessoa toca em qualquer aba e
 * a conquista some sem nunca ter sido reconhecida (docs/design-system.md,
 * verbete `MarcoScreen`).
 */
export default function MarcoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/*
        A TELA É TERMINAL, E O GESTO PRECISA SABER DISSO — mesmo raciocínio da
        triagem do onboarding (ADR 0016). Ela é alcançada por `Redirect`, e sair
        dela pelo swipe-back voltaria à pilha anterior SEM gravar `celebradoEm`:
        o marco continuaria pendente e a tela reapareceria na próxima abertura
        do app, que é o modo de falha nomeado por este contrato. As duas saídas
        são os dois botões, e são elas que gravam.
      */}
      <Stack.Screen name="[tipo]" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
