/**
 * Leitura binária de fonte TrueType — a largura de avanço de um glifo, lida do
 * arquivo da fonte.
 *
 * POR QUE ISTO EXISTE. O `theme.ts` tratava "os dígitos da Inter são de largura
 * fixa?" como item de validação em aparelho. Não é: a largura de avanço de um
 * glifo está GRAVADA na tabela `hmtx` do TTF, igual em todo aparelho que
 * renderize aquele arquivo. Perguntar isso a um device é perguntar a coisa
 * errada para a fonte errada — o dado está aqui, a um `readFileSync` de
 * distância, e o que o aparelho decide é outra coisa (se a família chegou a
 * carregar, se o texto coube, se dá para ler no sol).
 *
 * CommonJS, sem dependência, sem I/O — recebe o Buffer já lido. Assim
 * `scripts/digitos-check.mjs` a importa como ferramenta de linha de comando e
 * `scripts/fonte.test.js` a exercita sob o jest: as duas leem a MESMA
 * implementação, que é a única forma de o teste provar algo sobre o que o
 * comando mede. Mesmo arranjo de `contraste.js` / `paleta-check.mjs`, e pela
 * mesma razão — o transform do jest não alcança `.mjs`.
 *
 * NENHUMA dependência de parsing de fonte foi adicionada de propósito: uma
 * medição que existe para não confiar em suposição não deveria estrear puxando
 * árvore de dependências (mesmo argumento da ADR 0018 para o gate de paleta).
 *
 * Referência do formato: Microsoft OpenType spec — tabelas `head`, `hhea`,
 * `maxp`, `cmap` (formatos 4 e 12), `hmtx` e `GSUB`.
 * https://learn.microsoft.com/typography/opentype/spec/
 */

// --- leitura primitiva big-endian -------------------------------------------
// Todo inteiro em sfnt é big-endian. Os wrappers existem para que um arquivo
// truncado falhe dizendo ONDE, em vez de num ERR_OUT_OF_RANGE do Buffer.

function exigirFaixa(buf, offset, tamanho, oQue) {
  if (!Number.isInteger(offset) || offset < 0 || offset + tamanho > buf.length) {
    throw new Error(
      `leitura fora do arquivo${oQue ? ` ao ler ${oQue}` : ''}: ` +
        `offset ${offset}, ${tamanho} byte(s), arquivo de ${buf.length}`,
    );
  }
}

function u8(buf, offset, oQue) {
  exigirFaixa(buf, offset, 1, oQue);
  return buf.readUInt8(offset);
}

function u16(buf, offset, oQue) {
  exigirFaixa(buf, offset, 2, oQue);
  return buf.readUInt16BE(offset);
}

function i16(buf, offset, oQue) {
  exigirFaixa(buf, offset, 2, oQue);
  return buf.readInt16BE(offset);
}

function u32(buf, offset, oQue) {
  exigirFaixa(buf, offset, 4, oQue);
  return buf.readUInt32BE(offset);
}

/** Tag de 4 bytes ASCII, como `head`, `hmtx`, `GSUB`, `tnum`. */
function tag(buf, offset, oQue) {
  exigirFaixa(buf, offset, 4, oQue);
  return String.fromCharCode(
    u8(buf, offset),
    u8(buf, offset + 1),
    u8(buf, offset + 2),
    u8(buf, offset + 3),
  );
}

// --- table directory --------------------------------------------------------

/** Versões de sfnt que este leitor aceita. `OTTO` (CFF) não tem `glyf`, mas tem
 * `hmtx` — e é o avanço que nos interessa, então ela entra. */
const VERSOES = new Set([0x00010000, 0x74727565 /* 'true' */, 0x4f54544f /* 'OTTO' */]);

/**
 * Lê o *table directory* e devolve `Map<tag, { offset, length }>`.
 * Recusa `ttcf` (coleção) com mensagem clara em vez de ler lixo.
 */
