import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** Insets fixos: sem métricas reais de aparelho, o SafeAreaProvider trava. */
const METRICAS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Renderiza uma ROTA como o app a monta: com cache de servidor e safe area.
 *
 * `retry: false` porque em teste retentar só faz esperar — a política real está
 * em app/_layout.tsx e é exercitada em produção, não aqui.
 */
export function renderizarTela(tela: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider initialMetrics={METRICAS}>{tela}</SafeAreaProvider>
    </QueryClientProvider>,
  );
}
