import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
} from '@expo-google-fonts/nunito-sans';
import { ApiError } from '../src/api/client';
import { carregarSessao, useSessao } from '../src/api/sessao';
import { colors } from '../src/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Em alguns ambientes a splash já foi escondida. Não é motivo para derrubar o app.
});

/**
 * Política de retry alinhada ao ApiError (docs/architecture.md, seção 5).
 * 4xx é erro do cliente — insistir não conserta e só gasta bateria em rede móvel.
 * status 0 (sem conexão) e 5xx merecem até duas tentativas.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) {
    return error.status === 0 || error.status >= 500;
  }
  return false;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
});

/**
 * O redirecionamento vive num filho do `Stack`, e não no `RootLayout`.
 *
 * `expo-router` precisa que a árvore de rotas esteja montada antes de qualquer
 * navegação: devolver `<Redirect>` no lugar do `<Stack>` navegaria para uma rota
 * que ainda não existe.
 */
function PortaDeEntrada() {
  const sessao = useSessao();

  // Sem sessão, nenhuma tela de dado financeiro chega a montar (RF-001).
  if (sessao === 'anonimo') return <Redirect href="/login" />;
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });
  const sessao = useSessao();

  useEffect(() => {
    carregarSessao();
  }, []);

  const pronto = (fontsLoaded || fontError) && sessao !== 'carregando';

  useEffect(() => {
    // Falha ao carregar a fonte não impede o uso do app — cai no fallback de
    // sistema. Segurar a splash para sempre seria pior que uma fonte diferente.
    //
    // A splash também espera a leitura do SecureStore: escondê-la antes faria a
    // tela do app piscar por um instante antes de o login aparecer, para quem
    // não está logado.
    if (pronto) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [pronto]);

  if (!pronto) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
        <PortaDeEntrada />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