function lerTabelas(buf) {
  if (buf.length < 12) throw new Error(`arquivo pequeno demais para um sfnt: ${buf.length} bytes`);

  const versao = u32(buf, 0, 'sfntVersion');
  if (versao === 0x74746366 /* 'ttcf' */) {
    throw new Error('arquivo é uma TrueType Collection (ttcf); passe um TTF/OTF individual');
  }
  if (!VERSOES.has(versao)) {
    throw new Error(`sfntVersion desconhecida: 0x${versao.toString(16).padStart(8, '0')}`);
  }

  const numTables = u16(buf, 4, 'numTables');
  const tabelas = new Map();
  for (let i = 0; i < numTables; i += 1) {
    const registro = 12 + i * 16;
    const nome = tag(buf, registro, `tag da tabela ${i}`);
    tabelas.set(nome, {
      offset: u32(buf, registro + 8, `offset de '${nome}'`),
      length: u32(buf, registro + 12, `length de '${nome}'`),
    });
  }
  return tabelas;
}

function exigirTabela(tabelas, nome) {
  const t = tabelas.get(nome);
  if (!t) {
    throw new Error(
      `a fonte não tem a tabela '${nome}' (tem: ${[...tabelas.keys()].sort().join(' ')})`,
    );
  }
  return t;
}

// --- head, hhea, maxp -------------------------------------------------------

/** `unitsPerEm` é a régua: todo avanço desta fonte se lê em frações dele. */
function lerHead(buf, tabelas) {
  const { offset } = exigirTabela(tabelas, 'head');
  const magico = u32(buf, offset + 12, 'magicNumber de head');
  if (magico !== 0x5f0f3cf5) {
    throw new Error(`magicNumber de 'head' inválido: 0x${magico.toString(16)} (esperado 5f0f3cf5)`);
  }
  const unitsPerEm = u16(buf, offset + 18, 'unitsPerEm');
  if (unitsPerEm < 16 || unitsPerEm > 16384) {
    throw new Error(`unitsPerEm fora da faixa legal do formato (16–16384): ${unitsPerEm}`);
  }
  return { unitsPerEm, indexToLocFormat: i16(buf, offset + 50, 'indexToLocFormat') };
}

/** `numberOfHMetrics` é o que diz onde a `hmtx` para de listar avanços. */
function lerHhea(buf, tabelas) {
  const { offset } = exigirTabela(tabelas, 'hhea');
  return {
    ascender: i16(buf, offset + 4, 'ascender'),
    descender: i16(buf, offset + 6, 'descender'),
    advanceWidthMax: u16(buf, offset + 10, 'advanceWidthMax'),
    numberOfHMetrics: u16(buf, offset + 34, 'numberOfHMetrics'),
  };
}

function lerMaxp(buf, tabelas) {
  const { offset } = exigirTabela(tabelas, 'maxp');
  return { numGlyphs: u16(buf, offset + 4, 'numGlyphs') };
}

// --- cmap -------------------------------------------------------------------

/**
 * Ordem de preferência de subtabela, do mais específico para o mais genérico.
 * `[platformID, encodingID]`. (3,10) é Windows UCS-4, (3,1) Windows BMP,
 * (0,*) Unicode. Um dígito ASCII está em todas elas; a ordem importa só para
 * escolher uma leitura determinística.
 */
const PREFERENCIA_CMAP = [
  [3, 10],
  [0, 4],
  [0, 6],
  [3, 1],
  [0, 3],
  [0, 2],
  [0, 1],
  [0, 0],
];

