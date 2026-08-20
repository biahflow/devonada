import { Text } from 'react-native';
import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import MarcoRota from '../../../app/(marco)/[tipo]';
import { useMarcoPendente } from '../../hooks/useMarcos';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, nuncaResponde, requestMock, responderPorRota } from '../api';
import { umCaixa } from '../mocks';
import { renderizarTela } from '../render';
import type { Marco } from '../../api/types';

beforeEach(() => global.definirParametrosDeRota({ tipo: 'rota_25' }));
afterEach(limparMocksDeRede);

/** Os cinco tipos vêm sempre, e a ausência é dita — nunca omitida. */
function osMarcos(over: Partial<Record<Marco['tipo'], Partial<Marco>>> = {}): Marco[] {
  const base: Marco[] = [
    { tipo: 'primeira_negociacao', atingidoEm: null, celebradoEm: null },
    { tipo: 'primeira_quitacao', atingidoEm: null, celebradoEm: null },
    { tipo: 'rota_25', atingidoEm: '2026-08-02', celebradoEm: null },
    { tipo: 'rota_50', atingidoEm: null, celebradoEm: null },
    { tipo: 'rota_75', atingidoEm: null, celebradoEm: null },
  ];
  return base.map((m) => ({ ...m, ...over[m.tipo] }));
}

function comSaldo(respiroSaldoAcumulado: number | null, marcos: Marco[] = osMarcos()) {
  responderPorRota({
    // A rota da celebração vem PRIMEIRO: `/v1/marcos/rota_25/celebracao`
    // também começa com `/v1/marcos`, e o mock casa por prefixo.
    '/v1/marcos/': undefined,
    '/v1/marcos': { marcos },
    '/v1/caixa/respiro/destinacao': { respiroSaldoAcumulado: 0 },
    '/v1/caixa': { caixa: umCaixa({ respiro: 15000, respiroSaldoAcumulado }) },
  });
}

