import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import CaixaScreen from '../../../app/(tabs)/caixa/index';
import RespiroScreen from '../../../app/(tabs)/caixa/respiro';
import CompromissoScreen from '../../../app/(tabs)/caixa/compromisso';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { umCaixa } from '../mocks';
import { renderizarTela } from '../render';
import { colors } from '../../theme/theme';

afterEach(limparMocksDeRede);

describe('tela de caixa', () => {
  it('mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<CaixaScreen />);
    expect(screen.getByText('Somando seu mês')).toBeTruthy();
  });

  it('mostra erro com retry', async () => {
    responderPorRota({ '/v1/caixa': new ApiError(500, 'Erro 500.') });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('convida ao atalho de 20 segundos quando nada foi preenchido', async () => {
    // O vazio mais importante desta tela: quem está endividado não preenche
    // formulário, então o valor tem de vir antes do esforço.
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ preenchimento: 'vazio' }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Leva 20 segundos')).toBeTruthy());
    expect(screen.getByText('Informar renda')).toBeTruthy();
  });

  it('exibe a cascata com a sobra do mês', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa() } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Sobra por mês')).toBeTruthy());
    expect(screen.getByText('R$ 10.000,00')).toBeTruthy();
    expect(screen.getByText('R$ 4.000,00')).toBeTruthy();
    // Aparece duas vezes de propósito: na sobra da cascata e no tile de aporte,
    // que coincidem quando não há parcela comprometida.
    expect(screen.getAllByText('R$ 6.000,00')).toHaveLength(2);
  });

  it('exibe capacidade negativa como negativa, sem esconder nem zerar', async () => {
    responderPorRota({
      '/v1/caixa': { caixa: umCaixa({ capacidadeHoje: -120000, capacidadeMaxima: -120000 }) },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('-R$ 1.200,00')).toBeTruthy());
  });

  it('avisa quando os números não fecham, sem dizer que a pessoa está superendividada', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ naoFecha: true }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText(/não cabem no que sobra/)).toBeTruthy());
    // A definição legal exige boa-fé e dívida de consumo (CDC art. 54-A, § 1º),
    // e software não apura nenhuma das duas.
    expect(screen.queryByText(/superendividad/i)).toBeNull();
  });

  it('avisa quando a sobra fica abaixo do piso legal', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ abaixoDoPiso: true }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText(/mínimo existencial que a lei protege/)).toBeTruthy());
  });

  it('diz quando a renda veio do pior mês registrado', async () => {
    // O usuário precisa saber se o número que ele vê é o que digitou ou o que
    // de fato recebeu.
    responderPorRota({
      '/v1/caixa': { caixa: umCaixa({ origemRenda: 'pior_mes_registrado' }) },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText(/pior mês registrado/)).toBeTruthy());
  });

  it('mostra a alavanca do não essencial sem mandar cortar', async () => {
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({ naoEssenciais: 90000, capacidadeHoje: 510000, capacidadeMaxima: 600000 }),
      },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Cortando o não essencial')).toBeTruthy());
    expect(screen.getByText('É a sua alavanca — a escolha é sua, não do app.')).toBeTruthy();
  });
});

describe('copy do caixa', () => {
  it('nunca elege uma ordem de prioridade nem afirma direito', async () => {
    // Gêmeo dos testes que quebram em "recomendada" (M4) e "ilegal" (M6).
    // ADR 0009: o app mostra a aritmética, o usuário decide.
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ naoFecha: true, abaixoDoPiso: true }) } });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Sobra por mês')).toBeTruthy());

    const texto = JSON.stringify(toJSON());
    for (const proibida of ['recomendad', 'você tem direito', 'ilegal', 'abusiv', 'superendividad']) {
      expect(texto.toLowerCase()).not.toContain(proibida);
    }
  });
});

