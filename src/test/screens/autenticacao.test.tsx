import { Linking } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import Login from '../../../app/(auth)/login';
import Registro from '../../../app/(auth)/registro';
import EsqueciSenha from '../../../app/(auth)/esqueci-senha';
import RedefinirSenha from '../../../app/(auth)/redefinir-senha';
import { ApiError } from '../../api/client';
import { limparMocksDeRede, requestMock, nuncaResponde } from '../api';
import { renderizarTela } from '../render';
import {
  CANCELADO,
  ErroSocial,
  obterTokenSocial,
  provedoresDisponiveis,
} from '../../social';

jest.mock('../../api/sessao', () => ({
  ...jest.requireActual('../../api/sessao'),
  guardarSessao: jest.fn().mockResolvedValue(undefined),
  esquecerSessao: jest.fn().mockResolvedValue(undefined),
  definirProvedor: jest.fn().mockResolvedValue(undefined),
  tokenDeRenovacao: jest.fn().mockResolvedValue('refresh'),
}));

/**
 * A fronteira com os SDKs de identidade, e não os SDKs em si.
 *
 * O que ESTA suíte prova é o que a TELA faz com cada resposta possível —
 * disponível ou não, token, cancelamento, falha. Que `src/social/` traduza
 * certo o que cada SDK devolve é o assunto de `src/test/social.test.ts`, que
 * exercita o módulo de verdade contra os SDKs mockados.
 */
jest.mock('../../social', () => ({
  ...jest.requireActual('../../social'),
  provedoresDisponiveis: jest.fn().mockResolvedValue([]),
  obterTokenSocial: jest.fn().mockResolvedValue('token-do-provedor'),
}));

const disponiveisMock = provedoresDisponiveis as jest.MockedFunction<
  typeof provedoresDisponiveis
>;
const tokenMock = obterTokenSocial as jest.MockedFunction<typeof obterTokenSocial>;

const SESSAO = { sessao: { acesso: 'a', refresh: 'r', expiraEm: '2026-08-07T14:15:00Z' } };

afterEach(limparMocksDeRede);

beforeEach(() => {
  disponiveisMock.mockResolvedValue([]);
  tokenMock.mockResolvedValue('token-do-provedor');
});

function preencher(rotulo: string, valor: string) {
  fireEvent.changeText(screen.getByLabelText(rotulo), valor);
}

/**
 * Por PAPEL, e não por texto: o título da tela e o botão principal dizem a
 * mesma coisa de propósito — "Criar conta" aparece nos dois — e `getByText`
 * acharia os dois. Buscar o botão é o que o usuário faz.
 *
 * O botão de e-mail diz "Entrar com e-mail" e não "Entrar" porque desde a tela
 * 11 ele divide a tela com "Continuar com Apple" e "Continuar com Google": num
 * leitor de tela, três botões de entrada em que um se chama só "Entrar" não
 * dizem por onde cada um entra.
 */
function tocarBotao(nome: string) {
  fireEvent.press(screen.getByRole('button', { name: nome }));
}

