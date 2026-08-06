import { ehAnterior, formatMes, formatMesCurto, mesAnterior, mesSeguinte } from './mes';

describe('mesAnterior', () => {
  it('anda um mês para trás', () => {
    expect(mesAnterior('2024-03')).toBe('2024-02');
  });

  it('atravessa a virada de ano', () => {
    expect(mesAnterior('2024-01')).toBe('2023-12');
  });

  it('mantém dois dígitos no mês', () => {
    expect(mesAnterior('2024-11')).toBe('2024-10');
    expect(mesAnterior('2024-10')).toBe('2024-09');
  });

  it('devolve a entrada quando ela é inválida, em vez de quebrar', () => {
    expect(mesAnterior('lixo')).toBe('lixo');
    expect(mesAnterior('2024-13')).toBe('2024-13');
  });
});

describe('mesSeguinte', () => {
  it('anda um mês para frente', () => {
    expect(mesSeguinte('2024-03')).toBe('2024-04');
  });

  it('atravessa a virada de ano', () => {
    expect(mesSeguinte('2023-12')).toBe('2024-01');
  });

  it('mantém dois dígitos no mês', () => {
    expect(mesSeguinte('2024-09')).toBe('2024-10');
  });
});

describe('ehAnterior', () => {
  it('compara meses do mesmo ano', () => {
    expect(ehAnterior('2024-02', '2024-03')).toBe(true);
    expect(ehAnterior('2024-03', '2024-02')).toBe(false);
  });

  it('compara meses de anos diferentes', () => {
    expect(ehAnterior('2023-12', '2024-01')).toBe(true);
    expect(ehAnterior('2024-01', '2023-12')).toBe(false);
  });

  it('não considera o mesmo mês como anterior — é o que trava a navegação para o futuro', () => {
    expect(ehAnterior('2024-03', '2024-03')).toBe(false);
  });
});

describe('formatMes', () => {
  it('escreve por extenso em pt-BR', () => {
    expect(formatMes('2024-03')).toBe('março de 2024');
    expect(formatMes('2024-12')).toBe('dezembro de 2024');
    expect(formatMes('2024-01')).toBe('janeiro de 2024');
  });

  it('devolve a entrada inválida sem quebrar', () => {
    expect(formatMes('2024-99')).toBe('2024-99');
  });
});

describe('formatMesCurto', () => {
  it('abrevia para o eixo do gráfico', () => {
    expect(formatMesCurto('2024-03')).toBe('mar/24');
    expect(formatMesCurto('2023-11')).toBe('nov/23');
  });
});
