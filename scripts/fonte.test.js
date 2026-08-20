/**
 * Testes do leitor de fonte do gate de dígitos.
 *
 * O gate só vale alguma coisa se o parser estiver certo, e parsing binário erra
 * em silêncio: um `idRangeOffset` lido como offset absoluto, ou um
 * `numberOfHMetrics` ignorado, devolvem NÚMERO — número errado, com tabela
 * bonita ao lado. Isso é pior que não medir, porque vira evidência. Mesma razão
 * pela qual `contraste.test.js` confere o CIEDE2000 contra dado publicado.
 *
 * Por isso os testes vêm em duas camadas:
 *
 * 1. Uma fonte SINTÉTICA montada byte a byte aqui, cujos avanços são conhecidos
 *    porque foram escritos nesta linha. É o oráculo: independe de qualquer
 *    arquivo de terceiro e falha se o parser passar a ler outra coisa.
 * 2. As fontes REAIS do projeto, contra valores de referência verificáveis
 *    (`unitsPerEm` 2048 da Inter, 1000 da Archivo Black, os 667 dos dez dígitos
 *    dela). Prova que o leitor funciona em arquivo de verdade, não só no que
 *    ele mesmo montou.
 *
 * O arquivo é `.js` e não `.ts` de propósito: `scripts/` é ferramenta de linha
 * de comando rodada por `node` puro, fora do `tsconfig.json` e sem
 * transpilador. Testar a mesma implementação que o comando executa exige falar
 * a língua dela.
 */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const {
  lerTabelas,
  lerHead,
  lerHhea,
  lerMaxp,
  escolherSubtabelaCmap,
  glifoDoCodePoint,
  advanceWidth,
  featuresGSUB,
  medirDigitos,
  tabelaDigitos,
  extrairTipografiaNumeric,
} = require('./fonte');

const RAIZ = join(__dirname, '..');

// --- montagem de uma fonte sintética ----------------------------------------
// Só o suficiente para o leitor: head, hhea, maxp, cmap, hmtx e GSUB. Os
// dígitos '0'–'9' caem sempre nos glifos 1–10.

function tabelaHead(unitsPerEm) {
  const b = Buffer.alloc(54);
  b.writeUInt32BE(0x00010000, 0);
  b.writeUInt32BE(0x5f0f3cf5, 12); // magicNumber
  b.writeUInt16BE(unitsPerEm, 18);
  b.writeInt16BE(0, 50); // indexToLocFormat
  return b;
}

function tabelaHhea(numberOfHMetrics) {
  const b = Buffer.alloc(36);
  b.writeUInt32BE(0x00010000, 0);
  b.writeInt16BE(800, 4); // ascender
  b.writeInt16BE(-200, 6); // descender
  b.writeUInt16BE(1000, 10); // advanceWidthMax
  b.writeUInt16BE(numberOfHMetrics, 34);
  return b;
}

function tabelaMaxp(numGlyphs) {
  const b = Buffer.alloc(32);
  b.writeUInt32BE(0x00010000, 0);
  b.writeUInt16BE(numGlyphs, 4);
  return b;
}

/** `avancos.length` pares (advance, lsb); o resto da fonte só tem lsb. */
function tabelaHmtx(avancos, numGlyphs) {
  const n = avancos.length;
  const b = Buffer.alloc(n * 4 + (numGlyphs - n) * 2);
  avancos.forEach((a, i) => {
    b.writeUInt16BE(a, i * 4);
    b.writeInt16BE(10 + i, i * 4 + 2);
  });
  for (let g = n; g < numGlyphs; g += 1) b.writeInt16BE(7, n * 4 + (g - n) * 2);
  return b;
}