/** Localiza a melhor subtabela de `cmap` e devolve `{ offset, formato, platformID, encodingID }`. */
function escolherSubtabelaCmap(buf, tabelas) {
  const { offset: base } = exigirTabela(tabelas, 'cmap');
  const numTables = u16(buf, base + 2, 'numTables de cmap');

  const candidatas = [];
  for (let i = 0; i < numTables; i += 1) {
    const registro = base + 4 + i * 8;
    const platformID = u16(buf, registro, 'platformID');
    const encodingID = u16(buf, registro + 2, 'encodingID');
    const offset = base + u32(buf, registro + 4, 'offset da subtabela de cmap');
    candidatas.push({
      platformID,
      encodingID,
      offset,
      formato: u16(buf, offset, 'formato da subtabela de cmap'),
    });
  }
  if (candidatas.length === 0) throw new Error("a 'cmap' não tem nenhuma subtabela");

  for (const [plat, enc] of PREFERENCIA_CMAP) {
    const achada = candidatas.find(
      (c) => c.platformID === plat && c.encodingID === enc && (c.formato === 4 || c.formato === 12),
    );
    if (achada) return achada;
  }

  const suportada = candidatas.find((c) => c.formato === 4 || c.formato === 12);
  if (suportada) return suportada;

  const formatos = [...new Set(candidatas.map((c) => c.formato))].sort((a, b) => a - b);
  throw new Error(
    `nenhuma subtabela de 'cmap' em formato 4 ou 12 (encontrados: ${formatos.join(', ')}). ` +
      'Este leitor implementa só esses dois — estenda-o em vez de adivinhar o mapeamento.',
  );
}

/** cmap formato 4: segmentos com delta e, quando preciso, um array de glyphIds. */
function glifoFormato4(buf, sub, codePoint) {
  if (codePoint > 0xffff) return 0;

  const segCount = u16(buf, sub + 6, 'segCountX2') / 2;
  const fimBase = sub + 14;
  const inicioBase = fimBase + segCount * 2 + 2;
  const deltaBase = inicioBase + segCount * 2;
  const rangeOffsetBase = deltaBase + segCount * 2;

  for (let i = 0; i < segCount; i += 1) {
    const fim = u16(buf, fimBase + i * 2, 'endCode');
    if (fim < codePoint) continue;

    const inicio = u16(buf, inicioBase + i * 2, 'startCode');
    if (inicio > codePoint) return 0;

    const delta = i16(buf, deltaBase + i * 2, 'idDelta');
    const enderecoRangeOffset = rangeOffsetBase + i * 2;
    const rangeOffset = u16(buf, enderecoRangeOffset, 'idRangeOffset');

    if (rangeOffset === 0) return (codePoint + delta) & 0xffff;

    // O idRangeOffset é medido A PARTIR DA PRÓPRIA POSIÇÃO dele — é a
    // peculiaridade do formato 4, e ler como offset absoluto devolve glifo
    // errado em silêncio.
    const endereco = enderecoRangeOffset + rangeOffset + (codePoint - inicio) * 2;
    const glifo = u16(buf, endereco, 'glyphIdArray');
    return glifo === 0 ? 0 : (glifo + delta) & 0xffff;
  }
  return 0;
}

/** cmap formato 12: grupos contíguos, sem delta. */
function glifoFormato12(buf, sub, codePoint) {
  const numGroups = u32(buf, sub + 12, 'numGroups');
  for (let i = 0; i < numGroups; i += 1) {
    const grupo = sub + 16 + i * 12;
    const inicio = u32(buf, grupo, 'startCharCode');
    const fim = u32(buf, grupo + 4, 'endCharCode');
    if (codePoint < inicio) return 0;
    if (codePoint > fim) continue;
    return u32(buf, grupo + 8, 'startGlyphID') + (codePoint - inicio);
  }
  return 0;
}

/** Code point → glyphId. `0` é o `.notdef`, isto é, "a fonte não tem esse caractere". */
function glifoDoCodePoint(buf, subtabela, codePoint) {
  if (subtabela.formato === 4) return glifoFormato4(buf, subtabela.offset, codePoint);
  if (subtabela.formato === 12) return glifoFormato12(buf, subtabela.offset, codePoint);
  throw new Error(`formato de cmap não implementado: ${subtabela.formato}`);
}

// --- hmtx -------------------------------------------------------------------

