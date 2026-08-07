/**
 * O único teste do repositório que usa o `client.ts` DE VERDADE.
 *
 * `jest.setup.js` mocka `request` e `upload` para cortar a rede de todo teste de
 * tela. Aqui é o contrário: o que está sob teste é justamente o que aquele mock
 * substitui — a renovação silenciosa da sessão, que é a peça mais fácil de
 * quebrar do M8 e a que nenhum outro gate exercita.
 */
jest.unmock('../../api/client');

/**
 * O "aparelho": o SecureStore falso guarda aqui.
 *
 * O prefixo `mock` no nome não é estilo — o babel do jest recusa fábrica de
 * mock que referencie variável de fora do escopo, e abre exceção só para esse
 * prefixo.
 */
const mockAparelho = new Map<string, string>();

/**
 * A implementação vive DENTRO da fábrica de propósito.
 *
 * `jest.resetModules()`, que cada teste precisa para zerar a promise de
 * renovação, faz a fábrica rodar de novo — implementações definidas fora dela,
 * num `beforeEach`, seriam descartadas, e `deleteItemAsync()` passaria a
 * devolver `undefined`. O mapa é de módulo e sobrevive ao reset.
 */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((k: string) => Promise.resolve(mockAparelho.get(k) ?? null)),
  setItemAsync: jest.fn((k: string, v: string) => {
    mockAparelho.set(k, v);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((k: string) => {
    mockAparelho.delete(k);
    return Promise.resolve();
  }),
}));

function resposta(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(corpo)),
    json: () => Promise.resolve(corpo),
  } as unknown as Response;
}

const SESSAO_NOVA = {
  sessao: { acesso: 'acesso-novo', refresh: 'refresh-novo', expiraEm: '2026-08-07T14:15:00Z' },
};

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  mockAparelho.clear();
  mockAparelho.set('auth_access', 'acesso-velho');
  mockAparelho.set('auth_refresh', 'refresh-velho');

  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

/**
 * `require` tardio, e não `import` estático: cada teste precisa do módulo com a
 * promise de renovação zerada, e é `jest.resetModules()` no `beforeEach` que
 * garante isso. Import no topo carregaria uma vez só, e o teste da renovação
 * única passaria a depender da ordem dos testes.
 */
const carregarClient = () => require('../../api/client') as typeof import('../../api/client');

describe('renovação silenciosa da sessão', () => {
  it('renova e repete a requisição, sem o usuário ver nada', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, { message: 'Sua sessão expirou.' }))
      .mockResolvedValueOnce(resposta(200, SESSAO_NOVA))
      .mockResolvedValueOnce(resposta(200, { dividas: [] }));

    const { request } = carregarClient();
    await expect(request('/v1/dividas')).resolves.toEqual({ dividas: [] });

    // A terceira chamada — a repetição — leva o token NOVO. Sem isso a
    // renovação teria acontecido e a requisição repetiria com a credencial que
    // acabou de ser recusada.
    const [, opcoes] = fetchMock.mock.calls[2];
    expect(opcoes.headers.Authorization).toBe('Bearer acesso-novo');
  });

  it('guarda o par novo no armazenamento seguro', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, {}))
      .mockResolvedValueOnce(resposta(200, SESSAO_NOVA))
      .mockResolvedValueOnce(resposta(200, {}));

    const { request } = carregarClient();
    await request('/v1/dividas');

    expect(mockAparelho.get('auth_access')).toBe('acesso-novo');
    expect(mockAparelho.get('auth_refresh')).toBe('refresh-novo');
  });

  it('dez requisições simultâneas disparam UMA renovação', async () => {
    // O modo de falha que este teste vigia: o servidor rotaciona o refresh a
    // cada uso, então dez renovações paralelas produziriam um par válido e nove
    // 401 com refresh já revogado — a sessão morreria no boot do app.
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/v1/auth/refresh')) return Promise.resolve(resposta(200, SESSAO_NOVA));
      const token = mockAparelho.get('auth_access');
      return Promise.resolve(
        token === 'acesso-novo' ? resposta(200, { ok: true }) : resposta(401, {}),
      );
    });

    const { request } = carregarClient();
    await Promise.all(Array.from({ length: 10 }, () => request('/v1/dividas')));

    const renovacoes = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/v1/auth/refresh'),
    );
    expect(renovacoes).toHaveLength(1);
  });

  it('renovação recusada apaga a credencial e derruba a sessão', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, {}))
      .mockResolvedValueOnce(resposta(401, { message: 'Sua sessão expirou.' }));

    const { request } = carregarClient();
    const { estadoAtual } = require('../../api/sessao') as typeof import('../../api/sessao');

    await expect(request('/v1/dividas')).rejects.toMatchObject({ status: 401 });
    expect(mockAparelho.has('auth_refresh')).toBe(false);
    expect(estadoAtual()).toBe('anonimo');
  });

  it('falha de REDE na renovação não desloga', async () => {
    // Deslogar aqui expulsaria quem entrou no elevador — a credencial dele
    // continua boa, quem sumiu foi a rede.
    fetchMock
      .mockResolvedValueOnce(resposta(401, {}))
      .mockRejectedValueOnce(new Error('sem rede'));

    const { request } = carregarClient();
    await expect(request('/v1/dividas')).rejects.toBeDefined();
    expect(mockAparelho.get('auth_refresh')).toBe('refresh-velho');
  });

  it('não tenta renovar duas vezes na mesma requisição', async () => {
    fetchMock
      .mockResolvedValueOnce(resposta(401, {}))
      .mockResolvedValueOnce(resposta(200, SESSAO_NOVA))
      .mockResolvedValueOnce(resposta(401, {}));

    const { request } = carregarClient();
    await expect(request('/v1/dividas')).rejects.toMatchObject({ status: 401 });

    // Quatro chamadas seria insistir com uma credencial recusada duas vezes.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('as rotas de conta não tentam renovar', async () => {
    // Senha errada no login é 401, e tratá-lo como sessão vencida apagaria a
    // credencial de quem só errou de digitar.
    fetchMock.mockResolvedValueOnce(resposta(401, { message: 'E-mail ou senha não conferem.' }));

    const { request } = carregarClient();
    await expect(
      request('/v1/auth/login', { method: 'POST', body: {}, semRenovacao: true }),
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockAparelho.get('auth_refresh')).toBe('refresh-velho');
  });

  it('sem refresh guardado, não chama a rota de renovação', async () => {
    mockAparelho.delete('auth_refresh');
    fetchMock.mockResolvedValueOnce(resposta(401, {}));

    const { request } = carregarClient();
    await expect(request('/v1/dividas')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
