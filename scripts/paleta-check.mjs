#!/usr/bin/env node
/**
 * `npm run palette:check` — o quinto gate.
 *
 * Mede os pares de cor DECLARADOS abaixo contra `src/theme/theme.ts` e sai com
 * código 1 se algum par sem exceção reprovar. A tabela que ele imprime é a que
 * vive em `docs/design-system.md`, seção 1: `node scripts/paleta-check.mjs
 * --tabela` gera, ninguém digita.
 *
 * Por que a lista é DECLARADA e não varrida: uma varredura de todas as
 * combinações mediria pares que nunca encostam um no outro na tela, e o ruído
 * transformaria o gate em algo que se aprende a ignorar. Cada linha aqui é uma
 * adjacência que existe no app — e quando uma nova aparece, ela entra aqui no
 * mesmo commit em que aparece na tela.
 *
 * Ver ADR 0018.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import contraste from './contraste.js';

const { extrairTokens, avaliarPares, tabelaMarkdown } = contraste;

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO_TEMA = join(RAIZ, 'src', 'theme', 'theme.ts');

/**
 * Os pares. `intencao` escolhe o piso:
 *
 * - `texto`   — WCAG 2.1, 4,5:1. Texto de corpo, legenda, rótulo, número em coluna.
 * - `grafico` — WCAG 2.1, 3:1. Objeto gráfico que não é texto (pill, barra, anel,
 *               ponto da marca, série) e TEXTO GRANDE, que a WCAG mede pelo mesmo
 *               piso. Nunca informa sozinho: há glifo ou rótulo ao lado.
 * - `dupla`   — CIEDE2000, ΔE 15. Duas semânticas que aparecem lado a lado e
 *               precisam ser distinguíveis uma da outra, não de um fundo.
 *
 * `excecao` NÃO isenta de medir — o número continua na tabela. Ela isenta de
 * reprovar, e o texto dela é a justificativa que fica registrada na ADR 0018.
 */
