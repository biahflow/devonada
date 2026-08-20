import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import CaixaScreen from '../../../app/(tabs)/caixa/index';
import RespiroScreen from '../../../app/(tabs)/caixa/respiro';
import { MarcoScreen } from '../../components/marco/MarcoScreen';
import { ApiError } from '../../api/client';
import type { TipoDeMarco } from '../../api/types';
import { limparMocksDeRede, responderPorRota } from '../api';
import { umCaixa } from '../mocks';
import { renderizarTela } from '../render';

afterEach(limparMocksDeRede);

/**
 * A VARREDURA DE COPY DO M11, nas três superfícies do respiro.
 *
 * Gêmeo dos testes que quebram em "recomendada" (M4), "ilegal" (M6) e do sweep
 * do caixa (M7). A diferença é o que ele protege: lá a regra era jurídica, aqui
 * é o guardrail 4.1, e o modo de falha é mais fácil de cometer porque soa
 * gentil. "Você já gastou R$ 80" parece informação neutra; ela é prestação de
 * contas, e transforma a linha do plano que existe para matar a culpa numa
 * segunda fonte de culpa.
 *
 * OS CINCO TERMOS VÊM DO CONTRATO, não do gosto de quem escreve teste:
 * `docs/features/F-010-respiro/feature.md`, Acceptance Criteria. Cada um marca
 * um jeito diferente de errar:
 *
 * - `você já gastou`   — contabilização do que foi usado (guardrail 4.1, a copy
 *                        proibida pelo nome);
 * - `você mereceu`     — mérito, que condiciona o respiro a desempenho;
 * - `se você economizar` — condicional, que devolve a permissão ao app;
 * - `desvio`           — tratar o uso como erro de rota, quando usar é o
 *                        comportamento desejado;
 * - `extrapolou`       — julgamento sobre o excesso do mês.
 *
 * A lista é uma só de propósito. Três listas em três arquivos divergem, e a que
 * ficar para trás protege menos sem ninguém notar.
 */
const PROIBIDAS = [
  'você já gastou',
  'você mereceu',
  'se você economizar',
  'desvio',
  'extrapolou',
] as const;

/**
 * Varre a árvore inteira, não só o que um `getByText` alcança: copy proibida
 * pode estar num `accessibilityLabel`, num `placeholder` ou num rótulo de
 * botão, e é justamente aí que ninguém revisa.
 *
 * `onde` entra na asserção para a falha dizer QUAL estado quebrou — com quinze
 * combinações de marco, "não contém" sem endereço não ajuda ninguém.
 */
function nenhumTermoProibido(arvore: unknown, onde: string) {
  const texto = JSON.stringify(arvore).toLowerCase();
  const encontradas = PROIBIDAS.filter((proibida) => texto.includes(proibida));
  expect({ onde, encontradas }).toEqual({ onde, encontradas: [] });
}

describe('copy do respiro — RespiroCard, na tela de caixa', () => {
  it('convida sem condicionar quem nunca declarou', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ respiro: null }) } });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Declarar respiro')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'convite');
  });

  it('não presta contas do que já foi usado no mês', async () => {
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({
          respiro: 15000,
          respiroAtivo: true,
          respiroUsadoNoMes: 8000,
          respiroDisponivelNoMes: 7000,
          respiroSaldoAcumulado: 22000,
        }),
      },
    });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Respiro deste mês')).toBeTruthy());
    // A frase que o guardrail 4.1 dá como CERTA, do lado da lista do que ele
    // proíbe: o teste vale mais provando os dois.
    expect(screen.getByText('sobram R$ 70,00 pra usar sem culpa')).toBeTruthy();
    nenhumTermoProibido(toJSON(), 'respiro em uso');
  });

  it('o mês inteiro usado não vira repreensão', async () => {
    // O momento mais fácil de escorregar: nada disponível, e a tentação de
    // "você já gastou tudo". A barra cheia é boa notícia — usar o respiro é o
    // comportamento desejado, não um limite estourado.
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({
          respiro: 15000,
          respiroAtivo: true,
          respiroUsadoNoMes: 15000,
          respiroDisponivelNoMes: 0,
        }),
      },
    });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Respiro deste mês')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'respiro esgotado');
  });

  it('o uso acima do respiro do mês não é tratado como excesso', async () => {
    // `respiroDisponivelNoMes` tem piso em zero no servidor, então o excesso do
    // mês não chega à tela como número negativo. Ele existe mesmo assim, e é
    // exatamente onde "extrapolou" nasceria.
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({
          respiro: 15000,
          respiroAtivo: true,
          respiroUsadoNoMes: 23000,
          respiroDisponivelNoMes: 0,
          respiroSaldoAcumulado: 0,
        }),
      },
    });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Respiro deste mês')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'respiro excedido');
  });
});