/** Formato 4 com um segmento de dígitos por `idDelta`, mais o terminador. */
function subtabelaFormato4() {
  const b = Buffer.alloc(32);
  b.writeUInt16BE(4, 0);
  b.writeUInt16BE(32, 2); // length
  b.writeUInt16BE(0, 4); // language
  b.writeUInt16BE(4, 6); // segCountX2 → segCount 2
  b.writeUInt16BE(4, 8);
  b.writeUInt16BE(1, 10);
  b.writeUInt16BE(0, 12);
  b.writeUInt16BE(0x39, 14); // endCode[0] = '9'
  b.writeUInt16BE(0xffff, 16); // endCode[1]
  b.writeUInt16BE(0, 18); // reservedPad
  b.writeUInt16BE(0x30, 20); // startCode[0] = '0'
  b.writeUInt16BE(0xffff, 22);
  b.writeInt16BE(1 - 0x30, 24); // idDelta[0]: '0' (0x30) → glifo 1
  b.writeInt16BE(1, 26);
  b.writeUInt16BE(0, 28); // idRangeOffset[0]
  b.writeUInt16BE(0, 30);
  return b;
}

/** Formato 12, um grupo contíguo. `ultimo` permite deixar um dígito de fora. */
function subtabelaFormato12(ultimo = '9') {
  const b = Buffer.alloc(28);
  b.writeUInt16BE(12, 0);
  b.writeUInt16BE(0, 2);
  b.writeUInt32BE(28, 4); // length
  b.writeUInt32BE(0, 8); // language
  b.writeUInt32BE(1, 12); // numGroups
  b.writeUInt32BE(0x30, 16); // startCharCode
  b.writeUInt32BE(ultimo.codePointAt(0), 20); // endCharCode
  b.writeUInt32BE(1, 24); // startGlyphID
  return b;
}

function tabelaCmap(sub, platformID, encodingID) {
  const cab = Buffer.alloc(12);
  cab.writeUInt16BE(0, 0); // version
  cab.writeUInt16BE(1, 2); // numTables
  cab.writeUInt16BE(platformID, 4);
  cab.writeUInt16BE(encodingID, 6);
  cab.writeUInt32BE(12, 8); // offset da subtabela, a partir da cmap
  return Buffer.concat([cab, sub]);
}

function tabelaGSUB(features) {
  const cab = Buffer.alloc(10);
  cab.writeUInt16BE(1, 0); // majorVersion
  cab.writeUInt16BE(0, 2);
  cab.writeUInt16BE(10, 4); // scriptListOffset
  cab.writeUInt16BE(10, 6); // featureListOffset
  cab.writeUInt16BE(10, 8); // lookupListOffset
  const lista = Buffer.alloc(2 + features.length * 6);
  lista.writeUInt16BE(features.length, 0);
  features.forEach((t, i) => {
    lista.write(t, 2 + i * 6, 4, 'ascii');
    lista.writeUInt16BE(0, 2 + i * 6 + 4);
  });
  return Buffer.concat([cab, lista]);
}

function montarFonte({
  unitsPerEm = 1000,
  avancos = [500, 600, 600, 600, 600, 777],
  numGlyphs = 12,
  formatoCmap = 4,
  ultimoDigito = '9',
  features = ['liga', 'tnum', 'liga'],
  versao = 0x00010000,
} = {}) {
  const partes = [
    ['cmap', tabelaCmap(...(formatoCmap === 12
      ? [subtabelaFormato12(ultimoDigito), 3, 10]
      : [subtabelaFormato4(), 3, 1]))],
    ['head', tabelaHead(unitsPerEm)],
    ['hhea', tabelaHhea(avancos.length)],
    ['hmtx', tabelaHmtx(avancos, numGlyphs)],
    ['maxp', tabelaMaxp(numGlyphs)],
  ];
  if (features !== null) partes.unshift(['GSUB', tabelaGSUB(features)]);

  const cabecalho = Buffer.alloc(12 + partes.length * 16);
  cabecalho.writeUInt32BE(versao, 0);
  cabecalho.writeUInt16BE(partes.length, 4);

  let offset = cabecalho.length;
  const corpos = [];
  partes.forEach(([nome, corpo], i) => {
    const reg = 12 + i * 16;
    cabecalho.write(nome, reg, 4, 'ascii');
    cabecalho.writeUInt32BE(0, reg + 4); // checkSum, que o leitor ignora
    cabecalho.writeUInt32BE(offset, reg + 8);
    cabecalho.writeUInt32BE(corpo.length, reg + 12);
    corpos.push(corpo);
    offset += corpo.length;
  });
  return Buffer.concat([cabecalho, ...corpos]);
}

// --- camada 1: a fonte sintética --------------------------------------------

