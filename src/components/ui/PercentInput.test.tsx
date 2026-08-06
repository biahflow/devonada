import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PercentInput } from './PercentInput';

function Harness({ onValue }: { onValue: (bps: number) => void }) {
  const [bps, setBps] = useState(0);
  return (
    <PercentInput
      label="Juros ao mês"
      value={bps}
      onChangeValue={(v) => {
        setBps(v);
        onValue(v);
      }}
    />
  );
}

function digitar(texto: string) {
  fireEvent.changeText(screen.getByLabelText('Juros ao mês'), texto);
}

describe('PercentInput', () => {
  it('começa vazio para o placeholder aparecer', () => {
    render(<Harness onValue={() => {}} />);
    expect(screen.getByLabelText('Juros ao mês').props.value).toBe('');
  });

  it('acumula dígitos da direita para a esquerda', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    digitar('2');
    expect(onValue).toHaveBeenLastCalledWith(2);
    digitar('0,025');
    expect(onValue).toHaveBeenLastCalledWith(25);
    digitar('0,250');
    expect(onValue).toHaveBeenLastCalledWith(250);

    expect(screen.getByLabelText('Juros ao mês').props.value).toBe('2,50%');
  });

  it('emite apenas inteiros em basis points — nunca fracionário', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    ['1', '0,012', '0,123', '1,234'].forEach(digitar);

    expect(onValue).toHaveBeenCalled();
    onValue.mock.calls.forEach(([bps]) => {
      expect(Number.isInteger(bps)).toBe(true);
    });
    expect(onValue).toHaveBeenLastCalledWith(1234);
  });

  it('ignora vírgula, ponto e símbolo de porcentagem', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    digitar('12,50%');
    expect(onValue).toHaveBeenLastCalledWith(1250);
  });

  it('apagar tudo volta para zero', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    digitar('0,250');
    expect(onValue).toHaveBeenLastCalledWith(250);
    digitar('');
    expect(onValue).toHaveBeenLastCalledWith(0);
  });

  it('limita ao teto de segurança', () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);

    digitar('99999999');
    expect(onValue).toHaveBeenLastCalledWith(99_999);
  });
});
