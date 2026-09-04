import * as iap from 'expo-iap';
import { LojaIndisponivel, aoComprar, conectar } from '../compras';
import { rodandoNoExpoGo } from '../config/expoGo';

/**
 * A fronteira com o SDK da loja — o módulo de verdade, contra o `expo-iap`
 * mockado em `jest.setup.js`.
 *
 * `assinatura.test.tsx` já cobre o CICLO de compra através da tela; o que
 * falta e este arquivo prova é o comportamento no Expo Go: nenhuma das
 * funções de fronteira pode tocar o SDK quando o módulo nativo não existe.
 *
 * `../config/expoGo` é mockado (não `expo-constants` direto), pelo mesmo
 * motivo do `src/test/social.test.ts`: o que se testa aqui é o que
 * `src/compras/` FAZ com a resposta, não como o helper a obtém.
 */
jest.mock('../config/expoGo');

const expoGoMock = rodandoNoExpoGo as jest.MockedFunction<typeof rodandoNoExpoGo>;

afterEach(() => {
  jest.clearAllMocks();
  expoGoMock.mockReturnValue(false);
});

describe('conectar()', () => {
  it('no Expo Go lança LojaIndisponivel sem tocar o SDK', async () => {
    expoGoMock.mockReturnValue(true);

    await expect(conectar()).rejects.toBeInstanceOf(LojaIndisponivel);
    expect(iap.initConnection).not.toHaveBeenCalled();
  });

  it('fora do Expo Go chama initConnection normalmente', async () => {
    // Regressão: o comportamento de hoje não pode mudar fora do Expo Go.
    expoGoMock.mockReturnValue(false);

    await conectar();
    expect(iap.initConnection).toHaveBeenCalled();
  });
});

describe('aoComprar()', () => {
  it('no Expo Go devolve limpeza vazia, sem registrar listener no SDK', () => {
    expoGoMock.mockReturnValue(true);

    const limpar = aoComprar(jest.fn(), jest.fn());

    expect(iap.purchaseUpdatedListener).not.toHaveBeenCalled();
    expect(iap.purchaseErrorListener).not.toHaveBeenCalled();
    // A limpeza continua segura de chamar, mesmo sem listener nenhum
    // registrado — quem desmonta a tela não sabe (nem precisa saber) que
    // está no Expo Go.
    expect(() => limpar()).not.toThrow();
  });

  it('fora do Expo Go registra os dois listeners normalmente', () => {
    // Regressão: chamado dentro de um `useEffect` (`useComprar`); se isto
    // parar de registrar listener fora do Expo Go, a compra entregue por
    // evento deixa de ser recebida.
    expoGoMock.mockReturnValue(false);

    aoComprar(jest.fn(), jest.fn());

    expect(iap.purchaseUpdatedListener).toHaveBeenCalled();
    expect(iap.purchaseErrorListener).toHaveBeenCalled();
  });
});
