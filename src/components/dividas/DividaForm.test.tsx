import { render, screen, fireEvent } from '@testing-library/react-native';
import { DividaForm } from './DividaForm';

const INICIAL = {
  credor: 'Banco Teste S/A',
  valorCobrado: 150000,
  dataOrigem: '2021-06-01',
  tipo: 'juros_abusivos' as const,
};

describe('DividaForm', () => {
  it('bloqueia o envio quando falta o credor', () => {
    const onSubmit = jest.fn();
    render(
      <DividaForm inicial={{ ...INICIAL, credor: '' }} submitLabel="Salvar" onSubmit={onSubmit} />,
    );

    fireEvent.press(screen.getByText('Salvar'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Informe quem está cobrando.')).toBeTruthy();
  });

  it('bloqueia o envio quando o valor é zero', () => {
    const onSubmit = jest.fn();
    render(
      <DividaForm
        inicial={{ ...INICIAL, valorCobrado: 0 }}
        submitLabel="Salvar"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.press(screen.getByText('Salvar'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Informe o valor cobrado.')).toBeTruthy();
  });

  it('bloqueia o envio sem classificação escolhida', () => {
    const onSubmit = jest.fn();
    render(
      <DividaForm
        inicial={{ credor: 'X', valorCobrado: 1000, dataOrigem: '2021-06-01' }}
        submitLabel="Salvar"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.press(screen.getByText('Salvar'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Escolha uma classificação.')).toBeTruthy();
  });

  it('submete valor em centavos inteiros', () => {
    const onSubmit = jest.fn();
    render(<DividaForm inicial={INICIAL} submitLabel="Salvar" onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText('Salvar'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(Number.isInteger(input.valorCobrado)).toBe(true);
    expect(input.valorCobrado).toBe(150000);
  });

  it('omite a taxa quando não informada, em vez de enviar zero', () => {
    // Zero significaria "juros zero", que é uma afirmação diferente de ausência.
    const onSubmit = jest.fn();
    render(<DividaForm inicial={INICIAL} submitLabel="Salvar" onSubmit={onSubmit} />);

    fireEvent.press(screen.getByText('Salvar'));

    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('taxaJurosMensal');
  });

  it('envia a taxa em basis points inteiros quando informada', () => {
    const onSubmit = jest.fn();
    render(<DividaForm inicial={INICIAL} submitLabel="Salvar" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('Juros ao mês'), '0,1250');
    fireEvent.press(screen.getByText('Salvar'));

    const input = onSubmit.mock.calls[0][0];
    expect(input.taxaJurosMensal).toBe(1250);
    expect(Number.isInteger(input.taxaJurosMensal)).toBe(true);
  });

  it('remove espaços em volta do credor', () => {
    const onSubmit = jest.fn();
    render(
      <DividaForm
        inicial={{ ...INICIAL, credor: '  Nubank  ' }}
        submitLabel="Salvar"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.press(screen.getByText('Salvar'));

    expect(onSubmit.mock.calls[0][0].credor).toBe('Nubank');
  });
});
