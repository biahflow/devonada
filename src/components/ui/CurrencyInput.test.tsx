import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CurrencyInput } from './CurrencyInput';

/** Wrapper controlado: reproduz o uso real, com o pai guardando os centavos. */
function Harness({ onValue }: { onValue: (c: number) => void }) {
  const [centavos, setCentavos] = useState(0);
  return (
    <CurrencyInput
      label="Valor cobrado"
      value={centavos}
      onChangeValue={(c) => {
        setCentavos(c);
        onValue(c);
      }}
    />
  );
}

function digitar(texto: string) {
  fireEvent.changeText(screen.getByLabelText('Valor cobrado'), texto);
}

describe('CurrencyInput', () => {
  it('começa vazio para o placeholder aparecer', () => {
    render(<Harness onValue={() => {}} />);
    expect(screen.getByLabelText('Valor cobrado').props.value).toBe('');
  });

  it('acumula dígitos da direita para a esquerda', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    digitar('1');
    expect(onValue).toHaveBeenLastCalledWith(1);
    digitar('R$ 0,015');
    expect(onValue).toHaveBeenLastCalledWith(15);
    digitar('R$ 0,1500');
    expect(onValue).toHaveBeenLastCalledWith(1500);

    expect(screen.getByLabelText('Valor cobrado').props.value).toBe('R$ 15,00');
  });

  it('emite apenas inteiros — nunca um valor fracionário', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    ['1', 'R$ 0,012', 'R$ 0,123', 'R$ 1,234'].forEach(digitar);

    expect(onValue).toHaveBeenCalled();
    onValue.mock.calls.forEach(([centavos]) => {
      expect(Number.isInteger(centavos)).toBe(true);
    });
    expect(onValue).toHaveBeenLastCalledWith(1234);
  });

  it('ignora vírgula, ponto e texto digitados pelo usuário', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    digitar('1.234,56');
    expect(onValue).toHaveBeenLastCalledWith(123456);
  });

  it('apagar tudo volta para zero', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    digitar('R$ 0,150');
    expect(onValue).toHaveBeenLastCalledWith(150);
    digitar('');
    expect(onValue).toHaveBeenLastCalledWith(0);
    expect(screen.getByLabelText('Valor cobrado').props.value).toBe('');
  });

  it('limita o valor ao teto de segurança', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    digitar('999999999999999');
    expect(onValue).toHaveBeenLastCalledWith(99_999_999_999);
  });
});
