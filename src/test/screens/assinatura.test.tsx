import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as iap from 'expo-iap';
import Assinatura from '../../../app/(tabs)/painel/assinatura';
import { AvisoSomenteLeitura } from '../../components/ui/AvisoSomenteLeitura';
import { ErroDeMutacao } from '../../components/ui/ErroDeMutacao';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { renderizarTela } from '../render';

const EM_TESTE = {
  status: 'em_teste',
  podeEscrever: true,
  expiraEm: '2026-08-14T00:00:00Z',
  diasRestantes: 5,
  produtoId: null,
  renovacaoAutomatica: null,
};

const EXPIRADA = {
  status: 'expirada',
  podeEscrever: false,
  expiraEm: '2026-08-01T00:00:00Z',
  diasRestantes: 0,
  produtoId: null,
  renovacaoAutomatica: null,
};

const ATIVA = {
  status: 'ativa',
  podeEscrever: true,
  expiraEm: '2026-09-06T00:00:00Z',
  diasRestantes: 30,
  produtoId: 'devonada.assinatura.mensal',
  renovacaoAutomatica: true,
};

afterEach(() => {
  limparMocksDeRede();
  jest.clearAllMocks();
});

function tocarBotao(nome: string | RegExp) {
  fireEvent.press(screen.getByRole('button', { name: nome }));
}

