/**
 * Testes da matemática do gate de paleta.
 *
 * O gate só vale alguma coisa se a fórmula estiver certa: um CIEDE2000 com o
 * termo de rotação errado aprova em silêncio um par que reprovaria de verdade —
 * e o resultado seria pior que não medir, porque viria com número e tabela.
 * Por isso as duas fórmulas são conferidas contra DADO DE REFERÊNCIA PUBLICADO,
 * não contra a saída delas mesmas.
 *
 * O arquivo é `.js` e não `.ts` de propósito: `scripts/` é ferramenta de linha
 * de comando rodada por `node` puro, fora do alcance do `tsconfig.json` (que
 * inclui só `.ts` e `.tsx`) e sem transpilador. Testar a mesma implementação
 * que o gate executa exige falar a língua dela.
 */
const {
  contrasteWCAG,
  luminanciaRelativa,
  hexParaRgb,
  hexParaLab,
  deltaE2000Lab,
  deltaE2000,
  extrairTokens,
  avaliarPar,
  tabelaMarkdown,
} = require('./contraste');

describe('hexParaRgb', () => {
  it('lê os três canais de um #RRGGBB', () => {
    expect(hexParaRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexParaRgb('#FFFFFF')).toEqual([255, 255, 255]);
    expect(hexParaRgb('#E5352B')).toEqual([229, 53, 43]);
  });

  it('recusa formato que não seja #RRGGBB, em vez de adivinhar', () => {
    expect(() => hexParaRgb('#FFF')).toThrow(/hex inválido/);
    expect(() => hexParaRgb('E5352B')).toThrow(/hex inválido/);
    expect(() => hexParaRgb('rgb(229,53,43)')).toThrow(/hex inválido/);
  });
});

describe('luminância relativa WCAG 2.1', () => {
  it('vai de 0 no preto a 1 no branco', () => {
    expect(luminanciaRelativa('#000000')).toBeCloseTo(0, 10);
    expect(luminanciaRelativa('#FFFFFF')).toBeCloseTo(1, 10);
  });

  it('usa o degrau 0.03928 e não uma gama simples', () => {
    // #050505 cai no ramo LINEAR da curva (5/255 = 0,0196 <= 0,03928).
    // Uma implementação que aplicasse ((c+0.055)/1.055)^2.4 em toda a faixa
    // devolveria ~0,00037 aqui, e não 0,00152.
    expect(luminanciaRelativa('#050505')).toBeCloseTo(0.0015176, 6);
  });
});

describe('contraste WCAG 2.1', () => {
  it('dá exatamente 21:1 entre preto e branco', () => {
    expect(contrasteWCAG('#000000', '#FFFFFF')).toBeCloseTo(21, 10);
  });

  it('dá 1:1 entre uma cor e ela mesma', () => {
    expect(contrasteWCAG('#E5352B', '#E5352B')).toBeCloseTo(1, 10);
  });

  it('é simétrico: a ordem das cores não muda o resultado', () => {
    expect(contrasteWCAG('#8A8F98', '#1F232B')).toBeCloseTo(
      contrasteWCAG('#1F232B', '#8A8F98'),
      10,
    );
  });

  it('reproduz o valor de referência do cinza limítrofe da WCAG', () => {
    // #767676 sobre branco é o cinza mais escuro citado como "o mais claro que
    // ainda passa 4,5:1" na literatura da WCAG: 4,54:1.
    expect(contrasteWCAG('#767676', '#FFFFFF')).toBeCloseTo(4.5422, 4);
  });
});

describe('CIELAB', () => {
  // A tolerância é 1e-4 e não 1e-6 porque a matriz sRGB→XYZ tem 7 casas e o
  // ponto branco D65 tem 5: branco não fecha em L 100,000000, e sim em
  // 100,0000039. Exigir mais casas seria testar o arredondamento das
  // constantes publicadas, não a conversão.
  it('leva branco a L 100 e preto a L 0, com croma zero', () => {
    const branco = hexParaLab('#FFFFFF');
    expect(branco[0]).toBeCloseTo(100, 4);
    expect(branco[1]).toBeCloseTo(0, 4);
    expect(branco[2]).toBeCloseTo(0, 4);

    const preto = hexParaLab('#000000');
    expect(preto[0]).toBeCloseTo(0, 6);
  });

  it('leva o cinza médio de 8 bits a L 53,59 — o valor conhecido de #808080', () => {
    expect(hexParaLab('#808080')[0]).toBeCloseTo(53.585, 3);
  });
});

