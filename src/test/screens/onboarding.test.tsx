import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import EscolhaDaDivida from '../../../app/(onboarding)/divida';
import EntradaDaDivida from '../../../app/(onboarding)/entrada';
import { limparMocksDeRede, requestMock } from '../api';
import { renderizarTela } from '../render';
import { dateParaIso } from '../../util/date';

afterEach(limparMocksDeRede);

const CARTAO = 'Cartão de crédito / rotativo';
const EMPRESTIMO = 'Empréstimo ou consignado';

function tocar(nome: string | RegExp) {
  fireEvent.press(screen.getByText(nome));
}

function preencher(rotulo: string, valor: string) {
  fireEvent.changeText(screen.getByLabelText(rotulo), valor);
}

/** Abre o seletor "Quando começou?" e confirma uma data — como o picker nativo faria. */
function escolherData(quando: Date) {
  fireEvent.press(screen.getByLabelText('Quando começou?'));
  fireEvent(screen.UNSAFE_getByType(DateTimePicker), 'change', { type: 'set' }, quando);
}

/** O corpo do POST /v1/dividas da n-ésima criação. */
function corpoDaCriacao(n: number): Record<string, unknown> {
  const chamada = requestMock.mock.calls[n];
  return (chamada?.[1] as { body: Record<string, unknown> }).body;
}

/** Uma dívida criada por vez, com id previsível, na ordem das chamadas. */
function criaDividasEmSequencia(ids: string[]) {
  let i = 0;
  requestMock.mockImplementation(() =>
    Promise.resolve({ divida: { id: ids[i++] ?? 'extra' } }) as never,
  );
}

describe('passo 1 — qual dívida tira seu sono', () => {
  /**
   * A MUDANÇA DA ADR 0016. A concepção pedia uma dívida por vez ("Começa por uma
   * só"), e a carteira real não é assim: cartão E empréstimo é o caso comum.
   * Quem marcava cartão terminava o onboarding sem caminho óbvio para a segunda.
   */
  it('aceita mais de uma dívida marcada', () => {
    renderizarTela(<EscolhaDaDivida />);

    tocar(CARTAO);
    tocar(EMPRESTIMO);

    for (const rotulo of [CARTAO, EMPRESTIMO]) {
      const linha = screen.getByText(rotulo).parent;
      expect(linha).toBeTruthy();
    }
    // O rótulo do CTA conta quantas — é o que confirma que as duas entraram.
    expect(screen.getByText('Continuar com 2 dívidas')).toBeTruthy();
  });

  it('desmarcar tira da fila', () => {
    renderizarTela(<EscolhaDaDivida />);

    tocar(CARTAO);
    tocar(EMPRESTIMO);
    tocar(EMPRESTIMO);

    expect(screen.getByText('Continuar')).toBeTruthy();
  });

  it('não avança sem nada marcado', () => {
    renderizarTela(<EscolhaDaDivida />);

    fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(global.mockRouter.push).not.toHaveBeenCalled();
  });

  // A ORDEM DA MARCAÇÃO É A ORDEM DA FILA, e ela decide qual dívida recebe a
  // triagem no fim: quem marca primeiro marca o que dói mais.
  it('leva a fila na ordem em que foi marcada', () => {
    renderizarTela(<EscolhaDaDivida />);

    tocar(EMPRESTIMO);
    tocar(CARTAO);
    fireEvent.press(screen.getByRole('button', { name: 'Continuar com 2 dívidas' }));

    expect(global.mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(onboarding)/entrada',
      params: { fila: 'emprestimo,cartao' },
    });
  });
});

describe('passo 2 — uma dívida marcada', () => {
  beforeEach(() => global.definirParametrosDeRota({ fila: 'cartao' }));

  /**
   * O DOCUMENTO CONTINUA VINDO PRIMEIRO quando há uma dívida só, e isso não é
   * estética: só contrato lido produz achado, e sem achado não há valor justo nem
   * script. Este teste falha se a variante de fila engolir a de uma dívida.
   */
  it('oferece o documento antes do cadastro manual', () => {
    renderizarTela(<EntradaDaDivida />);

    expect(screen.getByText('Mandar a fatura ou o contrato')).toBeTruthy();
    expect(screen.getByText('Só sei o valor')).toBeTruthy();
  });
});

