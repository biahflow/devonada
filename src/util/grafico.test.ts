import { caminhoDeLinha, escalarSerie, proporcoes } from './grafico';

describe('escalarSerie', () => {
  it('devolve vazio para série vazia — o caso do backend sem histórico', () => {
    const { pontos, min, max } = escalarSerie([], 100, 50);
    expect(pontos).toEqual([]);
    expect(min).toBe(0);
    expect(max).toBe(0);
  });

  it('centraliza o ponto único em vez de grudar na borda', () => {
    const { pontos } = escalarSerie([5000], 100, 50);
    expect(pontos).toHaveLength(1);
    expect(pontos[0]!.x).toBe(50);
  });

  it('não divide por zero quando todos os valores são iguais', () => {
    const { pontos } = escalarSerie([1000, 1000, 1000], 100, 50);
    expect(pontos.every((p) => Number.isFinite(p.y))).toBe(true);
    // Amplitude zero manda a linha para o meio, não para uma das bordas.
    expect(pontos.every((p) => p.y === 25)).toBe(true);
  });

  it('inverte o eixo Y — maior valor fica mais alto na tela', () => {
    const { pontos } = escalarSerie([100, 200], 100, 50);
    expect(pontos[1]!.y).toBeLessThan(pontos[0]!.y);
  });

  it('distribui os pontos na largura, do primeiro ao último', () => {
    const { pontos } = escalarSerie([1, 2, 3], 100, 50);
    expect(pontos[0]!.x).toBe(0);
    expect(pontos[2]!.x).toBe(100);
  });

  it('preserva a ordem da série', () => {
    const { pontos } = escalarSerie([300, 100, 200], 90, 50);
    expect(pontos.map((p) => p.x)).toEqual([0, 45, 90]);
  });

  it('respeita o padding vertical', () => {
    const { pontos } = escalarSerie([0, 100], 100, 50, 10);
    expect(Math.min(...pontos.map((p) => p.y))).toBeGreaterThanOrEqual(10);
    expect(Math.max(...pontos.map((p) => p.y))).toBeLessThanOrEqual(40);
  });

  it('reporta o mínimo e o máximo da série', () => {
    const { min, max } = escalarSerie([300, 100, 200], 100, 50);
    expect(min).toBe(100);
    expect(max).toBe(300);
  });
});

describe('caminhoDeLinha', () => {
  it('devolve string vazia sem pontos', () => {
    expect(caminhoDeLinha([])).toBe('');
  });

  it('começa com M e segue com L', () => {
    const d = caminhoDeLinha([
      { x: 0, y: 10 },
      { x: 5, y: 20 },
    ]);
    expect(d).toBe('M 0.00 10.00 L 5.00 20.00');
  });
});

describe('proporcoes', () => {
  it('devolve vazio para lista vazia', () => {
    expect(proporcoes([])).toEqual([]);
  });

  it('normaliza pelo maior valor', () => {
    expect(proporcoes([50, 100, 25])).toEqual([0.5, 1, 0.25]);
  });

  it('devolve zeros quando o máximo é zero, sem dividir por zero', () => {
    expect(proporcoes([0, 0])).toEqual([0, 0]);
  });

  it('trata valor negativo como zero em vez de barra invertida', () => {
    expect(proporcoes([-10, 100])).toEqual([0, 1]);
  });
});
