import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import CaixaScreen from '../../../app/(tabs)/caixa/index';
import PainelScreen from '../../../app/(tabs)/painel/index';
import Triagem from '../../../app/(onboarding)/triagem';
import RevisaoScreen from '../../../app/(tabs)/dividas/[id]/revisao';
import { limparMocksDeRede, responderPorRota } from '../api';
import { umCaixa, umResumo, umaRevisao } from '../mocks';
import { renderizarTela } from '../render';
import type { FonteJuridica, Trilha } from '../../api/types';

/**
 * A trilha "como calculamos" e o caminho da repactuação (M14).
 *
 * O QUE ESTA SUÍTE PROTEGE: que a explicação de um número esteja SEMPRE
 * acompanhada do que aquela conta não faz, que as fontes cheguem resolvidas, e
 * que nenhuma copy nova diga ao usuário o que ele é — nem negando.
 *
 * O gêmeo dos testes de copy do M4/M6/M7/M11, agora sobre a tela.
 */

const FONTE_MINIMO: FonteJuridica = {
  id: 'decreto-11150-3',
  norma: 'Decreto 11.150/2022',
  dispositivo: 'art. 3º (redação do Decreto 11.567/2023)',
  ementa: 'O mínimo existencial é a renda mensal de R$ 600,00.',
  vigencia: '2023-06-19',
  url: 'https://www.planalto.gov.br/exemplo',
};

const FONTE_REPACTUACAO: FonteJuridica = {
  id: 'cdc-104a',
  norma: 'Código de Defesa do Consumidor',
  dispositivo: 'art. 104-A (incluído pela Lei 14.181/2021)',
  ementa: 'A pessoa pode pedir a repactuação: uma audiência com todos os credores de uma vez.',
  vigencia: '2021-07-01',
  url: 'https://www.planalto.gov.br/exemplo',
  texto: 'A requerimento do consumidor…',
};

const TRILHA_CAPACIDADE: Trilha = {
  chave: 'capacidadeHoje',
  titulo: 'Como chegamos na sua sobra por mês',
  formula: 'renda típica − impostos − mínimo existencial − gastos',
  passos: ['Partimos da sua renda típica, não da do melhor mês.'],
  fonteIds: ['decreto-11150-3'],
  limitacoes: ['O mínimo existencial da lei NÃO cresce por dependente.'],
};

const TRILHA_NAO_FECHA: Trilha = {
  chave: 'naoFecha',
  titulo: 'Por que dissemos que os números não fecham',
  formula: 'soma das parcelas mínimas > o que sobra cortando tudo',
  passos: ['Somamos as parcelas mínimas de todas as suas dívidas ativas.'],
  fonteIds: ['cdc-104a'],
  limitacoes: ['Isto é uma subtração, não um diagnóstico.'],
};

const FONTES = { fontes: [FONTE_MINIMO, FONTE_REPACTUACAO] };

afterEach(limparMocksDeRede);