describe('Login', () => {
  it('entra e leva para o app', async () => {
    requestMock.mockResolvedValue(SESSAO);
    renderizarTela(<Login />);

    preencher('E-mail', 'voce@exemplo.com');
    preencher('Senha', 'senha-bem-boa');
    tocarBotao('Entrar com e-mail');

    // `replace`, não `push`: voltar depois de entrar não pode devolver ao login.
    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/'));
  });

  it('exibe a frase do servidor quando a credencial não confere', async () => {
    requestMock.mockRejectedValue(new ApiError(401, 'E-mail ou senha não conferem.'));
    renderizarTela(<Login />);

    preencher('E-mail', 'voce@exemplo.com');
    preencher('Senha', 'errada');
    tocarBotao('Entrar com e-mail');

    expect(await screen.findByText('E-mail ou senha não conferem.')).toBeTruthy();
  });

  it('não vai à rede com o formulário vazio', async () => {
    renderizarTela(<Login />);
    tocarBotao('Entrar com e-mail');

    expect(await screen.findByText('Preencha o e-mail e a senha.')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('mostra carregando enquanto o servidor não responde', async () => {
    nuncaResponde();
    renderizarTela(<Login />);

    preencher('E-mail', 'voce@exemplo.com');
    preencher('Senha', 'senha-bem-boa');
    tocarBotao('Entrar com e-mail');

    // O botão continua tendo nome enquanto carrega — o spinner substitui o
    // texto, e sem `accessibilityLabel` ele ficaria mudo para o leitor de tela.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar com e-mail', busy: true })).toBeTruthy());
  });

  it('leva aos Termos e à Política quando as URLs existem', async () => {
    // O `jest.setup.js` preenche as duas, como o `.env` faria. Sem elas a linha
    // volta a ser texto — ver o teste seguinte.
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderizarTela(<Login />);

    fireEvent.press(screen.getByRole('link', { name: 'Termos' }));
    expect(abrir).toHaveBeenCalledWith('https://exemplo.test/termos');

    fireEvent.press(screen.getByRole('link', { name: 'Política de Privacidade' }));
    expect(abrir).toHaveBeenCalledWith('https://exemplo.test/privacidade');
  });

  it('a frase legal continua legível inteira, com ou sem link', () => {
    // O texto não pode se perder na fatiação: quem lê precisa ver a frase, não
    // três pedaços soltos.
    renderizarTela(<Login />);
    expect(
      screen.getByText(/Ao continuar você aceita os/),
    ).toBeTruthy();
    expect(screen.getByText('Termos')).toBeTruthy();
    expect(screen.getByText('Política de Privacidade')).toBeTruthy();
  });

  it('oferece os dois caminhos de quem não consegue entrar', () => {
    renderizarTela(<Login />);
    expect(screen.getByRole('button', { name: 'Esqueci minha senha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeTruthy();
  });

  // O ACORDO DA TELA 11: os botões sociais existem no desenho, e onde não há
  // para onde mandar o toque eles ficam DESLIGADOS de verdade — inclusive para o
  // leitor de tela. Este teste falha no dia em que alguém os deixar tocáveis sem
  // provedor disponível.
  it('sem provedor disponível, mostra os dois desligados e explica', async () => {
    disponiveisMock.mockResolvedValue([]);
    renderizarTela(<Login />);

    for (const nome of ['Continuar com Apple', 'Continuar com Google']) {
      expect(await screen.findByRole('button', { name: nome, disabled: true })).toBeTruthy();
    }
    expect(screen.getByText(/chega com a publicação nas lojas/i)).toBeTruthy();
  });
});

describe('Login social', () => {
  it('entra pelo provedor e leva para o app', async () => {
    disponiveisMock.mockResolvedValue(['apple']);
    requestMock.mockResolvedValue(SESSAO);
    renderizarTela(<Login />);

    fireEvent.press(await screen.findByRole('button', { name: 'Continuar com Apple' }));

    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/'));
    // O token vai para a rota social, e o app não manda e-mail nem `sub` ao
    // lado: o que identifica está DENTRO do token, assinado pelo provedor.
    expect(requestMock).toHaveBeenCalledWith(
      '/v1/auth/social',
      expect.objectContaining({ body: { provedor: 'apple', token: 'token-do-provedor' } }),
    );
  });

  it('só mostra o botão do provedor que este aparelho tem', async () => {
    // Apple é iOS com a capacidade assinada; Google depende do client id. Botão
    // apagado ao lado de um aceso parece defeito — o indisponível não aparece.
    disponiveisMock.mockResolvedValue(['google']);
    renderizarTela(<Login />);

    expect(await screen.findByRole('button', { name: 'Continuar com Google' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continuar com Apple' })).toBeNull();
    expect(screen.queryByText(/chega com a publicação nas lojas/i)).toBeNull();
  });

  it('desistir no provedor não entra, não navega e não acusa erro', async () => {
    // Fechar a folha do provedor é gesto normal. Tratá-lo como falha faria o app
    // acusar de problema quem só mudou de ideia.
    disponiveisMock.mockResolvedValue(['apple']);
    tokenMock.mockResolvedValue(CANCELADO);
    renderizarTela(<Login />);

    fireEvent.press(await screen.findByRole('button', { name: 'Continuar com Apple' }));

    await waitFor(() => expect(tokenMock).toHaveBeenCalled());
    expect(requestMock).not.toHaveBeenCalled();
    expect(global.mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/não deu para entrar/i)).toBeNull();
  });

  it('mostra a frase do provedor quando o fluxo dele falha', async () => {
    disponiveisMock.mockResolvedValue(['google']);
    tokenMock.mockRejectedValue(new ErroSocial('Não deu para entrar pelo Google agora.'));
    renderizarTela(<Login />);

    fireEvent.press(await screen.findByRole('button', { name: 'Continuar com Google' }));

    expect(await screen.findByText('Não deu para entrar pelo Google agora.')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('mostra a frase do servidor quando ele recusa o token', async () => {
    disponiveisMock.mockResolvedValue(['apple']);
    requestMock.mockRejectedValue(
      new ApiError(409, 'Esse e-mail já tem conta com senha. Entre com e-mail e senha.'),
    );
    renderizarTela(<Login />);

    fireEvent.press(await screen.findByRole('button', { name: 'Continuar com Apple' }));

    expect(await screen.findByText(/já tem conta com senha/i)).toBeTruthy();
    expect(global.mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('Registro', () => {
  it('cria a conta e leva para o app', async () => {
    requestMock.mockResolvedValue(SESSAO);
    renderizarTela(<Registro />);

    preencher('E-mail', 'voce@exemplo.com');
    preencher('Senha', 'senha-bem-boa');
    preencher('Repita a senha', 'senha-bem-boa');
    tocarBotao('Criar conta');

    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/'));
  });

  it('senhas diferentes não vão à rede', async () => {
    renderizarTela(<Registro />);

    preencher('E-mail', 'voce@exemplo.com');
    preencher('Senha', 'senha-bem-boa');
    preencher('Repita a senha', 'outra-coisa');
    tocarBotao('Criar conta');

    expect(await screen.findByText('As duas senhas precisam ser iguais.')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('senha curta é barrada antes da rede', async () => {
    renderizarTela(<Registro />);

    preencher('E-mail', 'voce@exemplo.com');
    preencher('Senha', 'curta');
    preencher('Repita a senha', 'curta');
    tocarBotao('Criar conta');

    expect(await screen.findByText('Use pelo menos 8 caracteres.')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('e-mail já cadastrado mostra a frase do servidor', async () => {
    requestMock.mockRejectedValue(
      new ApiError(409, 'Esse e-mail já tem conta. Entre com ele ou recupere a senha.'),
    );
    renderizarTela(<Registro />);

    preencher('E-mail', 'voce@exemplo.com');
    preencher('Senha', 'senha-bem-boa');
    preencher('Repita a senha', 'senha-bem-boa');
    tocarBotao('Criar conta');

    expect(
      await screen.findByText('Esse e-mail já tem conta. Entre com ele ou recupere a senha.'),
    ).toBeTruthy();
  });

  it('diz que o usuário pode apagar tudo depois', () => {
    renderizarTela(<Registro />);
    expect(screen.getByText(/apagar tudo a qualquer momento/i)).toBeTruthy();
  });
});

describe('Recuperação de senha', () => {
  it('segue para o código sem afirmar que o e-mail existe', async () => {
    requestMock.mockResolvedValue(undefined);
    renderizarTela(<EsqueciSenha />);

    preencher('E-mail da conta', 'voce@exemplo.com');
    tocarBotao('Enviar código');

    await waitFor(() =>
      expect(global.mockRouter.push).toHaveBeenCalledWith({
        pathname: '/redefinir-senha',
        params: { email: 'voce@exemplo.com' },
      }),
    );
  });

  it('a tela do código não afirma que ele foi enviado', () => {
    renderizarTela(<RedefinirSenha />);
    // "Se esse e-mail estiver cadastrado" — dizer "enviamos" confirmaria o
    // cadastro que a rota se recusa a confirmar.
    expect(screen.getByText(/se esse e-mail estiver cadastrado/i)).toBeTruthy();
  });

  it('código com menos de 6 dígitos não vai à rede', async () => {
    renderizarTela(<RedefinirSenha />);

    preencher('E-mail da conta', 'voce@exemplo.com');
    preencher('Código de 6 dígitos', '123');
    preencher('Nova senha', 'senha-bem-boa');
    tocarBotao('Salvar nova senha');

    expect(await screen.findByText('O código tem 6 dígitos.')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('redefine e entra direto', async () => {
    requestMock.mockResolvedValue(SESSAO);
    renderizarTela(<RedefinirSenha />);

    preencher('E-mail da conta', 'voce@exemplo.com');
    preencher('Código de 6 dígitos', '418302');
    preencher('Nova senha', 'outra-senha-boa');
    tocarBotao('Salvar nova senha');

    await waitFor(() => expect(global.mockRouter.replace).toHaveBeenCalledWith('/'));
  });

  it('código errado mostra a frase do servidor', async () => {
    requestMock.mockRejectedValue(
      new ApiError(400, 'Esse código não confere. Confira ou peça outro.'),
    );
    renderizarTela(<RedefinirSenha />);

    preencher('E-mail da conta', 'voce@exemplo.com');
    preencher('Código de 6 dígitos', '000000');
    preencher('Nova senha', 'outra-senha-boa');
    tocarBotao('Salvar nova senha');

    expect(await screen.findByText('Esse código não confere. Confira ou peça outro.')).toBeTruthy();
  });

  it('avisa que trocar a senha derruba os outros aparelhos', () => {
    renderizarTela(<RedefinirSenha />);
    expect(screen.getByText(/encerra a sessão em todos os aparelhos/i)).toBeTruthy();
  });
});