describe('RespiroCard (T5, ADR 0019)', () => {
  it('T5-AC1: sem respiro declarado, convida e diz que o preço vem em meses', async () => {
    // `respiro: null` é NUNCA DECLAROU — diferente de `0`, que é escolha
    // legítima. Sem default (ADR 0009), o convite é obrigação de tela.
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ respiro: null }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Declarar respiro')).toBeTruthy());
    expect(screen.getByText(/meses de quitação/)).toBeTruthy();
    // Nenhum valor, faixa ou percentual sugerido — ADR 0019, item 2.
    const texto = JSON.stringify(screen.toJSON());
    expect(texto).not.toMatch(/\d+\s*%/);
  });

  it('T5-AC2: com respiro declarado, mostra o número e a barra enche em accent', async () => {
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
    expect(screen.getByText('R$ 150,00')).toBeTruthy();
    expect(screen.getByText('usados R$ 80,00')).toBeTruthy();
    // Copy de PERMISSÃO — a frase que o guardrail 4.1 dá como certa.
    expect(screen.getByText('sobram R$ 70,00 pra usar sem culpa')).toBeTruthy();
    // Saldo acumulado é LINHA DISCRETA, nunca uma segunda barra.
    expect(screen.getByText('guardado: R$ 220,00')).toBeTruthy();

    const arvore = JSON.stringify(toJSON());
    expect(arvore).toContain(colors.accent);
  });

  it('T5-AC3: registrar uso não produz alerta, tom negativo nem cor de dívida/erro', async () => {
    responderPorRota({
      // Mais específico primeiro: `responderPorRota` casa por prefixo, e
      // `/v1/caixa/respiro/uso` também começa com `/v1/caixa`.
      '/v1/caixa/respiro/uso': { id: 'uso-1', respiroDisponivelNoMes: 2000 },
      '/v1/caixa': {
        caixa: umCaixa({
          respiro: 15000,
          respiroAtivo: true,
          respiroUsadoNoMes: 8000,
          respiroDisponivelNoMes: 7000,
        }),
      },
    });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Registrar uso')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Usar respiro'), '500');
    requestMock.mockClear();
    fireEvent.press(screen.getByText('Registrar uso'));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        '/v1/caixa/respiro/uso',
        expect.objectContaining({ method: 'POST', body: { valor: 500, descricao: undefined } }),
      ),
    );

    // Nenhum banner de alerta — nem `warning`, nem `error`.
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    // `debt` e `danger` são o MESMO hex (`#E5352B`): checar um cobre o outro.
    const arvore = JSON.stringify(toJSON());
    expect(arvore).not.toContain(colors.danger);
    expect(arvore).not.toContain(colors.warning);
  });

  it('T5-AC6: a barra carrega accessibilityLabel — não há texto visível que a descreva', async () => {
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({ respiro: 15000, respiroUsadoNoMes: 8000, respiroDisponivelNoMes: 7000 }),
      },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() =>
      expect(screen.getByLabelText('53% do respiro do mês já usado')).toBeTruthy(),
    );
  });
});

describe('tela de declaração do respiro (app/(tabs)/caixa/respiro.tsx)', () => {
  it('carregando: mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<RespiroScreen />);
    expect(screen.getByText('Carregando seu respiro')).toBeTruthy();
  });

  it('erro: mostra erro com retry', async () => {
    responderPorRota({ '/v1/caixa': new ApiError(500, 'Erro 500.') });
    renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('T5-AC4: nomeia o risco de dupla contagem com gasto não essencial e oferece desativar', async () => {
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
    renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByText('Cuidado com a dupla contagem')).toBeTruthy());
    expect(screen.getByText(/capacidade cai duas vezes/)).toBeTruthy();
    expect(screen.getByText('Lazer')).toBeTruthy();

    requestMock.mockClear();
    fireEvent.press(screen.getByText('Desativar'));

    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    const chamada = requestMock.mock.calls[0];
    expect(chamada?.[0]).toBe('/v1/caixa/gastos/g1');
    expect((chamada?.[1] as { method?: string } | undefined)?.method).toBe('PATCH');
  });

  it('declara respiro e mostra, sem calcular nada aqui, o preço em meses vindo do servidor', async () => {
    responderPorRota({
      '/v1/caixa/respiro': {
        respiro: { valorMensal: 15000, ativo: true, saldoAcumulado: 0 },
        custoEmMeses: 2,
      },
      '/v1/caixa/gastos': { gastos: [] },
      '/v1/caixa': { caixa: umCaixa({ respiro: null }) },
    });
    renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByLabelText('Respiro por mês')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Respiro por mês'), '15000');
    fireEvent.press(screen.getByText('Declarar respiro'));

    await waitFor(() => expect(screen.getByText('Respiro guardado')).toBeTruthy());
    expect(screen.getByText(/2 meses/)).toBeTruthy();
  });

  it('grava sem preço quando o servidor não tem dívida suficiente para simular — nunca um palpite', async () => {
    responderPorRota({
      '/v1/caixa/respiro': {
        respiro: { valorMensal: 5000, ativo: true, saldoAcumulado: 0 },
        custoEmMeses: null,
      },
      '/v1/caixa/gastos': { gastos: [] },
      '/v1/caixa': { caixa: umCaixa({ respiro: null }) },
    });
    renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByLabelText('Respiro por mês')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Respiro por mês'), '5000');
    fireEvent.press(screen.getByText('Declarar respiro'));

    await waitFor(() => expect(screen.getByText('Respiro guardado')).toBeTruthy());
    expect(screen.queryByText(/meses/)).toBeNull();
    expect(screen.queryByText(/0 mês/)).toBeNull();
  });

  it('422 do piso legal explica com a frase pronta do servidor, nunca erro genérico', async () => {
    const recusa = new ApiError(
      422,
      'Esse respiro passa do que sobra depois do mínimo para viver. Tente um valor menor.',
    );
    responderPorRota({
      '/v1/caixa/respiro': recusa,
      '/v1/caixa/gastos': { gastos: [] },
      '/v1/caixa': { caixa: umCaixa({ respiro: null }) },
    });
    renderizarTela(<RespiroScreen />);

    await waitFor(() => expect(screen.getByLabelText('Respiro por mês')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Respiro por mês'), '900000');
    fireEvent.press(screen.getByText('Declarar respiro'));

    await waitFor(() => expect(screen.getByText(/mínimo para viver/)).toBeTruthy());
  });
});

describe('CompromissoCard (T5, ADR 0021)', () => {
  it('T5-AC1: sem percentual declarado, convida e não sugere número', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ compromissoPercentualBps: null }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Declarar compromisso')).toBeTruthy());
    // Estado de convite: NÃO mostra o valor do estado declarado — nenhum número
    // sugerido, nenhuma faixa (ADR 0009/0019).
    expect(screen.queryByText(/reservado por mês sobre o que entra/)).toBeNull();
  });

  it('T5-AC2: com percentual declarado, mostra o bps e o valor do servidor', async () => {
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({ compromissoPercentualBps: 1000, compromissoPercentual: 94000 }),
      },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Compromisso deste mês')).toBeTruthy());
    // 10,00% e R$ 940,00 vêm PRONTOS — o cliente não multiplica bps por renda.
    expect(screen.getByText('10,00%')).toBeTruthy();
    expect(screen.getByText('R$ 940,00')).toBeTruthy();
  });
});