describe('Disclosure "como calculamos"', () => {
  function renderizarCaixa(over = {}) {
    responderPorRota({
      '/v1/juridico/fontes': FONTES,
      '/v1/caixa': {
        caixa: umCaixa({ trilhas: [TRILHA_CAPACIDADE, TRILHA_NAO_FECHA], ...over }),
      },
    });
    renderizarTela(<CaixaScreen />);
  }

  it('nasce fechado: a explicação não compete com a resposta', async () => {
    renderizarCaixa();

    // O gatilho existe; o conteúdo, ainda não. Quem abre a tela do caixa quer
    // saber quanto sobra — despejar a memória de cálculo junto seria parede de
    // texto por cima do número que a pessoa veio ver.
    expect((await screen.findAllByText('Como calculamos')).length).toBeGreaterThan(0);
    expect(screen.queryByText(TRILHA_CAPACIDADE.titulo)).toBeNull();
  });

  it('abre com a fórmula, os passos e o que a conta NÃO faz', async () => {
    renderizarCaixa();

    fireEvent.press((await screen.findAllByRole('button', { name: /Como chegamos/ }))[0]!);

    expect(await screen.findByText(TRILHA_CAPACIDADE.formula)).toBeTruthy();
    expect(screen.getByText(`• ${TRILHA_CAPACIDADE.passos[0]}`)).toBeTruthy();
    // A METADE QUE IMPORTA. Uma versão desta tela que renderizasse os passos e
    // escondesse as limitações viraria propaganda da própria conta.
    expect(screen.getByText('O que esta conta não faz')).toBeTruthy();
    expect(screen.getByText(`• ${TRILHA_CAPACIDADE.limitacoes[0]}`)).toBeTruthy();
  });

  it('resolve o id da fonte em norma, ementa e vigência', async () => {
    renderizarCaixa();
    fireEvent.press((await screen.findAllByRole('button', { name: /Como chegamos/ }))[0]!);

    expect(
      await screen.findByText(`${FONTE_MINIMO.norma}, ${FONTE_MINIMO.dispositivo}`),
    ).toBeTruthy();
    expect(screen.getByText(FONTE_MINIMO.ementa)).toBeTruthy();
    // A VIGÊNCIA JUNTO DO LINK: é ela que diz a idade do fundamento. O mínimo
    // existencial já foi 25% do salário mínimo, e a redação velha custava
    // R$ 220,50 de piso a quem estava negociando.
    expect(screen.getByText(/vigente desde 2023-06-19/)).toBeTruthy();
  });

  it('sem o corpus, o número continua na tela e a fonte apenas não aparece', async () => {
    // A requisição do corpus NÃO bloqueia: os números vêm da resposta do caixa.
    responderPorRota({
      '/v1/juridico/fontes': { fontes: [] },
      '/v1/caixa': { caixa: umCaixa({ trilhas: [TRILHA_CAPACIDADE] }) },
    });
    renderizarTela(<CaixaScreen />);

    fireEvent.press((await screen.findAllByRole('button', { name: /Como chegamos/ }))[0]!);

    expect(screen.getByText(TRILHA_CAPACIDADE.formula)).toBeTruthy();
    expect(screen.queryByText(FONTE_MINIMO.ementa)).toBeNull();
  });

  it('a explicação do "não fecham" só aparece junto do fato', async () => {
    renderizarCaixa({ naoFecha: false });
    await waitFor(() => expect(screen.getAllByText('Como calculamos').length).toBe(1));

    limparMocksDeRede();
    renderizarCaixa({ naoFecha: true });
    await waitFor(() => expect(screen.getAllByText('Como calculamos').length).toBe(2));
  });

  it('a trilha do valor justo aparece mesmo sem achado nenhum', async () => {
    // É JUSTAMENTE AQUI que explicar importa mais: sem contrato lido não há
    // `valorJusto`, e a pessoa merece saber que ele seria uma subtração de
    // achados — não uma estimativa que deixamos de fazer.
    definirParametrosDeRota({ id: 'divida-1' });
    responderPorRota({
      '/v1/juridico/fontes': FONTES,
      '/v1/dividas/divida-1/revisao': {
        revisao: umaRevisao({
          valorJusto: null,
          achados: [],
          trilha: {
            chave: 'valorJusto',
            titulo: 'Como chegamos no valor justo',
            formula: 'valor cobrado − soma dos achados que têm valor',
            passos: ['Lemos o contrato e separamos os pontos que valem contestar.'],
            fonteIds: [],
            limitacoes: ['Não é uma estimativa de quanto a dívida deveria custar.'],
          },
        }),
      },
    });
    renderizarTela(<RevisaoScreen />);

    fireEvent.press(await screen.findByRole('button', { name: /Como chegamos no valor justo/ }));
    expect(
      await screen.findByText('• Não é uma estimativa de quanto a dívida deveria custar.'),
    ).toBeTruthy();
  });
});