describe('copy do respiro — tela de declaração', () => {
  const semGastos = { '/v1/caixa/gastos': { gastos: [] } };

  it('o formulário explica o preço sem cobrar por ele', async () => {
    responderPorRota({ ...semGastos, '/v1/caixa': { caixa: umCaixa({ respiro: null }) } });
    const { toJSON } = renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByLabelText('Respiro por mês')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'formulário');
  });

  it('o aviso de dupla contagem aponta o risco sem culpar quem cadastrou o gasto', async () => {
    responderPorRota({
      '/v1/caixa/gastos': {
        gastos: [
          {
            id: 'g1',
            descricao: 'Lazer',
            categoria: 'outros',
            essencial: false,
            fixo: true,
            valorMensal: 20000,
            ativo: true,
          },
        ],
      },
      '/v1/caixa': { caixa: umCaixa({ respiro: null }) },
    });
    const { toJSON } = renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByText('Cuidado com a dupla contagem')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'dupla contagem');
  });

  const PRECOS: [string, number | null][] = [
    ['preço em meses', 2],
    ['preço de um mês', 1],
    ['preço zero', 0],
    ['sem preço', null],
  ];

  it.each(PRECOS)('a confirmação com %s não cobra a escolha', async (_rotulo, custoEmMeses) => {
    // Os quatro estados do preço têm frases diferentes, e três delas foram
    // escritas depois da revisão de T5. Varrer só uma deixaria as outras sem
    // rede.
    responderPorRota({
      '/v1/caixa/respiro': {
        respiro: { valorMensal: 15000, ativo: true, saldoAcumulado: 0 },
        custoEmMeses,
      },
      ...semGastos,
      '/v1/caixa': { caixa: umCaixa({ respiro: null }) },
    });
    const { toJSON } = renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByLabelText('Respiro por mês')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Respiro por mês'), '15000');
    fireEvent.press(screen.getByText('Declarar respiro'));

    await waitFor(() => expect(screen.getByText('Respiro guardado')).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'confirmação');
  });

  it('a recusa do piso legal explica o limite sem repreender a escolha', async () => {
    // O 422 é onde a repreensão entra sozinha: é a única tela do respiro em que
    // o app diz "não". A frase vem do servidor, e é ela que este teste varre.
    responderPorRota({
      '/v1/caixa/respiro': new ApiError(
        422,
        'Esse respiro passa do que sobra depois do mínimo para viver. Tente um valor menor.',
      ),
      ...semGastos,
      '/v1/caixa': { caixa: umCaixa({ respiro: null }) },
    });
    const { toJSON } = renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByLabelText('Respiro por mês')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Respiro por mês'), '900000');
    fireEvent.press(screen.getByText('Declarar respiro'));

    await waitFor(() => expect(screen.getByText(/mínimo para viver/)).toBeTruthy());
    nenhumTermoProibido(toJSON(), 'recusa do piso');
  });
});

describe('copy do respiro — MarcoScreen', () => {
  const TIPOS: TipoDeMarco[] = [
    'primeira_negociacao',
    'primeira_quitacao',
    'rota_25',
    'rota_50',
    'rota_75',
  ];

  /**
   * Os cinco marcos × os três estados de saldo. A tabela de copy do componente
   * é indexada por tipo E por faixa de valor, e um termo proibido escondido na
   * legenda de `rota_75` não apareceria numa varredura de um caso só.
   *
   * `MarcoScreen` é apresentacional e recebe tudo por prop — renderizá-lo
   * direto é o que dá acesso às quinze combinações sem quinze mocks de rota.
   */
  const SALDOS: [string, number | null][] = [
    ['faixa baixa', 4000],
    ['faixa média', 20000],
    ['faixa alta', 90000],
    ['sem nada guardado', 0],
    ['nunca declarou', null],
  ];

  const MATRIZ: [TipoDeMarco, string, number | null][] = TIPOS.flatMap((tipo) =>
    SALDOS.map(([rotulo, saldo]): [TipoDeMarco, string, number | null] => [tipo, rotulo, saldo]),
  );

  it.each(MATRIZ)('celebra %s com %s sem mérito nem prestação de contas', (tipo, rotulo, saldo) => {
    const { toJSON } = renderizarTela(
      <MarcoScreen
        tipo={tipo}
        respiroSaldoAcumulado={saldo}
        onAproveitar={() => {}}
        onGuardarProProximoMarco={() => {}}
      />,
    );

    expect(screen.getByText('Aproveita. Tá no plano.')).toBeTruthy();
    nenhumTermoProibido(toJSON(), `${tipo} / ${rotulo}`);
  });
});