describe('MarcoScreen (T7, ADR 0019)', () => {
  it('T7-AC4 (carregando): espera marcos e caixa antes de celebrar qualquer coisa', () => {
    nuncaResponde();
    renderizarTela(<MarcoRota />);
    expect(screen.getByText('Buscando sua conquista')).toBeTruthy();
  });

  it('T7-AC4 (saldo acumulado): mostra a conquista e o respiro liberado com valor concreto', async () => {
    comSaldo(22000);
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText('Respiro liberado')).toBeTruthy());
    expect(screen.getByText('Um quarto\nda rota.')).toBeTruthy();
    // O valor vem PRONTO de `GET /v1/caixa` — a tela não soma nada.
    expect(screen.getByText('R$ 220,00')).toBeTruthy();
    expect(screen.getByText('Aproveita. Tá no plano.')).toBeTruthy();
  });

  it('T7-AC4 (saldo zero): não exibe "R$ 0,00" como se fosse conquista', async () => {
    // `0` é respiro declarado sem nada guardado ainda — estado real, e
    // diferente de nunca ter declarado.
    comSaldo(0);
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText('Seu respiro')).toBeTruthy());
    expect(screen.getByText(/Ainda não tem nada guardado/)).toBeTruthy();
    expect(screen.queryByText('0,00')).toBeNull();
    expect(screen.queryByText('R$ 0,00')).toBeNull();
  });

  it('T7-AC4 (sem respiro declarado): convida em vez de prometer um respiro que não existe', async () => {
    // `null` é NUNCA DECLAROU. Não existe default (ADR 0019, item 2), então a
    // tela não pode dizer que há uma fatia esperando.
    comSaldo(null);
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText(/ainda não declarou seu respiro/)).toBeTruthy());
    expect(screen.queryByText('Respiro liberado')).toBeNull();
  });

  it('T7-AC3: a sugestão contextual é texto e nunca carrega valor monetário', async () => {
    // O modo de falha que este teste existe para impedir: "que tal um jantar de
    // R$ 120?" — o coeficiente sem fonte da ADR 0019 voltando com outra roupa.
    for (const centavos of [4000, 20000, 90000]) {
      limparMocksDeRede();
      comSaldo(centavos);
      const { unmount } = renderizarTela(<MarcoRota />);

      const sugestao = await screen.findByText(/^Dá pra/);
      const texto = String(sugestao.props.children);
      expect(texto).not.toContain('R$');
      expect(texto).not.toMatch(/\d/);
      unmount();
    }
  });

  it('T7-AC5: abrir a tela não celebra nada — nenhuma escrita sem toque', async () => {
    comSaldo(22000);
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText('Respiro liberado')).toBeTruthy());
    const escritas = requestMock.mock.calls.filter(([, opts]) => opts?.method !== undefined);
    expect(escritas).toEqual([]);
  });

  it('T7-AC2: "Aproveita" grava celebradoEm e sai, sem mover o saldo', async () => {
    comSaldo(22000);
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText('Aproveita. Tá no plano.')).toBeTruthy());
    fireEvent.press(screen.getByText('Aproveita. Tá no plano.'));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('/v1/marcos/rota_25/celebracao', { method: 'POST' }),
    );
    // O respiro CONTINUA ACUMULADO: o marco libera, não gasta. Quem decide onde
    // usar é o usuário, na aba de caixa.
    expect(requestMock).not.toHaveBeenCalledWith(
      '/v1/caixa/respiro/destinacao',
      expect.anything(),
    );
    expect(global.mockRouter.replace).toHaveBeenCalledWith('/painel');
  });

  it('T7-AC2: "Guardar pro próximo marco" destina o acumulado E grava celebradoEm', async () => {
    comSaldo(22000);
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText('Guardar pro próximo marco')).toBeTruthy());
    fireEvent.press(screen.getByText('Guardar pro próximo marco'));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('/v1/caixa/respiro/destinacao', {
        method: 'POST',
        body: { valor: 22000 },
      }),
    );
    expect(requestMock).toHaveBeenCalledWith('/v1/marcos/rota_25/celebracao', { method: 'POST' });
    expect(global.mockRouter.replace).toHaveBeenCalledWith('/painel');
  });

  it('sem saldo, "guardar" não destina nada — só celebra e sai', async () => {
    comSaldo(0);
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText('Guardar pro próximo marco')).toBeTruthy());
    fireEvent.press(screen.getByText('Guardar pro próximo marco'));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('/v1/marcos/rota_25/celebracao', { method: 'POST' }),
    );
    expect(requestMock).not.toHaveBeenCalledWith(
      '/v1/caixa/respiro/destinacao',
      expect.anything(),
    );
  });

  it('sai da tela mesmo quando a escrita falha — nem o paywall prende ninguém', async () => {
    // `402` é o período somente leitura. O marco NÃO se perde: `celebradoEm`
    // continua nulo e a tela volta quando a assinatura voltar.
    responderPorRota({
      '/v1/marcos/': new ApiError(402, 'Seu período de teste acabou.'),
      '/v1/marcos': { marcos: osMarcos() },
      '/v1/caixa': { caixa: umCaixa({ respiro: 15000, respiroSaldoAcumulado: 22000 }) },
    });
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText('Aproveita. Tá no plano.')).toBeTruthy());
    fireEvent.press(screen.getByText('Aproveita. Tá no plano.'));

    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/painel'));
  });
});

describe('quando a tela NÃO deve aparecer', () => {
  it('T7-AC2: marco já celebrado não reabre a tela', async () => {
    // O modo de falha que vira desinstalação: a celebração reaparecendo a cada
    // abertura do app.
    comSaldo(22000, osMarcos({ rota_25: { celebradoEm: '2026-08-03' } }));
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/painel'));
    expect(screen.queryByText('Aproveita. Tá no plano.')).toBeNull();
  });

  it('marco ainda não atingido não celebra nada', async () => {
    comSaldo(22000, osMarcos({ rota_25: { atingidoEm: null } }));
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/painel'));
    expect(screen.queryByText('Aproveita. Tá no plano.')).toBeNull();
  });

  it('tipo desconhecido na rota volta para a rota do usuário', async () => {
    global.definirParametrosDeRota({ tipo: 'rota_99' });
    comSaldo(22000);
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/painel'));
  });

  it('T7-AC4 (erro): falha de leitura sai sem gravar, e a conquista volta depois', async () => {
    responderPorRota({
      '/v1/marcos': new ApiError(500, 'Erro 500.'),
      '/v1/caixa': { caixa: umCaixa() },
    });
    renderizarTela(<MarcoRota />);

    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/painel'));
    const escritas = requestMock.mock.calls.filter(([, opts]) => opts?.method !== undefined);
    expect(escritas).toEqual([]);
  });
});