describe('Tela de assinatura — os quatro estados', () => {
  it('carregando', () => {
    nuncaResponde();
    renderizarTela(<Assinatura />);
    expect(screen.getByText(/carregando sua assinatura/i)).toBeTruthy();
  });

  it('erro, com repetir', async () => {
    responderPorRota({ '/v1/assinatura': new ApiError(0, 'Sem conexão com o servidor.') });
    renderizarTela(<Assinatura />);
    expect(await screen.findByText(/sem conexão/i)).toBeTruthy();
  });

  it('em teste — diz quanto falta e o que acontece depois', async () => {
    responderPorRota({ '/v1/assinatura': EM_TESTE });
    renderizarTela(<Assinatura />);

    expect(await screen.findByText('Período de teste')).toBeTruthy();
    expect(screen.getByText(/faltam 5 dias/i)).toBeTruthy();
    expect(screen.getByText(/somente leitura até você assinar/i)).toBeTruthy();
  });

  it('ativa — não oferece assinar de novo', async () => {
    responderPorRota({ '/v1/assinatura': ATIVA });
    renderizarTela(<Assinatura />);

    expect(await screen.findByText('Assinatura ativa')).toBeTruthy();
    expect(screen.getByText(/renova em 30 dias/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Assinar/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Gerenciar no sistema' })).toBeTruthy();
  });
});

describe('Preço', () => {
  it('mostra o preço que a LOJA informou, não um número do app', async () => {
    responderPorRota({ '/v1/assinatura': EXPIRADA });
    renderizarTela(<Assinatura />);

    expect(await screen.findByRole('button', { name: 'Assinar por R$ 19,90' })).toBeTruthy();
  });

  it('sem plano carregado, o botão NÃO inventa preço nenhum', async () => {
    (iap.fetchProducts as jest.Mock).mockResolvedValueOnce([]);
    responderPorRota({ '/v1/assinatura': EXPIRADA });
    renderizarTela(<Assinatura />);

    expect(await screen.findByRole('button', { name: 'Assinar' })).toBeTruthy();
    expect(screen.queryByText(/R\$/)).toBeNull();
  });
});

describe('Ciclo de compra', () => {
  it('só encerra a transação DEPOIS que o backend confirma', async () => {
    // A regra mais importante do M9 no cliente. Encerrar antes deixaria o
    // usuário cobrado com o servidor sem saber, e a loja não reentrega o que já
    // foi reconhecido — ele ficaria pagando por um app travado.
    let entregarCompra: ((c: unknown) => void) | undefined;
    (iap.purchaseUpdatedListener as jest.Mock).mockImplementation((cb) => {
      entregarCompra = cb;
      return { remove: jest.fn() };
    });

    const ordem: string[] = [];
    (iap.finishTransaction as jest.Mock).mockImplementation(async () => {
      ordem.push('encerrar');
    });
    requestMock.mockImplementation(async (path: string) => {
      if (path === '/v1/assinatura/compra') {
        ordem.push('backend');
        return ATIVA as never;
      }
      return EXPIRADA as never;
    });

    renderizarTela(<Assinatura />);
    await screen.findByText('Somente leitura');

    entregarCompra?.({ purchaseToken: 'recibo-da-loja', id: '1' });

    await waitFor(() => expect(ordem).toEqual(['backend', 'encerrar']));
  });

  it('não encerra a transação quando o backend recusa', async () => {
    // Ela fica na fila da loja e volta na próxima abertura — a segunda chance
    // de quem pagou e perdeu a rede no pior instante.
    let entregarCompra: ((c: unknown) => void) | undefined;
    (iap.purchaseUpdatedListener as jest.Mock).mockImplementation((cb) => {
      entregarCompra = cb;
      return { remove: jest.fn() };
    });

    requestMock.mockImplementation(async (path: string) => {
      if (path === '/v1/assinatura/compra') {
        throw new ApiError(422, 'Não deu para conferir sua compra com a App Store.');
      }
      return EXPIRADA as never;
    });

    renderizarTela(<Assinatura />);
    await screen.findByText('Somente leitura');

    entregarCompra?.({ purchaseToken: 'recibo-da-loja', id: '1' });

    expect(await screen.findByText(/conferir sua compra/i)).toBeTruthy();
    expect(iap.finishTransaction).not.toHaveBeenCalled();
  });

  it('o app envia SÓ o recibo — nunca a própria validade', async () => {
    let entregarCompra: ((c: unknown) => void) | undefined;
    (iap.purchaseUpdatedListener as jest.Mock).mockImplementation((cb) => {
      entregarCompra = cb;
      return { remove: jest.fn() };
    });
    responderPorRota({ '/v1/assinatura': EXPIRADA, '/v1/assinatura/compra': ATIVA });

    renderizarTela(<Assinatura />);
    await screen.findByText('Somente leitura');

    entregarCompra?.({ purchaseToken: 'recibo-da-loja', id: '1', expiryTime: 'qualquer' });

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith(
        '/v1/assinatura/compra',
        expect.objectContaining({
          body: { plataforma: expect.any(String), recibo: 'recibo-da-loja' },
        }),
      ),
    );
  });

  it('restaurar sem nenhuma compra diz isso em vez de falhar calado', async () => {
    responderPorRota({ '/v1/assinatura': EXPIRADA });
    renderizarTela(<Assinatura />);
    await screen.findByText('Somente leitura');

    tocarBotao('Restaurar compras');

    expect(await screen.findByText(/não encontramos nenhuma assinatura/i)).toBeTruthy();
  });
});

describe('Promessa de leitura livre', () => {
  it('a tela de venda diz que nada some por falta de pagamento', async () => {
    // A promessa que sustenta o paywall precisa estar onde ela é cobrada: na
    // hora de decidir pagar, e não só na documentação.
    responderPorRota({ '/v1/assinatura': EXPIRADA });
    renderizarTela(<Assinatura />);

    expect(await screen.findByText(/ver o que você já cadastrou é livre/i)).toBeTruthy();
  });
});

describe('Aviso de somente leitura', () => {
  it('não aparece enquanto a situação está carregando', () => {
    nuncaResponde();
    renderizarTela(<AvisoSomenteLeitura />);
    expect(screen.queryByText(/somente leitura/i)).toBeNull();
  });

  it('não aparece para quem está em dia', async () => {
    responderPorRota({ '/v1/assinatura': ATIVA });
    renderizarTela(<AvisoSomenteLeitura />);

    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    expect(screen.queryByText(/somente leitura/i)).toBeNull();
  });

  it('aparece quando o teste acabou, e leva à assinatura', async () => {
    responderPorRota({ '/v1/assinatura': EXPIRADA });
    renderizarTela(<AvisoSomenteLeitura />);

    const faixa = await screen.findByRole('button', { name: /somente leitura/i });
    fireEvent.press(faixa);
    expect(global.mockRouter.push).toHaveBeenCalledWith('/painel/assinatura');
  });
});

describe('Erro de mutação', () => {
  it('402 vira aviso com caminho para a assinatura, não erro genérico', () => {
    renderizarTela(
      <ErroDeMutacao error={new ApiError(402, 'Seu período de teste terminou.')} />,
    );

    expect(screen.getByText('Seu período de teste terminou.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Ver assinatura' }));
    expect(global.mockRouter.push).toHaveBeenCalledWith('/painel/assinatura');
  });

  it('erro comum continua erro comum, sem botão de assinatura', () => {
    renderizarTela(<ErroDeMutacao error={new ApiError(422, 'Confira os dados enviados.')} />);

    expect(screen.getByText('Confira os dados enviados.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver assinatura' })).toBeNull();
  });

  it('sem erro, não renderiza nada', () => {
    const { toJSON } = renderizarTela(<ErroDeMutacao error={null} />);
    expect(toJSON()).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver assinatura' })).toBeNull();
  });
});
