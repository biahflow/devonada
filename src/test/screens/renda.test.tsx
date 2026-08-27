import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import RendaCaixa from '../../../app/(tabs)/caixa/renda';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { umCaixa } from '../mocks';
import { renderizarTela } from '../render';
import type { FonteRenda } from '../../api/types';

afterEach(limparMocksDeRede);

function umaFonte(over: Partial<FonteRenda> = {}): FonteRenda {
  return {
    id: 'f1',
    nome: 'Contrato PJ',
    tipo: 'pj_hora',
    valorTipicoInformado: 600000,
    variavel: true,
    ativo: true,
    ...over,
  };
}

/** Ordem importa: `responderPorRota` casa por prefixo, e `/v1/caixa/fontes`
 *  também começa com `/v1/caixa`. O específico vem primeiro. */
function mockar(fontes: FonteRenda[], caixaOver = {}) {
  responderPorRota({
    '/v1/caixa/fontes': { fontes },
    '/v1/caixa/eventos-previsiveis': { eventos: [] },
    '/v1/caixa': { caixa: umCaixa(caixaOver) },
  });
}

describe('tela de renda — os quatro estados (T4-AC3)', () => {
  it('carregando', () => {
    nuncaResponde();
    renderizarTela(<RendaCaixa />);
    expect(screen.getByText('Carregando suas fontes de renda')).toBeTruthy();
  });

  it('erro com retry', async () => {
    responderPorRota({
      '/v1/caixa/fontes': new ApiError(500, 'Erro 500.'),
      '/v1/caixa': { caixa: umCaixa() },
    });
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('vazio convida a cadastrar', async () => {
    mockar([]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Nenhuma fonte cadastrada')).toBeTruthy());
  });

  it('conteúdo lista a fonte', async () => {
    mockar([umaFonte({ nome: 'Meu contrato' })]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Meu contrato')).toBeTruthy());
  });
});

describe('formulário que se adapta ao tipo (T4-AC1)', () => {
  // Um caso por tipo: escolher o tipo muda o que o formulário pergunta.
  it('pj_hora (padrão) pede a alíquota', async () => {
    mockar([]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    expect(screen.getByLabelText('Percentual reservado para imposto')).toBeTruthy();
  });

  it('clt mostra 13º e férias', async () => {
    mockar([]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    fireEvent.press(screen.getByText('CLT'));
    expect(screen.getByText('13º e férias')).toBeTruthy();
    // A alíquota some — CLT declara o líquido, não reserva imposto à parte.
    expect(screen.queryByLabelText('Percentual reservado para imposto')).toBeNull();
  });

  it('autonomo oferece o caminho do compromisso percentual', async () => {
    mockar([]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    fireEvent.press(screen.getByText('Autônomo'));
    expect(screen.getByText('Declarar compromisso percentual')).toBeTruthy();
  });

  it('beneficio pede o dia de pagamento', async () => {
    mockar([]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    fireEvent.press(screen.getByText('Benefício'));
    expect(screen.getByLabelText('Dia do pagamento')).toBeTruthy();
  });

  it('aluguel nomeia a vacância como recebimento zero', async () => {
    mockar([]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    fireEvent.press(screen.getByText('Aluguel'));
    expect(screen.getByText(/um mês vago é um recebimento zero/)).toBeTruthy();
  });

  it('outro diz que é genérico', async () => {
    mockar([]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    fireEvent.press(screen.getByText('Outro'));
    expect(screen.getByText(/sem regra específica de tipo/)).toBeTruthy();
  });
});

describe('pj_hora sem alíquota (T4-AC2)', () => {
  it('diz "não está reservando imposto" e nunca exibe R$ 0,00', async () => {
    mockar(
      [umaFonte({ tipo: 'pj_hora', impostoBps: null, valorTipicoInformado: 600000 })],
      { impostoNaoDeclarado: true },
    );
    renderizarTela(<RendaCaixa />);

    await waitFor(() => expect(screen.getByText(/Não está reservando imposto/)).toBeTruthy());
    // O modo de falha que `impostoNaoDeclarado` existe para impedir.
    expect(screen.queryByText('R$ 0,00')).toBeNull();
  });

  it('com alíquota própria, não mostra o aviso', async () => {
    mockar([umaFonte({ tipo: 'pj_hora', impostoBps: 600 })], { impostoNaoDeclarado: false });
    renderizarTela(<RendaCaixa />);

    await waitFor(() => expect(screen.getByText('Contrato PJ')).toBeTruthy());
    expect(screen.queryByText(/Não está reservando imposto/)).toBeNull();
  });
});

describe('sem cálculo no cliente e com rótulos acessíveis (T4-AC4, T4-AC5)', () => {
  it('não sugere valor, faixa nem percentual de compromisso', async () => {
    mockar([]);
    const { toJSON } = renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    fireEvent.press(screen.getByText('Autônomo'));
    const texto = JSON.stringify(toJSON());
    // Nenhuma faixa "5 a 8%" nem percentual sugerido (ADR 0009/0019).
    expect(texto).not.toMatch(/\d+\s*a\s*\d+\s*%/);
  });

  it('os controles novos têm accessibilityLabel', async () => {
    mockar([]);
    renderizarTela(<RendaCaixa />);
    await waitFor(() => expect(screen.getByText('Adicionar fonte')).toBeTruthy());
    // PercentInput e CurrencyInput expõem o label como accessibilityLabel.
    expect(screen.getByLabelText('Percentual reservado para imposto')).toBeTruthy();
    expect(screen.getByLabelText('Quanto costuma entrar')).toBeTruthy();
  });
});