/**
 * Largura de avanço do glifo, em unidades de em.
 *
 * A `hmtx` lista `numberOfHMetrics` pares (advance, lsb) e depois só
 * left-side-bearings: todo glifo a partir daí HERDA o último avanço listado.
 * Ignorar isso é o erro clássico de leitura de `hmtx` — ele faz uma fonte
 * monoespaçada parecer proporcional, e vice-versa.
 */
function advanceWidth(buf, tabelas, glyphId, numberOfHMetrics) {
  const { offset } = exigirTabela(tabelas, 'hmtx');
  if (numberOfHMetrics < 1) throw new Error("numberOfHMetrics é 0: 'hmtx' não lista nenhum avanço");
  const indice = Math.min(glyphId, numberOfHMetrics - 1);
  return u16(buf, offset + indice * 4, `advanceWidth do glifo ${glyphId}`);
}

// --- GSUB -------------------------------------------------------------------

/**
 * Tags de feature declaradas na `GSUB`. É onde vive `tnum` (tabular figures):
 * a substituição que troca os dígitos proporcionais pelos de largura fixa.
 *
 * Fonte sem `GSUB` devolve conjunto vazio — ausência de tabela não é erro de
 * leitura, é uma resposta ("não oferece feature nenhuma").
 */
function featuresGSUB(buf, tabelas) {
  const t = tabelas.get('GSUB');
  if (!t) return [];

  const listaFeatures = t.offset + u16(buf, t.offset + 6, 'featureListOffset de GSUB');
  const featureCount = u16(buf, listaFeatures, 'featureCount');

  const tags = [];
  for (let i = 0; i < featureCount; i += 1) {
    tags.push(tag(buf, listaFeatures + 2 + i * 6, `featureTag ${i}`));
  }
  // FeatureRecords se repetem por script/idioma; o conjunto é o que interessa.
  return [...new Set(tags)].sort();
}

// --- a medição --------------------------------------------------------------

const DIGITOS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Mede os dez dígitos de uma fonte e responde a única pergunta que o
 * `theme.ts` fazia: uma coluna de reais desta fonte dança?
 *
 * `larguraFixa` é a resposta. `temTnum` é a saída de emergência quando a
 * resposta é "sim, dança".
 */
function medirDigitos(buf) {
  const tabelas = lerTabelas(buf);
  const { unitsPerEm } = lerHead(buf, tabelas);
  const { numberOfHMetrics } = lerHhea(buf, tabelas);
  const { numGlyphs } = lerMaxp(buf, tabelas);
  const subtabela = escolherSubtabelaCmap(buf, tabelas);
  const features = featuresGSUB(buf, tabelas);

  const ausentes = [];
  const digitos = DIGITOS.map((caractere) => {
    const codePoint = caractere.codePointAt(0);
    const glyphId = glifoDoCodePoint(buf, subtabela, codePoint);
    if (glyphId === 0) ausentes.push(caractere);
    return {
      caractere,
      codePoint,
      glyphId,
      advanceWidth: advanceWidth(buf, tabelas, glyphId, numberOfHMetrics),
    };
  });

  if (ausentes.length > 0) {
    throw new Error(`a fonte não mapeia o(s) dígito(s) ${ausentes.join(', ')} na 'cmap'`);
  }

  const larguraDoZero = digitos[0].advanceWidth;
  for (const d of digitos) {
    d.em = d.advanceWidth / unitsPerEm;
    d.diferenca = d.advanceWidth - larguraDoZero;
    d.divergeDoZero = d.diferenca !== 0;
  }

  const larguras = digitos.map((d) => d.advanceWidth);
  return {
    unitsPerEm,
    numGlyphs,
    numberOfHMetrics,
    cmap: subtabela,
    tabelas: [...tabelas.keys()].sort(),
    features,
    temTnum: features.includes('tnum'),
    digitos,
    larguraDoZero,
    larguraFixa: digitos.every((d) => !d.divergeDoZero),
    amplitude: Math.max(...larguras) - Math.min(...larguras),
  };
}

