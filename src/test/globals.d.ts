/**
 * Globais definidos em jest.setup.js. Sem esta declaração o TypeScript acusa
 * TS7017 em todo teste que ajusta parâmetro de rota.
 */
declare global {
  var mockRouter: {
    push: jest.Mock;
    replace: jest.Mock;
    back: jest.Mock;
    navigate: jest.Mock;
  };
  var definirParametrosDeRota: (params: Record<string, string>) => void;
}

export {};