describe('CIEDE2000', () => {
  /**
   * Sharma, Wu & Dalal (2005), tabela de dados suplementares. É o conjunto que
   * existe justamente para pegar implementação que erra o termo de rotação R_T
   * ou o tratamento do ângulo médio de matiz na virada dos 360°.
   */
  const referencia = [
    [[50.0, 2.6772, -79.7751], [50.0, 0.0, -82.7485], 2.0425],
    [[50.0, 3.1571, -77.2803], [50.0, 0.0, -82.7485], 2.8615],
    [[50.0, 2.8361, -74.02], [50.0, 0.0, -82.7485], 3.4412],
    [[50.0, 2.5, 0.0], [50.0, 0.0, -2.5], 4.3065],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
    [[61.2901, 3.7196, -5.3901], [61.4292, 2.248, -4.962], 1.8731],
    [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
    [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
    [[36.4612, 47.858, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
    [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ];

  it.each(referencia)('bate o dado de Sharma: %j × %j = ΔE %f', (lab1, lab2, esperado) => {
    expect(deltaE2000Lab(lab1, lab2)).toBeCloseTo(esperado, 4);
  });

  it('dá 0 entre uma cor e ela mesma', () => {
    expect(deltaE2000('#1FC16B', '#1FC16B')).toBeCloseTo(0, 10);
  });

  it('é simétrico', () => {
    expect(deltaE2000('#1FC16B', '#3FDC8A')).toBeCloseTo(
      deltaE2000('#3FDC8A', '#1FC16B'),
      10,
    );
  });
});

describe('extrairTokens', () => {
  it('lê os hex declarados no formato do theme.ts', () => {
    const tokens = extrairTokens(`
      export const colors = {
        background: '#101216', // fundo de tela (grafite)
        debt: '#E5352B',
      } as const;
      export const categoria = { teal: '#2DD4BF' } as const;
    `);
    expect(tokens.get('background')).toBe('#101216');
    expect(tokens.get('debt')).toBe('#E5352B');
    expect(tokens.get('teal')).toBe('#2DD4BF');
  });

  it('ignora valor que não é hex de 6 dígitos', () => {
    const tokens = extrairTokens(`
      const t = { regular: 'Inter_400Regular', curto: '#FFF', sm: 8 };
    `);
    expect(tokens.has('regular')).toBe(false);
    expect(tokens.has('curto')).toBe(false);
    expect(tokens.has('sm')).toBe(false);
  });
});

describe('avaliarPar', () => {
  const tokens = extrairTokens(`
    background: '#101216',
    surface: '#181B21',
    debt: '#E5352B',
    debtText: '#EC6C65',
    accent: '#3FDC8A',
    primary: '#1FC16B',
  `);

  it('reprova o vermelho da marca no piso de texto e o aprova no de gráfico', () => {
    const comoTexto = avaliarPar({ fg: 'debt', bg: 'background', intencao: 'texto' }, tokens);
    expect(comoTexto.passou).toBe(false);
    expect(comoTexto.reprovado).toBe(true);
    expect(comoTexto.medidaFormatada).toBe('4,35:1');

    const comoGrafico = avaliarPar({ fg: 'debt', bg: 'background', intencao: 'grafico' }, tokens);
    expect(comoGrafico.passou).toBe(true);
    expect(comoGrafico.reprovado).toBe(false);
  });

  it('aprova o token de texto do vermelho nas duas superfícies', () => {
    expect(avaliarPar({ fg: 'debtText', bg: 'background', intencao: 'texto' }, tokens).passou).toBe(
      true,
    );
    expect(avaliarPar({ fg: 'debtText', bg: 'surface', intencao: 'texto' }, tokens).passou).toBe(
      true,
    );
  });

  it('mede a exceção declarada, mas não a deixa reprovar', () => {
    const par = avaliarPar(
      { fg: 'primary', bg: 'accent', intencao: 'dupla', excecao: 'proximidade é o desenho' },
      tokens,
    );
    expect(par.passou).toBe(false);
    expect(par.reprovado).toBe(false);
    expect(par.medidaFormatada).toBe('ΔE 7,1');
  });

  it('falha com mensagem clara quando o par cita token que não existe no tema', () => {
    expect(() =>
      avaliarPar({ fg: 'debtTextEscuro', bg: 'background', intencao: 'texto' }, tokens),
    ).toThrow(/token 'debtTextEscuro'.*não existe em src\/theme\/theme\.ts/s);
  });

  it('falha quando a intenção não tem piso definido', () => {
    expect(() =>
      avaliarPar({ fg: 'debt', bg: 'background', intencao: 'decorativo' }, tokens),
    ).toThrow(/intenção desconhecida/);
  });
});

describe('tabelaMarkdown', () => {
  const tokens = extrairTokens(`
    background: '#101216',
    debt: '#E5352B',
  `);

  it('marca REPROVA na linha que caiu abaixo do piso', () => {
    const linha = avaliarPar({ fg: 'debt', bg: 'background', intencao: 'texto' }, tokens);
    expect(tabelaMarkdown([linha])).toContain('**REPROVA**');
  });

  it('escreve a justificativa da exceção na própria linha', () => {
    const linha = avaliarPar(
      { fg: 'debt', bg: 'background', intencao: 'texto', excecao: 'só aparece com rótulo' },
      tokens,
    );
    const tabela = tabelaMarkdown([linha]);
    expect(tabela).toContain('**exceção** — só aparece com rótulo');
    expect(tabela).not.toContain('**REPROVA**');
  });
});
