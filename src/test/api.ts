import { request, upload } from '../api/client';

/**
 * Acesso tipado aos mocks de rede definidos em jest.setup.js.
 *
 * `responderPorRota` é o padrão preferido: em vez de encadear
 * `mockResolvedValueOnce`, o teste declara o que cada rota devolve. Isso
 * sobrevive a mudanças na ORDEM das chamadas, que é exatamente o que muda
 * quando alguém refatora um hook.
 */
export const requestMock = request as jest.MockedFunction<typeof request>;
export const uploadMock = upload as jest.MockedFunction<typeof upload>;

type Respostas = Record<string, unknown>;

export function responderPorRota(respostas: Respostas) {
  requestMock.mockImplementation((path: string) => {
    const chave = Object.keys(respostas).find((rota) => path.startsWith(rota));
    if (chave === undefined) {
      return Promise.reject(new Error(`Rota não mockada no teste: ${path}`));
    }
    const valor = respostas[chave];
    return valor instanceof Error
      ? Promise.reject(valor)
      : (Promise.resolve(valor) as ReturnType<typeof request>);
  });
}

/** Deixa a promessa pendente para exercitar o estado de carregamento. */
export function nuncaResponde() {
  requestMock.mockImplementation(() => new Promise(() => {}));
}

export function limparMocksDeRede() {
  requestMock.mockReset();
  uploadMock.mockReset();
}
