import { render, screen } from '@testing-library/react-native';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('formata o valor em reais a partir de centavos', () => {
    render(<StatTile rotulo="Total devido" centavos={4850000} />);
    expect(screen.getByText('R$ 48.500,00')).toBeTruthy();
  });

  it('ausência NÃO vira R$ 0,00', () => {
    // Zero afirma que não se deve nada. Ausente diz que ninguém calculou ainda.
    render(<StatTile rotulo="Saldo devedor" />);
    expect(screen.getByText('ainda não calculado')).toBeTruthy();
    expect(screen.queryByText('R$ 0,00')).toBeNull();
  });

  it('distingue zero real de ausência', () => {
    render(<StatTile rotulo="Quitado no ano" centavos={0} />);
    expect(screen.getByText('R$ 0,00')).toBeTruthy();
    expect(screen.queryByText('ainda não calculado')).toBeNull();
  });

  it('aceita texto para valores que não são dinheiro', () => {
    render(<StatTile rotulo="Juros médios" texto="3,80% a.m." />);
    expect(screen.getByText('3,80% a.m.')).toBeTruthy();
  });

  it('exibe a linha de contexto quando há uma', () => {
    render(<StatTile rotulo="Total devido" centavos={100} contexto="em 3 dívidas" />);
    expect(screen.getByText('em 3 dívidas')).toBeTruthy();
  });
});
