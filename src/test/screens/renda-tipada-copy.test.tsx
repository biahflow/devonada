import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import CaixaScreen from '../../../app/(tabs)/caixa/index';
import RendaCaixa from '../../../app/(tabs)/caixa/renda';
import CompromissoScreen from '../../../app/(tabs)/caixa/compromisso';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, responderPorRota, requestMock } from '../api';
import { umCaixa } from '../mocks';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

/**
 * A VARREDURA DE COPY DA RENDA TIPADA (F-011, T6), no molde do sweep do respiro.
 *
 * Dois modos de errar que este produto não pode cometer, e que soam gentis:
 *
 * 1. SUGERIR um valor, uma faixa ou um percentual de compromisso. A ADR 0009
 *    proíbe coeficiente de alocação sem fonte, e a 0021 reafirma "quem não
 *    declarar não tem". "Comece com 5 a 8%" é palpite vestido de conselho.
 * 2. PRESTAR CONTAS do mês fraco. O mês âncora existe para EXPLICAR por que a
 *    capacidade caiu — "seu plano está dimensionado pelo pior mês, que foi
 *    março" —, nunca para cobrar: "sua renda caiu" lido como falha do usuário é
 *    o oposto do que a linha existe para fazer (guardrail 4).
 *
 * A lista é uma só de propósito: três listas em três arquivos divergem, e a que
 * ficar para trás protege menos sem ninguém notar.
 */
const PROIBIDAS = [
  // Sugestão de valor / faixa / percentual de compromisso.
  'recomendamos',
  'o ideal é',
  'comece com',
  'sugerimos um',
  'sugerimos que',
  'sugerimos você',
  '5 a 8',
  'de 5% a',
  'entre 5%',
  'faixa recomendada',
  'recomendad',
  // Prestação de contas / culpa pelo mês fraco.
  'sua renda caiu',
  'você ganhou menos',
  'você deveria',
  'faturou pouco',
  'ganhou pouco',
  'mês ruim',
  'renda insuficiente',
] as const;

function nenhumTermoProibido(arvore: unknown, onde: string) {
  const texto = JSON.stringify(arvore).toLowerCase();
  const encontradas = PROIBIDAS.filter((p) => texto.includes(p));
  expect({ onde, encontradas }).toEqual({ onde, encontradas: [] });
}

/**
 * Coleta só o TEXTO VISÍVEL — os `children` string —, ignorando props e estilos.
 * Um `width: '100%'` de layout não é percentual sugerido ao usuário, e é o que um
 * `JSON.stringify` cru confundiria.
 */
function textoVisivel(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return `${node} `;
  if (Array.isArray(node)) return node.map(textoVisivel).join('');
  if (typeof node === 'object' && 'children' in (node as Record<string, unknown>)) {
    return textoVisivel((node as { children: unknown }).children);
  }
  return '';
}

/** Nenhum percentual sugerido: nos estados de CONVITE não há dígito seguido de %. */
function nenhumPercentualSugerido(arvore: unknown, onde: string) {
  const texto = textoVisivel(arvore);
  expect({ onde, temPercentual: /\d+\s*%/.test(texto) }).toEqual({
    onde,
    temPercentual: false,
  });
}

describe('copy da renda tipada — formulário de fonte, por tipo', () => {
  const TIPOS = [
    ['PJ por hora', 'pj_hora'],
    ['CLT', 'clt'],
    ['Autônomo', 'autonomo'],
    ['Benefício', 'beneficio'],
    ['Aluguel', 'aluguel'],
    ['Outro', 'outro'],
  ] as const;

  it.each(TIPOS)('o formulário do tipo %s não sugere nem culpa', async (rotulo) => {
    responderPorRota({
      '/v1/caixa/fontes': { fontes: [] },
      '/v1/caixa/eventos-previsiveis': { eventos: [] },
      '/v1/caixa': { caixa: umCaixa() },
    });
    const { toJSON } = renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    fireEvent.press(screen.getByText(rotulo));
    nenhumTermoProibido(toJSON(), `fonte ${rotulo}`);
  });
});

describe('copy da renda tipada — CompromissoCard na tela de caixa', () => {
  it('sem compromisso: convida sem sugerir número nem faixa', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ compromissoPercentualBps: null }) } });
    const { toJSON } = renderizarTela(<CaixaScreen />);
    await waitFor(() => expect(screen.getByText('Declarar compromisso')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'compromisso convite');
    nenhumPercentualSugerido(toJSON(), 'compromisso convite');
  });

  const DECLARADOS: [string, number, number][] = [
    ['1%', 100, 9400],
    ['10%', 1000, 94000],
    ['zero declarado', 0, 0],
  ];

  it.each(DECLARADOS)(
    'com compromisso (%s) mostra o número do servidor sem cobrar',
    async (_rotulo, bps, centavos) => {
      responderPorRota({
        '/v1/caixa': {
          caixa: umCaixa({ compromissoPercentualBps: bps, compromissoPercentual: centavos }),
        },
      });
      const { toJSON } = renderizarTela(<CaixaScreen />);
      await waitFor(() => expect(screen.getByText('Sobra por mês')).toBeTruthy());
      nenhumTermoProibido(toJSON(), `compromisso declarado ${_rotulo}`);
    },
  );
});

describe('copy da renda tipada — tela de declaração do compromisso', () => {
  it('o formulário convida sem sugerir faixa', async () => {
    responderPorRota({ '/v1/caixa/metas': { metas: {} } });
    const { toJSON } = renderizarTela(<CompromissoScreen />);
    await waitFor(() => expect(screen.getByLabelText('Percentual do que entra')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'declaração compromisso');
    nenhumPercentualSugerido(toJSON(), 'declaração compromisso');
  });

  it('a recusa do piso legal explica o limite sem repreender', async () => {
    requestMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path.startsWith('/v1/caixa/metas') && opts?.method === 'PUT') {
        return Promise.reject(
          new ApiError(
            422,
            'Com esse compromisso, o que sobra no seu mês fica abaixo do mínimo existencial, que é o piso que a lei protege. Tente um percentual menor.',
          ),
        );
      }
      if (path.startsWith('/v1/caixa/metas')) {
        return Promise.resolve({ metas: {} }) as ReturnType<typeof requestMock>;
      }
      return Promise.reject(new Error(`Rota não mockada: ${path}`));
    });
    const { toJSON } = renderizarTela(<CompromissoScreen />);
    await waitFor(() => expect(screen.getByLabelText('Percentual do que entra')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Percentual do que entra'), '9000');
    fireEvent.press(screen.getByText('Declarar compromisso'));
    await waitFor(() => expect(screen.getByText(/mínimo existencial/)).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'recusa do piso');
  });
});

describe('copy da renda tipada — mês âncora explica sem cobrar', () => {
  const MESES = [
    '2026-01',
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
    '2026-12',
  ] as const;

  it.each(MESES)('a linha do pior mês (%s) não presta contas', async (mes) => {
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({ origemRenda: 'pior_mes_registrado', mesAncoraRenda: mes }),
      },
    });
    const { toJSON } = renderizarTela(<CaixaScreen />);
    await waitFor(() => expect(screen.getByText(/pior mês registrado/)).toBeTruthy());
    nenhumTermoProibido(toJSON(), `mês âncora ${mes}`);
  });

  it('sem histórico (origem informada) a linha some e nada é cobrado', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ origemRenda: 'informada' }) } });
    const { toJSON } = renderizarTela(<CaixaScreen />);
    await waitFor(() => expect(screen.getByText('Sobra por mês')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'origem informada');
  });
});