const pares = [
  // --- texto principal e secundário sobre as três superfícies ---------------
  { fg: 'ink', bg: 'background', intencao: 'texto' },
  { fg: 'ink', bg: 'surface', intencao: 'texto' },
  { fg: 'ink', bg: 'neutralSurface', intencao: 'texto', nota: 'bolha do assistente' },
  { fg: 'ink', bg: 'primarySurface', intencao: 'texto', nota: 'bolha do usuário' },
  { fg: 'inkSoft', bg: 'background', intencao: 'texto' },
  { fg: 'inkSoft', bg: 'surface', intencao: 'texto' },
  { fg: 'inkSoft', bg: 'neutralSurface', intencao: 'texto' },

  // --- verde: ação e conquista ---------------------------------------------
  { fg: 'primary', bg: 'background', intencao: 'texto', nota: 'link' },
  { fg: 'primary', bg: 'surface', intencao: 'texto', nota: 'rótulo do Button secondary' },
  { fg: 'onPrimary', bg: 'primary', intencao: 'texto', nota: 'rótulo do Button primary' },
  { fg: 'primaryDeep', bg: 'primarySurface', intencao: 'texto', nota: 'Badge primario' },
  { fg: 'accent', bg: 'background', intencao: 'texto' },
  { fg: 'accent', bg: 'surface', intencao: 'texto' },
  {
    fg: 'accent',
    bg: 'accentSurface',
    intencao: 'texto',
    nota: 'Badge progresso, Feedback success, e o ícone da conquista dentro do halo da MarcoScreen',
  },
  {
    fg: 'accent',
    bg: 'neutralSurface',
    intencao: 'grafico',
    nota:
      'preenchimento da barra do RespiroCard e do MetaCard (status atingida), sobre o trilho; ' +
      'e o respiro liberado da MarcoScreen em display — texto grande (≥26px), que a WCAG mede ' +
      'por este mesmo piso',
  },
  {
    fg: 'accentSurface',
    bg: 'background',
    intencao: 'grafico',
    excecao:
      'glow da MarcoScreen: celebração decorativa, nunca portadora de informação. Quem diz que ' +
      'houve conquista é o título em display ao lado, e no iOS o halo ainda ganha a sombra ' +
      'colorida que o Android não pinta',
  },

  // --- âmbar: negociação em andamento --------------------------------------
  { fg: 'warning', bg: 'background', intencao: 'texto' },
  { fg: 'warning', bg: 'surface', intencao: 'texto' },
  { fg: 'warning', bg: 'neutralSurface', intencao: 'texto' },
  { fg: 'warning', bg: 'warningSurface', intencao: 'texto', nota: 'Badge atencao, Feedback warning' },

  // --- vermelho como TEXTO -------------------------------------------------
  // `debt`/`danger` reprovam aqui; é por isso que existem `debtText`/`dangerText`.
  { fg: 'debtText', bg: 'background', intencao: 'texto', nota: 'saldo devedor em body/numeric' },
  { fg: 'debtText', bg: 'surface', intencao: 'grafico', nota: 'o quadrado da aba ativa, sobre a barra — fase de dívida' },
  { fg: 'debtText', bg: 'neutralSurface', intencao: 'texto', nota: 'valor em área recuada' },
  { fg: 'ink', bg: 'surface', intencao: 'texto', nota: 'rótulo da aba ativa, sobre a barra' },
  { fg: 'dangerText', bg: 'background', intencao: 'texto', nota: 'erro do chat' },
  { fg: 'dangerText', bg: 'surface', intencao: 'texto', nota: 'caption de erro de campo, rótulo do Button danger' },
  { fg: 'dangerText', bg: 'dangerSurface', intencao: 'texto', nota: 'Feedback error, Badge alto' },

  // --- vermelho como OBJETO GRÁFICO ----------------------------------------
  // O hex da marca. Não muda: é o ponto do wordmark (ADR 0015).
  {
    fg: 'debt',
    bg: 'background',
    intencao: 'grafico',
    nota: 'ponto do wordmark, halo da splash, e o saldo devedor em display/displaySm — texto grande (≥26px), que a WCAG mede por este mesmo piso',
  },
  { fg: 'debt', bg: 'surface', intencao: 'grafico', nota: 'ponto do wordmark na topbar de toda aba; saldo devedor grande dentro de card' },
  { fg: 'debt', bg: 'neutralSurface', intencao: 'grafico', nota: 'barra e borda de estado de erro' },
  { fg: 'primary', bg: 'surface', intencao: 'grafico', nota: 'o quadrado da aba ativa, sobre a barra — fase verde' },

  // --- marca de gráfico e anéis de categoria -------------------------------
  { fg: 'primaryBright', bg: 'background', intencao: 'grafico', nota: 'LinhaEvolucao' },
  { fg: 'primaryBright', bg: 'surface', intencao: 'grafico', nota: 'barra do Meter' },
  { fg: 'teal', bg: 'background', intencao: 'grafico', nota: 'anel do CategoriaIcon' },
  { fg: 'teal', bg: 'surface', intencao: 'grafico' },
  { fg: 'azul', bg: 'background', intencao: 'grafico' },
  { fg: 'azul', bg: 'surface', intencao: 'grafico' },
  { fg: 'magenta', bg: 'background', intencao: 'grafico' },
  { fg: 'magenta', bg: 'surface', intencao: 'grafico' },
  { fg: 'ambar', bg: 'background', intencao: 'grafico' },
  { fg: 'ambar', bg: 'surface', intencao: 'grafico' },

  // --- bordas ---------------------------------------------------------------
  // Divisor de 1px. Ele separa, não informa: nenhuma frase, número ou estado
  // depende de alguém enxergá-lo. A hierarquia real é a COR DA SUPERFÍCIE
  // (background → surface → neutralSurface), medida acima; a linha é reforço.
  {
    fg: 'border',
    bg: 'background',
    intencao: 'grafico',
    excecao: 'divisor decorativo, nunca portador de informação',
  },
  {
    fg: 'border',
    bg: 'surface',
    intencao: 'grafico',
    excecao: 'divisor decorativo, nunca portador de informação',
  },
  {
    fg: 'warningBorder',
    bg: 'warningSurface',
    intencao: 'grafico',
    excecao: 'contorno de banner; quem carrega o sentido é o texto dentro dele',
  },
  {
    fg: 'dangerBorder',
    bg: 'dangerSurface',
    intencao: 'grafico',
    excecao: 'contorno de banner; quem carrega o sentido é o texto dentro dele',
  },
  {
    fg: 'debtBorder',
    bg: 'surface',
    intencao: 'grafico',
    excecao: 'contorno do card de dívida crítica; o Badge ao lado nomeia a criticidade',
  },

  // --- duplas semânticas ----------------------------------------------------
  // Os três estados do ponto do wordmark. Se dois deles se confundem, a marca
  // para de contar a história do usuário — é a medição mais crítica da lista.
  { fg: 'debt', bg: 'warning', intencao: 'dupla', nota: 'ponto: dívida × negociando' },
  { fg: 'warning', bg: 'primary', intencao: 'dupla', nota: 'ponto: negociando × devo nada' },
  { fg: 'debt', bg: 'primary', intencao: 'dupla', nota: 'ponto: dívida × devo nada' },
  {
    fg: 'primary',
    bg: 'accent',
    intencao: 'dupla',
    // `accent` e `primaryBright` são o mesmo hex, então esta linha responde às
    // duas perguntas de uma vez: conquista × ação, e texto do Meter × barra do
    // Meter (design-system, seção 4b).
    nota: 'conquista × ação; e o texto do Meter × a barra do Meter',
    excecao:
      'proximidade é o desenho — a conquista é o MESMO verde um passo mais claro, ' +
      'e os dois nunca precisam ser distinguidos um do outro: onde aparecem juntos ' +
      'há rótulo, e onde há só um a semântica vem do lugar, não do matiz',
  },
  // Os quatro anéis de categoria entre si. Foi esta medição, na paleta clara,
  // que derrubou coral e violeta e deixou o conjunto com quatro matizes.
  { fg: 'teal', bg: 'azul', intencao: 'dupla' },
  { fg: 'teal', bg: 'magenta', intencao: 'dupla' },
  { fg: 'teal', bg: 'ambar', intencao: 'dupla' },
  { fg: 'azul', bg: 'magenta', intencao: 'dupla' },
  { fg: 'azul', bg: 'ambar', intencao: 'dupla' },
  { fg: 'magenta', bg: 'ambar', intencao: 'dupla' },
];

