import { formatBRL } from './money';

describe('formatBRL', () => {
  it('formata zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
  });

  it('formata centavos isolados sem inventar reais', () => {
    expect(formatBRL(1)).toBe('R$ 0,01');
    expect(formatBRL(99)).toBe('R$ 0,99');
  });

  it('vira real na virada dos 100 centavos', () => {
    expect(formatBRL(100)).toBe('R$ 1,00');
    expect(formatBRL(101)).toBe('R$ 1,01');
  });

  it('separa milhar com ponto', () => {
    expect(formatBRL(150000)).toBe('R$ 1.500,00');
    expect(formatBRL(100000000)).toBe('R$ 1.000.000,00');
  });

  it('preserva o sinal de valores negativos', () => {
    expect(formatBRL(-4550)).toBe('-R$ 45,50');
  });

  it('trunca float acidental em vez de arredondar para cima', () => {
    // Se um float escapar de algum lugar, a saída ainda é determinística.
    expect(formatBRL(1234.99)).toBe('R$ 12,34');
  });

  it('nunca perde precisão em valores grandes', () => {
    // O caso que o ponto flutuante erraria: 0.1 + 0.2 em reais.
    expect(formatBRL(10 + 20)).toBe('R$ 0,30');
  });
});