describe('table directory', () => {
  it('acha as seis tabelas montadas, com offset e length', () => {
    const tabelas = lerTabelas(montarFonte());
    expect([...tabelas.keys()].sort()).toEqual(['GSUB', 'cmap', 'head', 'hhea', 'hmtx', 'maxp']);
    const head = tabelas.get('head');
    expect(head.length).toBe(54);
    expect(head.offset).toBeGreaterThan(12);
  });

  it('recusa uma TrueType Collection em vez de ler lixo', () => {
    expect(() => lerTabelas(montarFonte({ versao: 0x74746366 }))).toThrow(/TrueType Collection/);
  });

  it('recusa sfntVersion desconhecida', () => {
    expect(() => lerTabelas(montarFonte({ versao: 0x12345678 }))).toThrow(/sfntVersion desconhecida/);
  });

  it('recusa arquivo pequeno demais para ter um cabeçalho', () => {
    expect(() => lerTabelas(Buffer.alloc(8))).toThrow(/pequeno demais/);
  });
});

describe('head, hhea e maxp', () => {
  it('lê unitsPerEm, numberOfHMetrics e numGlyphs', () => {
    const buf = montarFonte({ unitsPerEm: 2048, numGlyphs: 12 });
    const tabelas = lerTabelas(buf);
    expect(lerHead(buf, tabelas).unitsPerEm).toBe(2048);
    expect(lerHhea(buf, tabelas).numberOfHMetrics).toBe(6);
    expect(lerMaxp(buf, tabelas).numGlyphs).toBe(12);
  });

  it('exige o magicNumber de head — é ele que prova que o offset está certo', () => {
    const buf = montarFonte();
    const { offset } = lerTabelas(buf).get('head');
    buf.writeUInt32BE(0xdeadbeef, offset + 12);
    expect(() => lerHead(buf, lerTabelas(buf))).toThrow(/magicNumber/);
  });

  it('recusa unitsPerEm fora da faixa legal do formato', () => {
    expect(() => {
      const buf = montarFonte({ unitsPerEm: 8 });
      lerHead(buf, lerTabelas(buf));
    }).toThrow(/unitsPerEm fora da faixa/);
  });

  it('reclama da tabela ausente pelo nome, listando as que existem', () => {
    const buf = montarFonte();
    const tabelas = lerTabelas(buf);
    tabelas.delete('hhea');
    expect(() => lerHhea(buf, tabelas)).toThrow(/não tem a tabela 'hhea'/);
  });
});