/**
 * A SONDA LÊ O MESMO CACHE QUE `PortaDeEntrada` (app/_layout.tsx). É o que
 * torna o teste abaixo um oráculo do defeito real: lá, `useMarcoPendente`
 * re-renderiza a cada mudança de segmento de rota, e a navegação de saída
 * acontece no mesmo tick do toque.
 */
function SondaDeMarcoPendente() {
  const pendente = useMarcoPendente();
  return <Text>{`pendente: ${pendente?.tipo ?? 'nenhum'}`}</Text>;
}

describe('a tela não puxa o usuário de volta ao sair', () => {
  it('marca o marco como celebrado ANTES de a rede responder', async () => {
    comSaldo(22000);
    renderizarTela(
      <>
        <MarcoRota />
        <SondaDeMarcoPendente />
      </>,
    );

    await waitFor(() => expect(screen.getByText('Aproveita. Tá no plano.')).toBeTruthy());
    expect(screen.getByText('pendente: rota_25')).toBeTruthy();

    // A celebração não responde NUNCA. Se a marca dependesse da resposta, o
    // marco continuaria pendente para sempre — e `PortaDeEntrada`, que relê
    // este mesmo cache a cada navegação, mandaria o usuário de volta para a
    // celebração que ele acabou de fechar.
    requestMock.mockReturnValue(new Promise(() => {}));
    fireEvent.press(screen.getByText('Aproveita. Tá no plano.'));

    await waitFor(() => expect(screen.getByText('pendente: nenhum')).toBeTruthy());
  });

  it('o marco continua celebrado localmente mesmo quando o servidor recusa a escrita', async () => {
    // `402` é o período somente leitura. Desfazer a marca aqui devolveria o
    // marco à condição de pendente e reabriria o laço — por isso não há
    // rollback. O servidor mantém `celebradoEm: null`, e a conquista volta no
    // próximo refetch.
    responderPorRota({
      '/v1/marcos/': new ApiError(402, 'Seu período de teste acabou.'),
      '/v1/marcos': { marcos: osMarcos() },
      '/v1/caixa': { caixa: umCaixa({ respiro: 15000, respiroSaldoAcumulado: 22000 }) },
    });
    renderizarTela(
      <>
        <MarcoRota />
        <SondaDeMarcoPendente />
      </>,
    );

    await waitFor(() => expect(screen.getByText('Aproveita. Tá no plano.')).toBeTruthy());
    fireEvent.press(screen.getByText('Aproveita. Tá no plano.'));

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('/v1/marcos/rota_25/celebracao', { method: 'POST' }),
    );
    expect(screen.getByText('pendente: nenhum')).toBeTruthy();
  });
});

describe('copy da celebração', () => {
  it('celebra sem condicionar, sem mérito e sem prestação de contas', async () => {
    // Guardrail 4.1: a copy é de PERMISSÃO. "Você mereceu" condicionaria o
    // respiro a desempenho, e é a incondicionalidade dele que faz a culpa
    // morrer.
    comSaldo(22000);
    const { toJSON } = renderizarTela(<MarcoRota />);

    await waitFor(() => expect(screen.getByText('Respiro liberado')).toBeTruthy());

    const texto = JSON.stringify(toJSON()).toLowerCase();
    for (const proibida of [
      'você já gastou',
      'você mereceu',
      'você merece',
      'se você economizar',
      'desvio',
      'extrapolou',
    ]) {
      expect(texto).not.toContain(proibida);
    }
  });
});
