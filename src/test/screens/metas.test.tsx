import { screen, waitFor } from '@testing-library/react-native';
import Metas from '../../../app/(tabs)/metas/index';
import { limparMocksDeRede, nuncaResponde, responderPorRota } from '../api';
import { renderizarTela } from '../render';
import type { Meta } from '../../api/types';

afterEach(limparMocksDeRede);

function umaMeta(over: Partial<Meta> = {}): Meta {
  return {
    id: 'meta-1',
    nome: 'Reserva de emergência',
    emoji: '🛟',
    valorAlvo: 1_340_000,
    saldo: 536_000,
    dataAlvo: '2027-08',
    aporteMensal: 67_000,
    aporteSugerido: 67_000,
    status: 'em_dia',
    ...over,
  };
}

function comMetas(metas: Meta[]) {
  responderPorRota({ '/v1/metas': { metas } });
}

describe('aba Metas', () => {
  describe('os quatro estados', () => {
    it('carregando', () => {
      nuncaResponde();
      renderizarTela(<Metas />);
      expect(screen.getByText('Carregando suas metas')).toBeTruthy();
    });

    it('erro, com caminho de tentar de novo', async () => {
      responderPorRota({ '/v1/metas': new Error('sem rede') });
      renderizarTela(<Metas />);
      expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
    });

    // Vazio é oportunidade, não beco: as duas saídas existem, e uma delas é a
    // volta para dívidas — na fase verde esta aba OCUPA o lugar daquela.
    it('vazio oferece criar meta e ver dívidas', async () => {
      comMetas([]);
      renderizarTela(<Metas />);

      await waitFor(() => expect(screen.getByText('Nenhuma meta ainda')).toBeTruthy());
      expect(screen.getByRole('button', { name: 'Criar uma meta' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Ver minhas dívidas' })).toBeTruthy();
    });

    it('conteúdo lista as metas com guardado e aporte', async () => {
      comMetas([umaMeta()]);
      renderizarTela(<Metas />);

      await waitFor(() => expect(screen.getByText('🛟 Reserva de emergência')).toBeTruthy());
      expect(screen.getByText('R$ 5.360,00')).toBeTruthy();
      expect(screen.getByText('R$ 670,00')).toBeTruthy();
      expect(screen.getByText(/meta R\$ 13\.400,00/)).toBeTruthy();
    });
  });

  describe('o selo de situação', () => {
    it('em dia quando o servidor diz em dia', async () => {
      comMetas([umaMeta({ status: 'em_dia' })]);
      renderizarTela(<Metas />);
      expect(await screen.findByText('Em dia')).toBeTruthy();
    });

    // ÂMBAR, NUNCA VERMELHO — mas o teste checa o rótulo, não a cor: cor sozinha
    // não pode carregar a informação (design-system, seção 5).
    it('aporte baixo quando o servidor diz aporte baixo', async () => {
      comMetas([umaMeta({ status: 'aporte_baixo', aporteMensal: 10_000 })]);
      renderizarTela(<Metas />);
      expect(await screen.findByText('Aporte baixo')).toBeTruthy();
    });

    it('alcançada quando o saldo chega no alvo', async () => {
      comMetas([umaMeta({ status: 'atingida', saldo: 1_340_000 })]);
      renderizarTela(<Metas />);
      expect(await screen.findByText('Alcançada')).toBeTruthy();
    });

    /**
     * ESTE É O TESTE MAIS IMPORTANTE DA TELA, e ele é sobre AUSÊNCIA.
     *
     * Meta sem prazo não tem aporte sugerido — o backend devolve `null` nos dois
     * campos porque não existe divisor. Uma pill aqui ("aporte baixo") seria
     * opinião apresentada como cálculo, numa tela cuja postura é anti-ansiedade.
     * O teste falha no dia em que alguém derivar status no cliente.
     */
    it('meta sem prazo não ganha selo nem valor sugerido', async () => {
      comMetas([
        umaMeta({ dataAlvo: null, aporteMensal: null, aporteSugerido: null, status: null }),
      ]);
      renderizarTela(<Metas />);

      await waitFor(() => expect(screen.getByText('🛟 Reserva de emergência')).toBeTruthy());
      expect(screen.getByText(/sem prazo/)).toBeTruthy();
      expect(screen.queryByText('Em dia')).toBeNull();
      expect(screen.queryByText('Aporte baixo')).toBeNull();
      expect(screen.queryByText('Sugerido')).toBeNull();
    });

    // Sem aporte declarado a tela mostra o SUGERIDO, e diz que é sugerido:
    // chamar de "aporte" um número que a pessoa não escolheu faria ela achar
    // que já está separando aquilo.
    it('sem aporte declarado mostra o sugerido, nomeado como sugerido', async () => {
      comMetas([umaMeta({ aporteMensal: null, aporteSugerido: 67_000, status: null })]);
      renderizarTela(<Metas />);

      await waitFor(() => expect(screen.getByText('Sugerido')).toBeTruthy());
      expect(screen.queryByText('Aporte')).toBeNull();
    });
  });

  describe('saídas', () => {
    it('leva para o cadastro de meta e para as dívidas', async () => {
      comMetas([umaMeta()]);
      renderizarTela(<Metas />);

      await waitFor(() => expect(screen.getByText('🛟 Reserva de emergência')).toBeTruthy());
      expect(
        screen.getByRole('button', { name: '+ Nova meta (aposentadoria, estudo...)' }),
      ).toBeTruthy();
      // O caminho de volta para dívidas existe mesmo com metas na lista: na fase
      // verde a aba Dívidas sai da barra, e sem isto ela ficaria inalcançável.
      expect(screen.getByRole('button', { name: 'Ver minhas dívidas' })).toBeTruthy();
    });
  });
});
