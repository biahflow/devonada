import { screen, waitFor } from '@testing-library/react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TabBar, corDaFase } from '../components/ui/TabBar';
import { colors } from '../theme/theme';
import { limparMocksDeRede, responderPorRota } from './api';
import { umResumo } from './mocks';
import { renderizarTela } from './render';

afterEach(limparMocksDeRede);

/**
 * A barra de abas nunca teve teste, e foi por isso que ela ignorou `href: null`
 * desde o M12 sem nada reclamar: a única cobertura era da TELA de metas, não da
 * barra. Os quatro gates ficaram verdes o tempo inteiro, e o defeito só apareceu
 * quando alguém abriu o aparelho.
 *
 * HOJE NENHUMA ABA ESTÁ ESCONDIDA — Dívidas e Metas convivem por decisão de
 * produto. O mecanismo continua testado assim mesmo: ele é do componente, não da
 * configuração de agora, e a próxima aba que precisar sumir vai depender dele.
 */

type Aba = { name: string; title: string; escondida?: boolean };

/**
 * Monta as props que o react-navigation entregaria à barra.
 *
 * `tabBarItemStyle: { display: 'none' }` é como o expo-router SINALIZA uma aba
 * escondida — ele consome o `href: null` do layout e o traduz para isto. O teste
 * imita o tradutor, não o `href`, senão exercitaria um contrato que a barra não
 * enxerga.
 */
function props(abas: Aba[], indiceAtivo: number): BottomTabBarProps {
  const routes = abas.map((aba, i) => ({
    key: `${aba.name}-${i}`,
    name: aba.name,
    params: undefined,
  }));

  const descriptors = Object.fromEntries(
    routes.map((route, i) => [
      route.key,
      {
        options: {
          title: abas[i]!.title,
          ...(abas[i]!.escondida ? { tabBarItemStyle: { display: 'none' } } : {}),
        },
      },
    ]),
  );

  return {
    state: { index: indiceAtivo, routes },
    descriptors,
    navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  } as unknown as BottomTabBarProps;
}

/** As cinco abas como o `_layout.tsx` as declara hoje: nenhuma escondida. */
const ABAS = [
  { name: 'painel', title: 'Rota' },
  { name: 'dividas', title: 'Dívidas' },
  { name: 'metas', title: 'Metas' },
  { name: 'index', title: 'Buddy' },
  { name: 'caixa', title: 'Caixa' },
];

/** A mesma barra com uma aba escondida, para exercitar o mecanismo. */
const COM_ESCONDIDA = ABAS.map((aba) =>
  aba.name === 'metas' ? { ...aba, escondida: true } : aba,
);

function comSaldo(totalDevido: number) {
  responderPorRota({ '/v1/dividas/resumo': { resumo: umResumo({ totalDevido, quantidadeDividas: 2 }) } });
}

