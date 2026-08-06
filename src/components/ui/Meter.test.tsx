import { render, screen } from '@testing-library/react-native';
import { Meter } from './Meter';

describe('Meter', () => {
  it('mostra a proporção formatada em basis points', () => {
    render(<Meter rotulo="Comprometimento" bps={2200} />);
    expect(screen.getByText('22,00%')).toBeTruthy();
  });

  it('anuncia o estado acima do limite por TEXTO, não só por cor', () => {
    // Quem não distingue as cores precisa da mesma informação.
    render(<Meter rotulo="Comprometimento" bps={4500} limiteBps={3000} />);
    expect(screen.getByText(/Acima do limite saudável/)).toBeTruthy();
  });

  it('não alarma quando está dentro do limite', () => {
    render(
      <Meter rotulo="Comprometimento" bps={1500} limiteBps={3000} contexto="Dentro do limite." />,
    );
    expect(screen.queryByText(/Acima do limite/)).toBeNull();
    expect(screen.getByText('Dentro do limite.')).toBeTruthy();
  });

  it('trata o valor exatamente no limite como dentro', () => {
    render(<Meter rotulo="Comprometimento" bps={3000} limiteBps={3000} />);
    expect(screen.queryByText(/Acima do limite/)).toBeNull();
  });

  it('funciona sem limite definido', () => {
    render(<Meter rotulo="Uso" bps={9000} />);
    expect(screen.getByText('90,00%')).toBeTruthy();
    expect(screen.queryByText(/Acima do limite/)).toBeNull();
  });
});