describe('mês âncora da renda típica (T5-AC3)', () => {
  it('mostra a origem e o mês quando a renda veio do pior mês', async () => {
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({ origemRenda: 'pior_mes_registrado', mesAncoraRenda: '2026-03' }),
      },
    });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText(/pior mês registrado/)).toBeTruthy());
    expect(screen.getByText(/que foi mar\/26/)).toBeTruthy();
  });

  it('a linha some quando a origem é informada', async () => {
    responderPorRota({ '/v1/caixa': { caixa: umCaixa({ origemRenda: 'informada' }) } });
    renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Sobra por mês')).toBeTruthy());
    expect(screen.queryByText(/pior mês registrado/)).toBeNull();
  });
});

describe('tela de declaração do compromisso (app/(tabs)/caixa/compromisso.tsx)', () => {
  it('T5-AC4 carregando: mostra o carregamento', () => {
    nuncaResponde();
    renderizarTela(<CompromissoScreen />);
    expect(screen.getByText('Carregando seu compromisso')).toBeTruthy();
  });

  it('T5-AC4 erro: mostra erro com retry', async () => {
    responderPorRota({ '/v1/caixa/metas': new ApiError(500, 'Erro 500.') });
    renderizarTela(<CompromissoScreen />);
    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('T5-AC5: o campo tem accessibilityLabel', async () => {
    responderPorRota({ '/v1/caixa/metas': { metas: {} } });
    renderizarTela(<CompromissoScreen />);
    await waitFor(() => expect(screen.getByLabelText('Percentual do que entra')).toBeTruthy());
  });

  it('grava mandando as OUTRAS metas de volta — a rota sobrescreve tudo', async () => {
    responderPorRota({ '/v1/caixa/metas': { metas: { impostoBps: 600 } } });
    renderizarTela(<CompromissoScreen />);

    await waitFor(() => expect(screen.getByLabelText('Percentual do que entra')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Percentual do que entra'), '1000');
    requestMock.mockClear();
    fireEvent.press(screen.getByText('Declarar compromisso'));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        '/v1/caixa/metas',
        expect.objectContaining({
          method: 'PUT',
          body: expect.objectContaining({ impostoBps: 600, compromissoPercentualBps: 1000 }),
        }),
      ),
    );
  });

  it('422 do piso legal explica com a frase pronta do servidor', async () => {
    requestMock.mockImplementation((path: string, opts?: { method?: string }) => {
      if (path.startsWith('/v1/caixa/metas') && opts?.method === 'PUT') {
        return Promise.reject(
          new ApiError(
            422,
            'Com esse compromisso, o que sobra no seu mês fica abaixo do mínimo existencial, que é o piso que a lei protege.',
          ),
        );
      }
      if (path.startsWith('/v1/caixa/metas')) {
        return Promise.resolve({ metas: {} }) as ReturnType<typeof requestMock>;
      }
      return Promise.reject(new Error(`Rota não mockada: ${path}`));
    });
    renderizarTela(<CompromissoScreen />);

    await waitFor(() => expect(screen.getByLabelText('Percentual do que entra')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Percentual do que entra'), '9000');
    fireEvent.press(screen.getByText('Declarar compromisso'));

    await waitFor(() => expect(screen.getByText(/mínimo existencial/)).toBeTruthy());
  });
});

describe('copy proibida do respiro (guardrail 4.1)', () => {
  it('nunca produz linguagem de prestação de contas', async () => {
    responderPorRota({
      '/v1/caixa': {
        caixa: umCaixa({ respiro: 15000, respiroUsadoNoMes: 8000, respiroDisponivelNoMes: 7000 }),
      },
    });
    const { toJSON } = renderizarTela(<CaixaScreen />);

    await waitFor(() => expect(screen.getByText('Respiro deste mês')).toBeTruthy());

    const texto = JSON.stringify(toJSON()).toLowerCase();
    for (const proibida of [
      'você já gastou',
      'você mereceu',
      'se você economizar',
      'desvio',
      'extrapolou',
    ]) {
      expect(texto).not.toContain(proibida);
    }
  });
});