describe('O caminho da repactuação', () => {
  it('a Rota nomeia o caminho quando as parcelas não cabem', async () => {
    responderPorRota({
      '/v1/juridico/fontes': FONTES,
      '/v1/dividas/resumo': {
        resumo: umResumo({ rendaMensal: 300000, comprometimentoRenda: 5000, naoFecha: true }),
      },
    });
    renderizarTela(<PainelScreen />);

    expect(await screen.findByText(/caminho previsto em lei para renegociar todas de uma vez/i))
      .toBeTruthy();
  });

  it('ausente NÃO é tranquilidade: sem caixa, a Rota não afirma nada', async () => {
    // `naoFecha` ausente significa "não sabemos" — a conta não tem os dois
    // lados. Renderizar isso como silêncio tranquilizador seria afirmar que as
    // parcelas cabem.
    responderPorRota({
      '/v1/juridico/fontes': FONTES,
      '/v1/dividas/resumo': {
        resumo: umResumo({ rendaMensal: 300000, comprometimentoRenda: 5000, naoFecha: undefined }),
      },
    });
    renderizarTela(<PainelScreen />);

    await waitFor(() => expect(screen.getByText('Comprometimento da renda')).toBeTruthy());
    expect(screen.queryByText(/caminho previsto em lei/i)).toBeNull();
  });

  it('a triagem CONVIDA quem marcou várias, sem afirmar que os números não fecham', async () => {
    // No onboarding a renda ainda não foi informada, então o app NÃO SABE se as
    // parcelas cabem. A única frase honesta é o convite.
    definirParametrosDeRota({ id: 'divida-1', total: '3' });
    responderPorRota({
      '/v1/juridico/fontes': FONTES,
      '/v1/dividas/divida-1/revisao': { revisao: umaRevisao({ valorJusto: null, achados: [] }) },
    });
    renderizarTela(<Triagem />);

    expect(await screen.findByText('Você marcou mais de uma')).toBeTruthy();
    expect(screen.getByText(/Informe sua renda no Caixa/)).toBeTruthy();
    // O convite não afirma NADA sobre a situação de quem acabou de cadastrar.
    expect(screen.queryByText(/não cabem/i)).toBeNull();
  });

  it('quem marcou UMA dívida não recebe o convite', async () => {
    definirParametrosDeRota({ id: 'divida-1', total: '1' });
    responderPorRota({
      '/v1/juridico/fontes': FONTES,
      '/v1/dividas/divida-1/revisao': { revisao: umaRevisao({ valorJusto: null, achados: [] }) },
    });
    renderizarTela(<Triagem />);

    await waitFor(() => expect(screen.getByText('Já dá pra\ncomeçar.')).toBeTruthy());
    expect(screen.queryByText('Você marcou mais de uma')).toBeNull();
  });
});

describe('A palavra que o produto não diz', () => {
  const PROIBIDAS = [/superendividad/i, /\bilegal\b/i, /abusiv/i, /é seu direito/i];

  it('nenhuma copy nova do M14 diagnostica o usuário', async () => {
    // O gêmeo dos testes de copy do M4/M6/M7/M11. A definição legal exige
    // boa-fé e dívida de consumo (CDC, art. 54-A, § 1º), e software não apura
    // nenhuma das duas — nem para negar.
    responderPorRota({
      '/v1/juridico/fontes': FONTES,
      '/v1/caixa': {
        caixa: umCaixa({ naoFecha: true, trilhas: [TRILHA_CAPACIDADE, TRILHA_NAO_FECHA] }),
      },
    });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getAllByText('Como calculamos').length).toBe(2));
    for (const gatilho of screen.getAllByText('Como calculamos')) {
      fireEvent.press(gatilho);
    }

    const texto = JSON.stringify(toJSON());
    for (const proibida of PROIBIDAS) {
      expect(texto).not.toMatch(proibida);
    }
  });
});
