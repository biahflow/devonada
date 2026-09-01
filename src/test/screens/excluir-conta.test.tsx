import { Alert } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import ExcluirConta from '../../../app/(tabs)/painel/excluir-conta';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, requestMock } from '../api';
import { renderizarTela } from '../render';
import { provedorDaSessao } from '../../api/sessao';
import { CANCELADO, obterTokenSocial } from '../../social';

jest.mock('../../api/sessao', () => ({
  ...jest.requireActual('../../api/sessao'),
  esquecerSessao: jest.fn().mockResolvedValue(undefined),
  provedorDaSessao: jest.fn().mockResolvedValue(null),
}));

/**
 * A fronteira com os SDKs de identidade. O que esta suíte prova é o que a TELA
 * faz; a tradução do que cada SDK devolve é assunto de `src/test/social.test.ts`.
 */
jest.mock('../../social', () => ({
  ...jest.requireActual('../../social'),
  obterTokenSocial: jest.fn().mockResolvedValue('token-do-provedor'),
}));

const provedorMock = provedorDaSessao as jest.MockedFunction<typeof provedorDaSessao>;
const tokenMock = obterTokenSocial as jest.MockedFunction<typeof obterTokenSocial>;

/** Captura o Alert nativo sem confirmá-lo: quem confirma é cada teste. */
let confirmar: (() => void) | undefined;

beforeEach(() => {
  confirmar = undefined;
  // O padrão da suíte é a conta com senha — o caminho que já existia.
  provedorMock.mockResolvedValue(null);
  tokenMock.mockResolvedValue('token-do-provedor');
  jest.spyOn(Alert, 'alert').mockImplementation((_titulo, _msg, botoes) => {
    const excluir = botoes?.find((b) => b.text === 'Excluir');
    confirmar = () => excluir?.onPress?.();
  });
});

afterEach(() => {
  limparMocksDeRede();
  jest.restoreAllMocks();
});

async function tocarBotao(nome: string) {
  // `findBy`, e não `getBy`: a tela só desenha o formulário depois de saber por
  // onde esta sessão entrou — senha ou provedor.
  fireEvent.press(await screen.findByRole('button', { name: nome }));
}

function preencherSenha(valor: string) {
  fireEvent.changeText(screen.getByLabelText('Sua senha'), valor);
}

describe('Excluir conta', () => {
  it('lista o que some ANTES de pedir qualquer coisa', () => {
    renderizarTela(<ExcluirConta />);

    expect(screen.getByText('O que é apagado')).toBeTruthy();
    expect(screen.getByText(/dívidas, parcelas, pagamentos/i)).toBeTruthy();
    expect(screen.getByText(/histórico de conversa/i)).toBeTruthy();
  });

  it('NÃO exclui sem a confirmação nativa', async () => {
    // O gêmeo do teste do M5 que prova que a conversa não cria dívida: aqui, que
    // a tela não apaga a conta sem o usuário dizer sim duas vezes.
    renderizarTela(<ExcluirConta />);

    expect(await screen.findByLabelText('Sua senha')).toBeTruthy();
    preencherSenha('senha-bem-boa');
    await tocarBotao('Excluir minha conta');

    expect(Alert.alert).toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('exclui e leva ao login quando o usuário confirma', async () => {
    requestMock.mockResolvedValue(undefined);
    renderizarTela(<ExcluirConta />);

    expect(await screen.findByLabelText('Sua senha')).toBeTruthy();
    preencherSenha('senha-bem-boa');
    await tocarBotao('Excluir minha conta');
    confirmar?.();

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('/v1/conta', {
        method: 'DELETE',
        body: { senha: 'senha-bem-boa' },
      }),
    );
    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/login'));
  });

  it('sem senha não abre nem a confirmação', async () => {
    renderizarTela(<ExcluirConta />);
    await tocarBotao('Excluir minha conta');

    expect(await screen.findByText('Digite sua senha para confirmar.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('senha errada mostra a frase do servidor e não desloga', async () => {
    requestMock.mockRejectedValue(new ApiError(401, 'A senha não confere.'));
    renderizarTela(<ExcluirConta />);

    expect(await screen.findByLabelText('Sua senha')).toBeTruthy();
    preencherSenha('errada');
    await tocarBotao('Excluir minha conta');
    confirmar?.();

    expect(await screen.findByText('A senha não confere.')).toBeTruthy();
    expect(global.mockRouter.replace).not.toHaveBeenCalled();
  });

  it('diz que o arquivo do contrato nunca chegou a ser guardado', () => {
    renderizarTela(<ExcluirConta />);
    expect(screen.getByText(/lido e descartado/i)).toBeTruthy();
  });
});

/**
 * Diretriz 5.1.1(v) da Apple: app que oferece login social e não deixa excluir a
 * conta reprova. Quem entrou pela Apple nunca escolheu senha, e um campo de
 * senha nesta tela deixaria essa pessoa presa — que é o defeito que esta suíte
 * existe para não deixar voltar.
 */
describe('Excluir conta de quem entrou por provedor', () => {
  it('não pede senha: pede o provedor', async () => {
    provedorMock.mockResolvedValue('apple');
    renderizarTela(<ExcluirConta />);

    expect(
      await screen.findByRole('button', { name: 'Confirmar com a Apple e excluir' }),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Sua senha')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir minha conta' })).toBeNull();
  });

  it('exclui reapresentando o provedor e leva ao login', async () => {
    provedorMock.mockResolvedValue('google');
    requestMock.mockResolvedValue(undefined);
    renderizarTela(<ExcluirConta />);

    await tocarBotao('Confirmar com o Google e excluir');
    confirmar?.();

    await waitFor(() =>
      expect(requestMock).toHaveBeenCalledWith('/v1/conta', {
        method: 'DELETE',
        // O token, e não uma senha inventada. O servidor confere que o `sub`
        // dele é o mesmo da conta aberta.
        body: { provedor: 'google', token: 'token-do-provedor' },
      }),
    );
    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/login'));
  });

  it('NÃO exclui sem a confirmação nativa', async () => {
    // O gêmeo do teste do caminho por senha: nem pelo provedor a conta some sem
    // o usuário dizer sim duas vezes.
    provedorMock.mockResolvedValue('apple');
    renderizarTela(<ExcluirConta />);

    await tocarBotao('Confirmar com a Apple e excluir');

    expect(Alert.alert).toHaveBeenCalled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('desistir na folha do provedor não exclui nada', async () => {
    // A terceira chance de voltar atrás, depois do botão e do alerta.
    provedorMock.mockResolvedValue('apple');
    tokenMock.mockResolvedValue(CANCELADO);
    renderizarTela(<ExcluirConta />);

    await tocarBotao('Confirmar com a Apple e excluir');
    confirmar?.();

    await waitFor(() => expect(tokenMock).toHaveBeenCalled());
    expect(requestMock).not.toHaveBeenCalled();
    expect(global.mockRouter.replace).not.toHaveBeenCalled();
  });

  it('token de outra conta mostra a frase do servidor e não desloga', async () => {
    provedorMock.mockResolvedValue('apple');
    requestMock.mockRejectedValue(new ApiError(401, 'Essa não é a conta que está aberta aqui.'));
    renderizarTela(<ExcluirConta />);

    await tocarBotao('Confirmar com a Apple e excluir');
    confirmar?.();

    expect(await screen.findByText('Essa não é a conta que está aberta aqui.')).toBeTruthy();
    expect(global.mockRouter.replace).not.toHaveBeenCalled();
  });
});