describe('passo 2 — a fila', () => {
  beforeEach(() => global.definirParametrosDeRota({ fila: 'cartao,emprestimo' }));

  it('mostra em qual dívida da fila está', () => {
    renderizarTela(<EntradaDaDivida />);
    expect(screen.getByText(/1 de 2/)).toBeTruthy();
  });

  // O UPLOAD NÃO APARECE NA FILA, e é decisão mecânica: `/dividas/contrato` vive
  // fora do grupo (onboarding), e sair para lá abandonaria o resto da fila.
  it('não oferece o upload no meio da fila', () => {
    renderizarTela(<EntradaDaDivida />);
    expect(screen.queryByText('Mandar a fatura ou o contrato')).toBeNull();
  });

  it('avança para a segunda dívida com os campos limpos', async () => {
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    tocar('Continuar');

    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    expect(screen.getByLabelText('Pra quem você deve').props.value).toBe('');
    // NADA FOI GRAVADO AINDA: a fila inteira sai num POST só, no fim, para o
    // botão de voltar não produzir dívida duplicada.
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('não avança com campo vazio', () => {
    renderizarTela(<EntradaDaDivida />);

    tocar('Continuar');

    expect(screen.getByText('Diz pra quem você deve.')).toBeTruthy();
    expect(screen.getByText(/1 de 2/)).toBeTruthy();
  });

  it('grava as duas e manda a triagem para a primeira marcada', async () => {
    criaDividasEmSequencia(['divida-cartao', 'divida-emprestimo']);
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    tocar('Continuar');

    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() =>
      expect(global.mockRouter.replace).toHaveBeenCalledWith({
        pathname: '/(onboarding)/triagem',
        params: { id: 'divida-cartao', total: '2' },
      }),
    );
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  // A DATA DE ORIGEM VEM PRÉ-PREENCHIDA COM HOJE. Quem não sabe a data de cabeça
  // só confirma, e a fila não trava por isso.
  it('grava com a data de hoje quando a pessoa não ajusta', async () => {
    criaDividasEmSequencia(['divida-cartao', 'divida-emprestimo']);
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    tocar('Continuar');
    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    expect(corpoDaCriacao(0).dataOrigem).toBe(dateParaIso(new Date()));
  });

  // ...MAS QUANDO ELA AJUSTA, é a data dela que vai — não mais "hoje" cravado.
  // A prescrição (CC art. 206) conta a partir daqui, então isso muda o cálculo.
  it('grava a data que a pessoa escolheu, não hoje', async () => {
    criaDividasEmSequencia(['divida-cartao', 'divida-emprestimo']);
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    escolherData(new Date(2021, 5, 15));
    tocar('Continuar');
    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(2));
    expect(corpoDaCriacao(0).dataOrigem).toBe('2021-06-15');
    // A segunda, intocada, segue com hoje: a data de uma não contamina a outra.
    expect(corpoDaCriacao(1).dataOrigem).toBe(dateParaIso(new Date()));
  });

  /**
   * A rede caindo no MEIO da fila. Nada é desfeito — as dívidas criadas são
   * reais —, e o teste garante que a pessoa não fica presa no formulário: ou
   * tenta de novo (e a segunda tentativa não duplica a primeira), ou vai ver o
   * que já cadastrou.
   */
  it('falha no meio: oferece ver o que já foi cadastrado, e o retry não duplica', async () => {
    let chamadas = 0;
    requestMock.mockImplementation(() => {
      chamadas += 1;
      return chamadas === 2
        ? Promise.reject(new Error('sem rede'))
        : (Promise.resolve({ divida: { id: `divida-${chamadas}` } }) as never);
    });
    renderizarTela(<EntradaDaDivida />);

    preencher('Pra quem você deve', 'Nubank');
    preencher('Quanto estão cobrando', '987000');
    tocar('Continuar');
    await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());
    preencher('Pra quem você deve', 'Banco do Brasil');
    preencher('Quanto estão cobrando', '450000');
    tocar('Cadastrar as 2 dívidas');

    await waitFor(() =>
      expect(screen.getByText('Ver a dívida que já cadastrei')).toBeTruthy(),
    );
    expect(global.mockRouter.replace).not.toHaveBeenCalled();

    // A nova tentativa pula a primeira, que já existe: 3 chamadas no total, não 4.
    tocar('Cadastrar as 2 dívidas');
    await waitFor(() =>
      expect(global.mockRouter.replace).toHaveBeenCalledWith({
        pathname: '/(onboarding)/triagem',
        params: { id: 'divida-1', total: '2' },
      }),
    );
    expect(chamadas).toBe(3);
  });

  describe('voltar', () => {
    it('recua na fila preservando o que foi digitado', async () => {
      renderizarTela(<EntradaDaDivida />);

      preencher('Pra quem você deve', 'Nubank');
      preencher('Quanto estão cobrando', '987000');
      tocar('Continuar');
      await waitFor(() => expect(screen.getByText(/2 de 2/)).toBeTruthy());

      fireEvent.press(screen.getByLabelText('Voltar'));

      await waitFor(() => expect(screen.getByText(/1 de 2/)).toBeTruthy());
      expect(screen.getByLabelText('Pra quem você deve').props.value).toBe('Nubank');
    });

    it('no começo da fila sai para o passo 1', () => {
      renderizarTela(<EntradaDaDivida />);

      fireEvent.press(screen.getByLabelText('Voltar'));

      expect(global.mockRouter.back).toHaveBeenCalled();
    });
  });
});

describe('passo 2 — fila corrompida', () => {
  // Param de rota é entrada não confiável. Sem tela de erro dramática: a escolha
  // está a um toque.
  it('id desconhecido não vira dívida de tipo inventado', () => {
    global.definirParametrosDeRota({ fila: 'nao-existe' });
    renderizarTela(<EntradaDaDivida />);

    expect(screen.getByText('Não entendi qual dívida você escolheu.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher a dívida' })).toBeTruthy();
  });
});