describe('a barra de abas', () => {
  describe('aba escondida', () => {
    it('desenha as cinco abas quando nenhuma está escondida', async () => {
      comSaldo(500_000);
      renderizarTela(<TabBar {...props(ABAS, 0)} />);

      await waitFor(() => expect(screen.getByText('Rota')).toBeTruthy());
      for (const rotulo of ['Rota', 'Dívidas', 'Metas', 'Buddy', 'Caixa']) {
        expect(screen.getByText(rotulo)).toBeTruthy();
      }
    });

    it('NÃO desenha a aba que o layout escondeu — o defeito que veio do M12', async () => {
      comSaldo(500_000);
      renderizarTela(<TabBar {...props(COM_ESCONDIDA, 0)} />);

      await waitFor(() => expect(screen.getByText('Rota')).toBeTruthy());
      expect(screen.getByText('Dívidas')).toBeTruthy();
      expect(screen.queryByText('Metas')).toBeNull();
    });

    it('esconder uma aba não desloca a marca para a aba errada', async () => {
      comSaldo(500_000);
      // "Buddy" é o índice 3 na lista COMPLETA e o 2 entre as visíveis. Se a
      // barra usar a posição errada, quem acende é outra aba.
      renderizarTela(<TabBar {...props(COM_ESCONDIDA, 3)} />);

      await waitFor(() => expect(screen.getByText('Buddy')).toBeTruthy());
      const buddy = screen.getByLabelText('Buddy');
      expect(buddy.props.accessibilityState.selected).toBe(true);
      expect(screen.getByLabelText('Rota').props.accessibilityState.selected).toBe(false);
    });
  });

  /**
   * A DECISÃO de cor é testada aqui; a PINTURA continua sendo item de device.
   *
   * O ambiente de teste não reavalia o estilo animado quando a cor muda, então
   * um teste sobre a árvore renderizada provaria menos do que aparenta: ele
   * passaria no vermelho por ser o valor inicial, e ficaria vermelho no caso
   * verde por limitação do mock, não do app. Cobrir `corDaFase` é o que de fato
   * protege a decisão — e o que sobra, ver a barra virar verde no aparelho, está
   * declarado como pendência em vez de simulado.
   */
  describe('a cor da fase', () => {
    it('é vermelha enquanto há saldo devedor', () => {
      expect(corDaFase('divida')).toBe(colors.debtText);
    });

    it('vira verde quando a pessoa zera — o app muda de fase junto', () => {
      expect(corDaFase('quitado')).toBe(colors.primary);
    });

    it('conta nova NÃO nasce verde: verde é conquista, não estado inicial', () => {
      expect(corDaFase('neutro')).toBe(colors.debtText);
      expect(corDaFase('neutro')).not.toBe(colors.primary);
    });

    it('não usa o vermelho da MARCA no rótulo — esse fica no ponto do wordmark', () => {
      expect(corDaFase('divida')).not.toBe(colors.debt);
    });

    it('a barra pinta a aba ativa com a cor da fase', async () => {
      comSaldo(500_000);
      const { UNSAFE_root } = renderizarTela(<TabBar {...props(ABAS, 0)} />);

      await waitFor(() => expect(screen.getByText('Rota')).toBeTruthy());
      await waitFor(() =>
        expect(coresDeFundo(UNSAFE_root)).toContain(comoRgba(corDaFase('divida'))),
      );
    });
  });

  describe('sem ícone, por decisão', () => {
    it('o rótulo escrito é o que nomeia cada aba', async () => {
      comSaldo(500_000);
      renderizarTela(<TabBar {...props(ABAS, 0)} />);

      await waitFor(() => expect(screen.getByText('Rota')).toBeTruthy());
      for (const rotulo of ['Rota', 'Dívidas', 'Metas', 'Buddy', 'Caixa']) {
        expect(screen.getByText(rotulo)).toBeTruthy();
      }
    });

    it('cada aba é um alvo de toque com papel e estado de acessibilidade', async () => {
      comSaldo(500_000);
      renderizarTela(<TabBar {...props(ABAS, 0)} />);

      await waitFor(() => expect(screen.getByText('Rota')).toBeTruthy());
      const abas = screen.getAllByRole('tab');
      expect(abas).toHaveLength(5);
      expect(abas.filter((a) => a.props.accessibilityState?.selected)).toHaveLength(1);
    });
  });
});

/**
 * `interpolateColor` do reanimated devolve `rgba(r, g, b, a)`, nunca o hex que
 * entrou. Comparar com o token cru falharia por formato mesmo com a cor certa —
 * e esconderia a cor errada atrás de um falso negativo.
 */
function comoRgba(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 1)`;
}

/** Todas as cores de fundo aplicadas na árvore, achatadas. */
function coresDeFundo(raiz: ReturnType<typeof renderizarTela>['UNSAFE_root']): string[] {
  const encontradas: string[] = [];
  function visitar(no: { props?: Record<string, unknown>; children?: unknown[] }) {
    const estilo = no.props?.style;
    for (const camada of Array.isArray(estilo) ? estilo.flat(3) : [estilo]) {
      const cor = (camada as { backgroundColor?: string } | undefined)?.backgroundColor;
      if (typeof cor === 'string') encontradas.push(cor);
    }
    for (const filho of (no.children ?? []) as typeof no[]) {
      if (typeof filho === 'object' && filho !== null) visitar(filho);
    }
  }
  visitar(raiz as never);
  return encontradas;
}
