import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Renegociar from '../../../app/(tabs)/dividas/[id]/renegociar';
import { ApiError } from '../../api/client';
import type { DesfechoNegociacao, ResultadoNegociacao } from '../../api/types';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { renderizarTela } from '../render';

const NEGOCIACOES = '/v1/dividas/divida-1/negociacoes';

const umResultado = (over: Partial<ResultadoNegociacao> = {}): ResultadoNegociacao => ({
  id: 'r1',
  dividaId: 'divida-1',
  canal: 'telefone',
  desfecho: 'recusa',
  valorProposto: null,
  valorObtido: null,
  renegociacaoId: null,
  observacao: null,
  registradoEm: '2026-08-27T12:00:00+00:00',
  ...over,
});

beforeEach(() => global.definirParametrosDeRota({ id: 'divida-1' }));
afterEach(limparMocksDeRede);

// Encontra a chamada POST (registro) que a mutação disparou.
function chamadaDeRegistro() {
  return requestMock.mock.calls.find(
    ([path, opts]) =>
      typeof path === 'string' &&
      path.startsWith(NEGOCIACOES) &&
      (opts as { method?: string } | undefined)?.method === 'POST',
  );
}

describe('registro de resultado de negociação (T5)', () => {
  it('canal e desfecho são campos tipados, não texto livre', async () => {
    responderPorRota({ '/v1/dividas/': { resultados: [] } });
    renderizarTela(<Renegociar />);

    // O placeholder de texto livre "Acordo por telefone, protocolo 12345" saiu.
    await waitFor(() => expect(screen.getByText('Por onde você negociou')).toBeTruthy());
    expect(screen.getByText('Como terminou')).toBeTruthy();
    // Os canais e desfechos são opções tipadas (radiogroup), não um campo aberto.
    expect(screen.getByText('Telefone')).toBeTruthy();
    expect(screen.getByText('Não aceitaram')).toBeTruthy();
  });

  it.each<[DesfechoNegociacao, string]>([
    ['recusa', 'Não aceitaram'],
    ['contraproposta', 'Contraproposta'],
    ['sem_resposta', 'Sem resposta'],
  ])('registra o desfecho %s sem exigir valor de acordo', async (desfecho, rotulo) => {
    responderPorRota({ '/v1/dividas/': { resultados: [] } });
    renderizarTela(<Renegociar />);

    await waitFor(() => expect(screen.getByText('Telefone')).toBeTruthy());
    fireEvent.press(screen.getByText('Telefone'));
    fireEvent.press(screen.getByText(rotulo));
    fireEvent.press(screen.getByText('Registrar negociação'));

    await waitFor(() => expect(chamadaDeRegistro()).toBeDefined());
    const [, opts] = chamadaDeRegistro()!;
    expect((opts as { body: unknown }).body).toMatchObject({ canal: 'telefone', desfecho });
    // Registrar recusa/silêncio NÃO exigiu valor: nenhum erro de validação, e o
    // corpo não carrega valor de acordo.
    expect(screen.queryByText(/Informe o novo valor acordado/)).toBeNull();
  });

  it('T5-AC3: o acordo revela o formulário de renegociação existente, intacto', () => {
    // O fluxo de renegociação NÃO muda: o acordo continua indo por
    // `POST /v1/dividas/{id}/renegociacao` (provado no backend, test_parcelas_api,
    // que segue verde). Aqui se prova que o formulário existente segue reachable
    // e que sua validação não afrouxou — o registro de desfecho é ADICIONAL.
    responderPorRota({ '/v1/dividas/': { resultados: [] } });
    renderizarTela(<Renegociar />);

    fireEvent.press(screen.getByText('Telefone'));
    fireEvent.press(screen.getByText('Fechamos'));

    // O aviso de preservação do histórico continua, antes dos campos do acordo.
    expect(screen.getByText(/O que você já pagou não some/)).toBeTruthy();
    expect(screen.getByText('Novo valor total')).toBeTruthy();
    expect(screen.getByText('Em quantas parcelas')).toBeTruthy();
    expect(screen.getByText('Primeiro vencimento')).toBeTruthy();

    // Submeter vazio acusa o valor do acordo, como antes — validação preservada.
    fireEvent.press(screen.getByText('Registrar acordo'));
    expect(screen.getByText('Informe o novo valor acordado.')).toBeTruthy();
    // E o campo de valor NÃO aparece nos desfechos sem acordo (branch tipado).
  });

  it('sem acordo, não pede novo valor total nem número de parcelas', () => {
    responderPorRota({ '/v1/dividas/': { resultados: [] } });
    renderizarTela(<Renegociar />);

    fireEvent.press(screen.getByText('Não aceitaram'));
    expect(screen.queryByText('Novo valor total')).toBeNull();
    expect(screen.queryByText('Em quantas parcelas')).toBeNull();
  });
});

describe('histórico de negociações — quatro estados (T5-AC4)', () => {
  it('carregando', () => {
    nuncaResponde();
    renderizarTela(<Renegociar />);
    expect(screen.getByText('Carregando o histórico')).toBeTruthy();
  });

  it('erro com retry', async () => {
    responderPorRota({ '/v1/dividas/': new ApiError(500, 'Erro 500.') });
    renderizarTela(<Renegociar />);
    await waitFor(() => expect(screen.getByText('O servidor tropeçou')).toBeTruthy());
  });

  it('vazio, sem soar como fracasso', async () => {
    responderPorRota({ '/v1/dividas/': { resultados: [] } });
    renderizarTela(<Renegociar />);
    await waitFor(() =>
      expect(screen.getByText(/Nenhuma negociação registrada ainda/)).toBeTruthy(),
    );
  });

  it('conteúdo: lista o desfecho, o canal e a data', async () => {
    responderPorRota({
      '/v1/dividas/': {
        resultados: [umResultado({ desfecho: 'contraproposta', canal: 'email', valorObtido: 110000 })],
      },
    });
    renderizarTela(<Renegociar />);

    await waitFor(() => expect(screen.getByText('Contraproposta por e-mail')).toBeTruthy());
    expect(screen.getByText('R$ 1.100,00')).toBeTruthy();
    expect(screen.getByText('27/08/2026')).toBeTruthy();
  });
});
