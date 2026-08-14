import { screen, waitFor } from '@testing-library/react-native';
import Triagem from '../../../app/(onboarding)/triagem';
import { limparMocksDeRede, responderPorRota } from '../api';
import { renderizarTela } from '../render';
import type { RevisaoCobranca } from '../../api/types';

afterEach(limparMocksDeRede);
beforeEach(() => global.definirParametrosDeRota({ id: 'divida-1' }));

function umaRevisao(over: Partial<RevisaoCobranca> = {}): RevisaoCobranca {
  return {
    dividaId: 'divida-1',
    credor: 'Banco Teste',
    valorCobrado: 987000,
    achados: [],
    fundamentos: [],
    ...over,
  };
}

describe('triagem do onboarding', () => {
  describe('sem contrato lido', () => {
    // ESTE É O TESTE MAIS IMPORTANTE DA TELA. Cadastro manual não produz achado
    // (docs/inventario.md, limitação 7), e uma triagem que inventasse economia
    // aqui mandaria o usuário para uma negociação real com um número que
    // nenhuma lei sustenta. A ADR 0008 existe por causa disso.
    it('não exibe valor justo nem economia quando não há achado', async () => {
      responderPorRota({
        '/v1/dividas/divida-1/revisao': { revisao: umaRevisao({ valorJusto: null }) },
      });
      renderizarTela(<Triagem />);

      await waitFor(() => expect(screen.getByText('ainda não calculado')).toBeTruthy());
      expect(screen.queryByText('Dá pra contestar')).toBeNull();
      expect(screen.getByText('R$ 9.870,00')).toBeTruthy();
    });

    it('aponta o caminho em vez de só dizer que não sabe', async () => {
      responderPorRota({
        '/v1/dividas/divida-1/revisao': { revisao: umaRevisao({ valorJusto: null }) },
      });
      renderizarTela(<Triagem />);

      await waitFor(() => expect(screen.getByText('Mandar a fatura')).toBeTruthy());
    });
  });

  describe('com contrato lido', () => {
    it('mostra cobrado, justo e a economia que os achados sustentam', async () => {
      responderPorRota({
        '/v1/dividas/divida-1/revisao': {
          revisao: umaRevisao({
            valorJusto: 590000,
            achados: [
              {
                id: 'seguro_prestamista',
                titulo: 'Seguro prestamista embutido',
                explicacao: 'Não se pode ser compelido a contratar.',
                fonte: 'CDC, art. 39, I · STJ, Tema 972',
                // Obrigatório no tipo, e é o que mantém o achado como convite a
                // investigar em vez de sentença: a pergunta de fato só o
                // usuário responde.
                comoConferir: 'Você pôde escolher a seguradora, ou ela já veio junto?',
                valorContestavel: 89000,
              },
            ],
          }),
        },
      });
      renderizarTela(<Triagem />);

      await waitFor(() => expect(screen.getByText('R$ 5.900,00')).toBeTruthy());
      expect(screen.getByText('R$ 3.970,00')).toBeTruthy();
      expect(screen.getByText('Seguro prestamista embutido')).toBeTruthy();
      // A fonte legal ao lado do achado é o diferencial de confiança do
      // produto; um achado sem ela não deveria existir na tela.
      expect(screen.getByText('CDC, art. 39, I · STJ, Tema 972')).toBeTruthy();
      expect(screen.queryByText('ainda não calculado')).toBeNull();
    });
  });
});
