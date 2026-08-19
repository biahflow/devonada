/**
 * Medição de contraste do design system — a matemática e a tabela que ela produz.
 *
 * Vive DENTRO do repositório de propósito. A ADR 0010 deixou o validador fora, e
 * o resultado foi que virar o tema de claro para escuro apagou três tabelas de
 * medição sem nada reclamar: ferramenta fora do repo é medição que envelhece em
 * silêncio. Ver ADR 0018.
 *
 * CommonJS, sem dependência, sem I/O. Assim `scripts/paleta-check.mjs` a importa
 * como ferramenta de linha de comando e `scripts/contraste.test.js` a exercita
 * sob o jest — as duas coisas leem a MESMA implementação, que é a única forma de
 * o teste provar alguma coisa sobre o que o gate mede.
 *
 * Fórmulas:
 * - WCAG 2.1, "relative luminance" e "contrast ratio"
 *   (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)
 * - CIEDE2000, Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference
 *   Formula: Implementation Notes, Supplementary Test Data, and Mathematical
 *   Observations" — inclusive o termo de rotação R_T e os pesos S_L/S_C/S_H.
 */

// --- sRGB -------------------------------------------------------------------

/** `#RRGGBB` → `[r, g, b]` em 0–255. Lança em qualquer outro formato. */
function hexParaRgb(hex) {
  const casa = /^#([0-9a-fA-F]{6})$/.exec(String(hex).trim());
  if (!casa) throw new Error(`hex inválido: ${JSON.stringify(hex)} (esperado #RRGGBB)`);
  const n = parseInt(casa[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Canal 0–255 → linear 0–1. O limiar 0.03928 e o expoente 2.4 são da WCAG 2.1. */
function canalLinear(valor) {
  const c = valor / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminância relativa WCAG 2.1. Preto = 0, branco = 1. */
function luminanciaRelativa(hex) {
  const [r, g, b] = hexParaRgb(hex).map(canalLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Razão de contraste WCAG 2.1. Simétrica: a ordem das cores não importa.
 * Preto sobre branco = 21. Cor sobre ela mesma = 1.
 */
function contrasteWCAG(hexA, hexB) {
  const a = luminanciaRelativa(hexA);
  const b = luminanciaRelativa(hexB);
  const claro = Math.max(a, b);
  const escuro = Math.min(a, b);
  return (claro + 0.05) / (escuro + 0.05);
}

// --- CIELAB -----------------------------------------------------------------

/** D65, o mesmo iluminante do sRGB. */
const BRANCO_D65 = [0.95047, 1.0, 1.08883];

function fLab(t) {
  const delta = 6 / 29;
  return t > delta * delta * delta ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;
}

/** `#RRGGBB` → `[L, a, b]` (CIELAB, D65). */
function hexParaLab(hex) {
  const [r, g, b] = hexParaRgb(hex).map(canalLinear);

  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;

  const fx = fLab(x / BRANCO_D65[0]);
  const fy = fLab(y / BRANCO_D65[1]);
  const fz = fLab(z / BRANCO_D65[2]);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (graus) => (graus * Math.PI) / 180;

/** atan2 em graus, normalizado para [0, 360). */
function anguloEmGraus(y, x) {
  if (y === 0 && x === 0) return 0;
  const g = (Math.atan2(y, x) * 180) / Math.PI;
  return g >= 0 ? g : g + 360;
}

/**
 * CIEDE2000 entre duas cores CIELAB, com kL = kC = kH = 1.
 *
 * Recebe Lab (e não hex) porque é assim que os dados de referência de Sharma
 * são publicados — o teste consegue exercitar a fórmula sem passar por sRGB.
 */
function deltaE2000Lab(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1ab = Math.sqrt(a1 * a1 + b1 * b1);
  const C2ab = Math.sqrt(a2 * a2 + b2 * b2);
  const CabMedio = (C1ab + C2ab) / 2;
  const cab7 = Math.pow(CabMedio, 7);
  const G = 0.5 * (1 - Math.sqrt(cab7 / (cab7 + Math.pow(25, 7))));

  const a1l = (1 + G) * a1;
  const a2l = (1 + G) * a2;
  const C1l = Math.sqrt(a1l * a1l + b1 * b1);
  const C2l = Math.sqrt(a2l * a2l + b2 * b2);
  const h1l = C1l === 0 ? 0 : anguloEmGraus(b1, a1l);
  const h2l = C2l === 0 ? 0 : anguloEmGraus(b2, a2l);

  const dL = L2 - L1;
  const dC = C2l - C1l;

  let dh;
  if (C1l * C2l === 0) dh = 0;
  else {
    dh = h2l - h1l;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(C1l * C2l) * Math.sin(rad(dh) / 2);

  const Lmedio = (L1 + L2) / 2;
  const Cmedio = (C1l + C2l) / 2;

  let hMedio;
  if (C1l * C2l === 0) hMedio = h1l + h2l;
  else if (Math.abs(h1l - h2l) <= 180) hMedio = (h1l + h2l) / 2;
  else if (h1l + h2l < 360) hMedio = (h1l + h2l + 360) / 2;
  else hMedio = (h1l + h2l - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(rad(hMedio - 30)) +
    0.24 * Math.cos(rad(2 * hMedio)) +
    0.32 * Math.cos(rad(3 * hMedio + 6)) -
    0.2 * Math.cos(rad(4 * hMedio - 63));

  const dTheta = 30 * Math.exp(-Math.pow((hMedio - 275) / 25, 2));
  const cm7 = Math.pow(Cmedio, 7);
  const RC = 2 * Math.sqrt(cm7 / (cm7 + Math.pow(25, 7)));
  const RT = -Math.sin(rad(2 * dTheta)) * RC;

  const SL = 1 + (0.015 * Math.pow(Lmedio - 50, 2)) / Math.sqrt(20 + Math.pow(Lmedio - 50, 2));
  const SC = 1 + 0.045 * Cmedio;
  const SH = 1 + 0.015 * Cmedio * T;

  const tL = dL / SL;
  const tC = dC / SC;
  const tH = dH / SH;

  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}

/** CIEDE2000 entre dois `#RRGGBB`. */
function deltaE2000(hexA, hexB) {
  return deltaE2000Lab(hexParaLab(hexA), hexParaLab(hexB));
}

// --- Leitura dos tokens -----------------------------------------------------

/**
 * Extrai `nome → #RRGGBB` do TEXTO de `src/theme/theme.ts`.
 *
 * Por que texto e não import: o arquivo é TypeScript e o node não o executa sem
 * transpilador. A alternativa seria adicionar dependência a um gate cuja razão
 * de existir é não depender de nada — ver ADR 0018. O custo é que o parser só
 * enxerga literal hex declarado como `nome: '#RRGGBB'`, que é exatamente a forma
 * que a regra de "zero hex fora do theme" já obriga.
 */
function extrairTokens(texto) {
  const tokens = new Map();
  const padrao = /(^|[\s{,])([A-Za-z][A-Za-z0-9_]*)\s*:\s*'(#[0-9a-fA-F]{6})'/g;
  let casa;
  while ((casa = padrao.exec(texto)) !== null) {
    tokens.set(casa[2], casa[3]);
  }
  return tokens;
}

// --- Avaliação --------------------------------------------------------------

/** Piso de cada intenção. `dupla` é ΔE CIEDE2000; as outras, razão WCAG. */
const PISOS = { texto: 4.5, grafico: 3, dupla: 15 };

const numeroBR = (valor, casas) => valor.toFixed(casas).replace('.', ',');

/**
 * Mede um par declarado. Lança com mensagem clara quando um token citado no par
 * não existe no theme — token renomeado tem de derrubar o gate, não sumir da
 * tabela em silêncio.
 */
function avaliarPar(par, tokens) {
  const piso = PISOS[par.intencao];
  if (piso === undefined) {
    throw new Error(
      `par ${par.fg} × ${par.bg}: intenção desconhecida ${JSON.stringify(par.intencao)} ` +
        `(esperado ${Object.keys(PISOS).join(', ')})`,
    );
  }

  for (const nome of [par.fg, par.bg]) {
    if (!tokens.has(nome)) {
      throw new Error(
        `token '${nome}' está declarado no par '${par.fg} × ${par.bg}' de ` +
          `scripts/paleta-check.mjs, mas não existe em src/theme/theme.ts. ` +
          `Renomeou ou removeu o token? Atualize a lista de pares no mesmo commit.`,
      );
    }
  }

  const hexFg = tokens.get(par.fg);
  const hexBg = tokens.get(par.bg);
  const medida =
    par.intencao === 'dupla' ? deltaE2000(hexFg, hexBg) : contrasteWCAG(hexFg, hexBg);
  const passou = medida >= piso;

  return {
    ...par,
    hexFg,
    hexBg,
    piso,
    medida,
    passou,
    // Exceção não isenta de medir: ela isenta de REPROVAR. O número continua na
    // tabela, e é ele que permite discutir a exceção depois.
    reprovado: !passou && !par.excecao,
    medidaFormatada:
      par.intencao === 'dupla' ? `ΔE ${numeroBR(medida, 1)}` : `${numeroBR(medida, 2)}:1`,
    pisoFormatado: par.intencao === 'dupla' ? `ΔE ${piso}` : `${numeroBR(piso, 1)}:1`,
  };
}

/** Mede a lista inteira. Erro de token vira erro da chamada, não linha faltando. */
function avaliarPares(pares, tokens) {
  return pares.map((par) => avaliarPar(par, tokens));
}

const escaparPipe = (texto) => String(texto).replace(/\|/g, '\\|');

/** Uma tabela Markdown por intenção, pronta para colar no design-system. */
function tabelaMarkdown(linhas) {
  const dupla = linhas.length > 0 && linhas[0].intencao === 'dupla';
  const colunaA = dupla ? 'Par' : 'Frente';
  const colunaB = dupla ? '' : 'Fundo';

  const cabecalho = dupla
    ? `| ${colunaA} | ΔE | Piso | Resultado |\n|---|---|---|---|`
    : `| ${colunaA} | ${colunaB} | Contraste | Piso | Resultado |\n|---|---|---|---|---|`;

  const corpo = linhas.map((l) => {
    const resultado = l.passou
      ? 'passa'
      : l.excecao
        ? `**exceção** — ${escaparPipe(l.excecao)}`
        : '**REPROVA**';
    const frente = `\`${l.fg}\` \`${l.hexFg}\``;
    const fundo = `\`${l.bg}\` \`${l.hexBg}\``;
    const nota = l.nota ? ` <br><sub>${escaparPipe(l.nota)}</sub>` : '';
    return dupla
      ? `| ${frente} × ${fundo}${nota} | ${l.medidaFormatada} | ${l.pisoFormatado} | ${resultado} |`
      : `| ${frente} | ${fundo}${nota} | ${l.medidaFormatada} | ${l.pisoFormatado} | ${resultado} |`;
  });

  return [cabecalho, ...corpo].join('\n');
}

module.exports = {
  hexParaRgb,
  luminanciaRelativa,
  contrasteWCAG,
  hexParaLab,
  deltaE2000Lab,
  deltaE2000,
  extrairTokens,
  avaliarPar,
  avaliarPares,
  tabelaMarkdown,
  PISOS,
};