const TITULOS = {
  texto: '**Texto** — WCAG 2.1, piso 4,5:1',
  grafico: '**Objeto gráfico e texto grande** — WCAG 2.1, piso 3:1',
  dupla: '**Duplas semânticas** — CIEDE2000, piso ΔE 15',
};

function main(argv) {
  const soTabela = argv.includes('--tabela');

  const fonte = readFileSync(CAMINHO_TEMA, 'utf8');
  const tokens = extrairTokens(fonte);
  if (tokens.size === 0) {
    throw new Error(
      `nenhum token '#RRGGBB' encontrado em ${CAMINHO_TEMA}. O arquivo mudou de formato?`,
    );
  }

  const linhas = avaliarPares(pares, tokens);
  const reprovados = linhas.filter((l) => l.reprovado);
  const excecoes = linhas.filter((l) => !l.passou && l.excecao);

  const blocos = [];
  for (const intencao of ['texto', 'grafico', 'dupla']) {
    const doTipo = linhas.filter((l) => l.intencao === intencao);
    if (doTipo.length === 0) continue;
    blocos.push(`${TITULOS[intencao]}\n\n${tabelaMarkdown(doTipo)}`);
  }

  const tabela = blocos.join('\n\n');

  if (soTabela) {
    process.stdout.write(`${tabela}\n`);
    return reprovados.length === 0 ? 0 : 1;
  }

  const resumo = [
    `paleta-check — ${linhas.length} pares declarados, lidos de src/theme/theme.ts`,
    `  passam: ${linhas.filter((l) => l.passou).length}`,
    `  exceções declaradas: ${excecoes.length}`,
    `  REPROVAM: ${reprovados.length}`,
    '',
  ];
  for (const l of reprovados) {
    resumo.push(
      `  ✗ ${l.fg} (${l.hexFg}) × ${l.bg} (${l.hexBg}): ` +
        `${l.medidaFormatada}, piso ${l.pisoFormatado}`,
    );
  }
  if (reprovados.length > 0) resumo.push('');

  process.stdout.write(`${resumo.join('\n')}${tabela}\n`);
  return reprovados.length === 0 ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (erro) {
  process.stderr.write(`paleta-check falhou: ${erro.message}\n`);
  process.exitCode = 1;
}