describe('cmap', () => {
  it('formato 4 resolve os dígitos pelo idDelta', () => {
    const buf = montarFonte({ formatoCmap: 4 });
    const sub = escolherSubtabelaCmap(buf, lerTabelas(buf));
    expect(sub.formato).toBe(4);
    expect(glifoDoCodePoint(buf, sub, 0x30)).toBe(1); // '0'
    expect(glifoDoCodePoint(buf, sub, 0x39)).toBe(10); // '9'
  });

  it('formato 4 devolve 0 para caractere fora de qualquer segmento', () => {
    const buf = montarFonte({ formatoCmap: 4 });
    const sub = escolherSubtabelaCmap(buf, lerTabelas(buf));
    expect(glifoDoCodePoint(buf, sub, 0x41)).toBe(0); // 'A'
    expect(glifoDoCodePoint(buf, sub, 0x2f)).toBe(0); // '/'
  });

  it('formato 12 resolve os dígitos pelo grupo contíguo', () => {
    const buf = montarFonte({ formatoCmap: 12 });
    const sub = escolherSubtabelaCmap(buf, lerTabelas(buf));
    expect(sub.formato).toBe(12);
    expect(glifoDoCodePoint(buf, sub, 0x30)).toBe(1);
    expect(glifoDoCodePoint(buf, sub, 0x35)).toBe(6);
    expect(glifoDoCodePoint(buf, sub, 0x39)).toBe(10);
    expect(glifoDoCodePoint(buf, sub, 0x3a)).toBe(0);
  });

  /**
   * O caso que erra em silêncio. No formato 4, `idRangeOffset` é medido a
   * partir da POSIÇÃO DELE PRÓPRIO dentro do array, não do início da
   * subtabela. Ler como offset absoluto devolve um glifo — o glifo errado.
   */
  it('formato 4 segue o idRangeOffset a partir da própria posição dele', () => {
    const b = Buffer.alloc(42);
    b.writeUInt16BE(4, 0);
    b.writeUInt16BE(42, 2);
    b.writeUInt16BE(0, 4);
    b.writeUInt16BE(6, 6); // segCount 3
    b.writeUInt16BE(0x42, 14); // endCode: 'B', 'Z', terminador
    b.writeUInt16BE(0x5a, 16);
    b.writeUInt16BE(0xffff, 18);
    b.writeUInt16BE(0, 20); // reservedPad
    b.writeUInt16BE(0x41, 22); // startCode: 'A', 'Z', terminador
    b.writeUInt16BE(0x5a, 24);
    b.writeUInt16BE(0xffff, 26);
    b.writeInt16BE(1 - 0x41, 28); // idDelta: 'A' → 1
    b.writeInt16BE(0, 30);
    b.writeInt16BE(1, 32);
    b.writeUInt16BE(0, 34); // idRangeOffset[0]: caminho do delta
    b.writeUInt16BE(4, 36); // idRangeOffset[1]: 36 + 4 + 0 = 40
    b.writeUInt16BE(0, 38);
    b.writeUInt16BE(5, 40); // glyphIdArray[0]

    const sub = { formato: 4, offset: 0 };
    expect(glifoDoCodePoint(b, sub, 0x41)).toBe(1); // 'A', via idDelta
    expect(glifoDoCodePoint(b, sub, 0x42)).toBe(2); // 'B', via idDelta
    expect(glifoDoCodePoint(b, sub, 0x5a)).toBe(5); // 'Z', via glyphIdArray
    expect(glifoDoCodePoint(b, sub, 0x43)).toBe(0); // 'C', buraco entre segmentos
  });

  it('falha com mensagem clara se a fonte só tiver formato não implementado', () => {
    const sub = Buffer.alloc(10);
    sub.writeUInt16BE(6, 0); // formato 6
    const buf = montarFonte();
    const tabelas = lerTabelas(buf);
    const cmap = tabelaCmap(sub, 1, 0);
    const falso = Buffer.concat([buf, cmap]);
    tabelas.set('cmap', { offset: buf.length, length: cmap.length });
    expect(() => escolherSubtabelaCmap(falso, tabelas)).toThrow(/formato 4 ou 12/);
  });
});

describe('hmtx', () => {
  /**
   * O erro clássico de leitura de `hmtx`: a tabela para de listar avanços em
   * `numberOfHMetrics`, e todo glifo daí em diante HERDA o último. Quem ignora
   * isso lê left-side-bearing como se fosse largura — e uma fonte monoespaçada
   * passa a parecer proporcional, ou o contrário.
   */
  it('faz o glifo além de numberOfHMetrics herdar o último avanço listado', () => {
    const buf = montarFonte({ avancos: [500, 600, 600, 600, 600, 777], numGlyphs: 12 });
    const tabelas = lerTabelas(buf);
    const { numberOfHMetrics } = lerHhea(buf, tabelas);
    expect(numberOfHMetrics).toBe(6);
    expect(advanceWidth(buf, tabelas, 5, numberOfHMetrics)).toBe(777);
    expect(advanceWidth(buf, tabelas, 6, numberOfHMetrics)).toBe(777);
    expect(advanceWidth(buf, tabelas, 11, numberOfHMetrics)).toBe(777);
  });
});

describe('GSUB', () => {
  it('lista as tags de feature, sem repetir e em ordem', () => {
    const buf = montarFonte({ features: ['liga', 'tnum', 'liga', 'aalt'] });
    expect(featuresGSUB(buf, lerTabelas(buf))).toEqual(['aalt', 'liga', 'tnum']);
  });

  it('fonte sem GSUB não é erro: é resposta "não oferece feature nenhuma"', () => {
    const buf = montarFonte({ features: null });
    expect(featuresGSUB(buf, lerTabelas(buf))).toEqual([]);
  });
});