/**
 * A tabela da medição. É ela que vai para o relatório e para o
 * `docs/design-system.md`: número medido, não frase sobre o número.
 */
function tabelaDigitos(medida) {
  const cabecalho = [
    '| Dígito | glyphId | advanceWidth | em | Diverge de "0" |',
    '|---|---|---|---|---|',
  ];
  const corpo = medida.digitos.map((d) => {
    const diverge = d.divergeDoZero ? `**sim** (${d.diferenca > 0 ? '+' : ''}${d.diferenca})` : 'não';
    return `| \`${d.caractere}\` | ${d.glyphId} | ${d.advanceWidth} | ${d.em.toFixed(4)} | ${diverge} |`;
  });
  return [...cabecalho, ...corpo].join('\n');
}

// --- o lado do tema ---------------------------------------------------------

/**
 * Lê de `src/theme/theme.ts` a família e o `fontVariant` de
 * `typography.numeric` — a escala que carrega a coluna de reais.
 *
 * Existe pela lição da ADR 0018: medição que não tem comando para quebrar é
 * medição que morre em silêncio. Só medir os TTF não daria um gate, daria uma
 * decoração — a Inter declara `tnum` e a Archivo Black já é tabular, então o
 * comando nunca reprovaria por conta própria. O que PODE regredir é o outro
 * lado: alguém remove o `fontVariant` do `numeric`, ou aponta a escala para uma
 * família que não oferece `tnum`, e a coluna volta a dançar sem nada reclamar.
 * É isso que este extrator torna verificável.
 */
function extrairTipografiaNumeric(fonte) {
  const familias = new Map();
  const blocoFamilia = /export const fontFamily = \{([\s\S]*?)\} as const;/.exec(fonte);
  if (!blocoFamilia) {
    throw new Error("não achei 'export const fontFamily = { ... } as const;'. theme.ts mudou de formato?");
  }
  for (const casa of blocoFamilia[1].matchAll(/(\w+):\s*'([^']+)'/g)) {
    familias.set(casa[1], casa[2]);
  }

  const bloco = /\bnumeric:\s*\{([^{}]*)\}/.exec(fonte);
  if (!bloco) {
    throw new Error("não achei 'numeric: { ... }' em typography. theme.ts mudou de formato?");
  }
  const corpo = bloco[1];

  const refFamilia = /fontFamily:\s*(?:fontFamily\.(\w+)|'([^']+)')/.exec(corpo);
  if (!refFamilia) throw new Error("'typography.numeric' não declara fontFamily");
  const fontFamily = refFamilia[2] ?? familias.get(refFamilia[1]);
  if (!fontFamily) {
    throw new Error(`'typography.numeric' aponta para fontFamily.${refFamilia[1]}, que não existe`);
  }

  // O valor pode ser array literal ou identificador — o `as const` da escala
  // obriga a declarar o array fora dela, então o identificador é o caso normal.
  const refVariant = /fontVariant:\s*([^,\n]+)/.exec(corpo);
  let temTabularNums = false;
  if (refVariant) {
    const rhs = refVariant[1].trim();
    if (rhs.startsWith('[')) {
      temTabularNums = rhs.includes('tabular-nums');
    } else {
      const ident = /^[A-Za-z_$][\w$]*/.exec(rhs);
      const decl = ident && new RegExp(`\\b${ident[0]}\\b[^=]*=\\s*(\\[[^\\]]*\\])`).exec(fonte);
      if (!decl) {
        throw new Error(
          `'typography.numeric' declara fontVariant: ${rhs}, e não consegui resolver esse valor. ` +
            'Aponte-o para um array literal ou para uma const declarada neste arquivo.',
        );
      }
      temTabularNums = decl[1].includes('tabular-nums');
    }
  }

  return { fontFamily, temTabularNums };
}

module.exports = {
  extrairTipografiaNumeric,
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
  DIGITOS,
};
