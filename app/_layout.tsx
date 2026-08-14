import { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { ApiError } from '../src/api/client';
import { carregarSessao, useSessao } from '../src/api/sessao';
import { SplashDevoNada } from '../src/components/SplashDevoNada';
import { useResumo } from '../src/hooks/usePainel';
import { mesAtual } from '../src/util/mes';
import { colors } from '../src/theme/theme';

/** Piso de exibição da splash. Ver o comentário em `RootLayout`. */
const MINIMO_SPLASH_MS = 900;

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
  const primeiroAcesso = usePrimeiroAcesso();

  // Sem sessão, nenhuma tela de dado financeiro chega a montar (RF-001).
  if (sessao === 'anonimo') return <Redirect href="/login" />;

  // QUEM NÃO TEM DÍVIDA CADASTRADA ENTRA PELO ALÍVIO, e não pelas abas: quatro
  // abas vazias no primeiro minuto de uso não dizem à pessoa o que fazer, e
  // "o que eu faço agora" é o princípio nº 3 da marca.
  //
  // O gatilho é DERIVADO do resumo, sem flag e sem coluna nova: `quantidade
  // Dividas === 0` já é a pergunta que interessa. Uma flag de "já viu o
  // onboarding" mentiria para quem apagou tudo e recomeçou — e essa pessoa
  // merece a mesma acolhida da primeira vez.
  if (primeiroAcesso) return <Redirect href="/(onboarding)/divida" />;
  return null;
}

/**
 * `true` só quando temos CERTEZA de que não há dívida. Enquanto o resumo
 * carrega, devolve `false` — mandar para o onboarding e voltar meio segundo
 * depois seria pior que esperar.
 */
function usePrimeiroAcesso(): boolean {
  const [mes] = useState(() => mesAtual());
  const { resumo, isPending } = useResumo(mes);
  return !isPending && resumo?.quantidadeDividas === 0;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    ArchivoBlack_400Regular,
  });
  const sessao = useSessao();

  useEffect(() => {
    carregarSessao();
  }, []);

  const carregado = (fontsLoaded || fontError) && sessao !== 'carregando';

  // A MARCA PRECISA DE UM INSTANTE, e este é o custo declarado dela.
  //
  // O trabalho real de abertura (fonte + leitura do SecureStore) leva poucas
  // dezenas de milissegundos, então mostrar a splash "enquanto carrega" a faria
  // PISCAR — e um lampejo de meio quadro lê como glitch, não como marca. Daí o
  // piso: ela fica no ar por `MINIMO_SPLASH_MS` mesmo quando já está tudo
  // pronto.
  //
  // É fricção que o usuário paga em todo cold start, e ela se justifica em um
  // produto onde a identidade INTEIRA é um ponto que muda de cor: é aqui que a
  // pessoa aprende a ler esse ponto. Se um dia a abertura passar a fazer
  // trabalho de verdade, este piso deve sair — ele existe porque não faz.
  const [tempoMinimo, setTempoMinimo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTempoMinimo(true), MINIMO_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  const pronto = carregado && tempoMinimo;

  useEffect(() => {
    // A splash NATIVA sai assim que a fonte carrega, e não quando o app está
    // pronto: quem assume a tela a partir daí é a `SplashDevoNada`, que é a
    // mesma imagem com o ponto vivo. Esperar `pronto` deixaria o PNG antigo da
    // marca anterior no ar por mais tempo do que o necessário.
    //
    // Falha ao carregar a fonte não impede o uso do app — cai no fallback de
    // sistema. Segurar a splash para sempre seria pior que uma fonte diferente.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!pronto) return <SplashDevoNada />;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="light" />
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
