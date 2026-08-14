import { Stack } from 'expo-router';
import { colors } from '../../src/theme/theme';

/**
 * A entrada pelo alívio.
 *
 * SEM BARRA DE ABAS, de propósito: quem está aqui ainda não tem o que ver nas
 * outras abas, e uma barra cheia de destinos vazios no primeiro minuto de uso
 * é convite a se perder. A pessoa sai daqui com uma dívida cadastrada e uma
 * leitura sobre ela — aí as abas passam a ter conteúdo.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/*
        A TRIAGEM É TERMINAL, E O GESTO PRECISA SABER DISSO. Ela é alcançada por
        `replace`, então a pilha fica [divida, triagem] e o swipe-back cairia em
        "Qual dívida tira seu sono?" — com a dívida já cadastrada, o que lê como
        "o app me mandou cadastrar de novo". Todas as saídas da triagem são
        `replace` de propósito; o gesto passa a respeitar isso (ADR 0016).
      */}
      <Stack.Screen name="triagem" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