describe('medirDigitos na fonte sintética', () => {
  it('mede os dez dígitos, normaliza por unitsPerEm e compara com o "0"', () => {
    const medida = medirDigitos(
      montarFonte({ unitsPerEm: 1000, avancos: [500, 600, 600, 600, 600, 777], numGlyphs: 12 }),
    );

    expect(medida.unitsPerEm).toBe(1000);
    expect(medida.larguraDoZero).toBe(600);
    expect(medida.digitos.map((d) => d.glyphId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // '0'–'3' listados a 600; '4' a 777; '5'–'9' herdam o 777 do glifo 5.
    expect(medida.digitos.map((d) => d.advanceWidth)).toEqual([
      600, 600, 600, 600, 777, 777, 777, 777, 777, 777,
    ]);
    expect(medida.digitos[0].em).toBeCloseTo(0.6, 10);
    expect(medida.digitos[4].em).toBeCloseTo(0.777, 10);
    expect(medida.digitos[4].diferenca).toBe(177);
    expect(medida.digitos.map((d) => d.divergeDoZero)).toEqual([
      false, false, false, false, true, true, true, true, true, true,
    ]);
    expect(medida.larguraFixa).toBe(false);
    expect(medida.amplitude).toBe(177);
    expect(medida.temTnum).toBe(true);
  });

  it('reconhece largura fixa quando os dez avanços batem', () => {
    const medida = medirDigitos(
      montarFonte({ avancos: [500, 600, 600, 600, 600, 600], features: ['liga'] }),
    );
    expect(medida.larguraFixa).toBe(true);
    expect(medida.amplitude).toBe(0);
    expect(medida.temTnum).toBe(false);
  });

  it('chega ao mesmo resultado lendo cmap formato 12', () => {
    const porFormato4 = medirDigitos(montarFonte({ formatoCmap: 4 }));
    const porFormato12 = medirDigitos(montarFonte({ formatoCmap: 12 }));
    expect(porFormato12.digitos.map((d) => d.advanceWidth)).toEqual(
      porFormato4.digitos.map((d) => d.advanceWidth),
    );
  });

  it('acusa dígito que a fonte não mapeia, em vez de medir o .notdef', () => {
    expect(() => medirDigitos(montarFonte({ formatoCmap: 12, ultimoDigito: '7' }))).toThrow(
      /não mapeia o\(s\) dígito\(s\) 8, 9/,
    );
  });
});

// --- camada 2: as fontes reais do projeto -----------------------------------

const CAMINHOS = {
  Inter_400Regular: '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf',
  Inter_600SemiBold: '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf',
  Inter_700Bold: '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf',
  ArchivoBlack_400Regular: '@expo-google-fonts/archivo-black/400Regular/ArchivoBlack_400Regular.ttf',
};

function medirFonteReal(nome) {
  return medirDigitos(readFileSync(join(RAIZ, 'node_modules', CAMINHOS[nome])));
}

describe('as fontes reais do app', () => {
  it('Inter_700Bold: dígitos PROPORCIONAIS, e é essa medição que motivou o tabular-nums', () => {
    const m = medirFonteReal('Inter_700Bold');
    expect(m.unitsPerEm).toBe(2048);
    // Os dois números que aparecem no comentário de src/theme/theme.ts.
    expect(m.digitos[0].advanceWidth).toBe(1381); // '0'
    expect(m.digitos[1].advanceWidth).toBe(883); // '1'
    expect(m.amplitude).toBe(502);
    expect(m.larguraFixa).toBe(false);
    expect(m.temTnum).toBe(true);
  });

  it('os outros dois pesos da Inter também são proporcionais e também têm tnum', () => {
    for (const nome of ['Inter_400Regular', 'Inter_600SemiBold']) {
      const m = medirFonteReal(nome);
      expect(m.unitsPerEm).toBe(2048);
      expect(m.larguraFixa).toBe(false);
      expect(m.temTnum).toBe(true);
    }
  });

  it('ArchivoBlack_400Regular: já é tabular, e por isso display não pede nada', () => {
    const m = medirFonteReal('ArchivoBlack_400Regular');
    expect(m.unitsPerEm).toBe(1000);
    expect(m.digitos.map((d) => d.advanceWidth)).toEqual(Array(10).fill(667));
    expect(m.larguraFixa).toBe(true);
    expect(m.amplitude).toBe(0);
    // Não declara `tnum` — e não precisa: já é tabular por padrão.
    expect(m.temTnum).toBe(false);
  });

  it('exercita os dois formatos de cmap em arquivo de verdade', () => {
    // Inter traz formato 12 (Windows UCS-4); Archivo Black, formato 4 (BMP).
    expect(medirFonteReal('Inter_700Bold').cmap.formato).toBe(12);
    expect(medirFonteReal('ArchivoBlack_400Regular').cmap.formato).toBe(4);
  });

  it('exercita a herança de avanço em arquivo de verdade', () => {
    // A Archivo Black lista menos métricas que glifos: os últimos herdam.
    const m = medirFonteReal('ArchivoBlack_400Regular');
    expect(m.numberOfHMetrics).toBeLessThan(m.numGlyphs);
  });
});

describe('tabelaDigitos', () => {
  it('imprime caractere, glyphId, avanço bruto, em e a divergência', () => {
    const linhas = tabelaDigitos(medirFonteReal('Inter_700Bold')).split('\n');
    expect(linhas[0]).toContain('advanceWidth');
    expect(linhas[2]).toBe('| `0` | 1339 | 1381 | 0.6743 | não |');
    expect(linhas[3]).toBe('| `1` | 1340 | 883 | 0.4312 | **sim** (-498) |');
  });
});

// --- o lado do tema ---------------------------------------------------------

describe('extrairTipografiaNumeric', () => {
  it('lê o theme.ts de verdade e encontra a correção aplicada', () => {
    const fonte = readFileSync(join(RAIZ, 'src', 'theme', 'theme.ts'), 'utf8');
    expect(extrairTipografiaNumeric(fonte)).toEqual({
      fontFamily: 'Inter_700Bold',
      temTabularNums: true,
    });
  });

  const familia = `export const fontFamily = {
  regular: 'Inter_400Regular',
  bold: 'Inter_700Bold',
  display: 'ArchivoBlack_400Regular',
} as const;`;

  it('resolve o fontVariant quando ele é um array literal', () => {
    const src = `${familia}
const typography = {
  numeric: { fontSize: 18, fontFamily: fontFamily.bold, fontVariant: ['tabular-nums'] },
} as const;`;
    expect(extrairTipografiaNumeric(src)).toEqual({
      fontFamily: 'Inter_700Bold',
      temTabularNums: true,
    });
  });

  it('resolve o fontVariant quando ele é uma const declarada no arquivo', () => {
    const src = `${familia}
const digitosTabulares: 'tabular-nums'[] = ['tabular-nums'];
const typography = {
  numeric: { fontSize: 18, fontFamily: fontFamily.bold, fontVariant: digitosTabulares },
} as const;`;
    expect(extrairTipografiaNumeric(src).temTabularNums).toBe(true);
  });

  /** É esta a regressão que o gate existe para pegar. */
  it('vê a ausência do fontVariant, que é o que faz a coluna voltar a dançar', () => {
    const src = `${familia}
const typography = {
  numeric: { fontSize: 18, fontFamily: fontFamily.bold },
} as const;`;
    expect(extrairTipografiaNumeric(src)).toEqual({
      fontFamily: 'Inter_700Bold',
      temTabularNums: false,
    });
  });

  it('vê a troca da família da escala', () => {
    const src = `${familia}
const typography = {
  numeric: { fontSize: 18, fontFamily: fontFamily.display },
} as const;`;
    expect(extrairTipografiaNumeric(src).fontFamily).toBe('ArchivoBlack_400Regular');
  });

  it('não adivinha quando o theme.ts muda de formato', () => {
    expect(() => extrairTipografiaNumeric('const nada = 1;')).toThrow(/fontFamily/);
    expect(() => extrairTipografiaNumeric(familia)).toThrow(/numeric/);
  });

  it('não adivinha um fontVariant que não consegue resolver', () => {
    const src = `${familia}
const typography = {
  numeric: { fontFamily: fontFamily.bold, fontVariant: vindoDeOutroArquivo },
} as const;`;
    expect(() => extrairTipografiaNumeric(src)).toThrow(/não consegui resolver/);
  });

  it('acusa fontFamily que aponta para chave inexistente', () => {
    const src = `${familia}
const typography = {
  numeric: { fontFamily: fontFamily.inventada },
} as const;`;
    expect(() => extrairTipografiaNumeric(src)).toThrow(/não existe/);
  });
});
