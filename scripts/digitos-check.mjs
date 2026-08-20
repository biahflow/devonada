#!/usr/bin/env node
/**
 * `npm run digits:check` — o sexto gate.
 *
 * Responde por MEDIÇÃO a pergunta que o `theme.ts` vinha adiando como "item de
 * validação em aparelho": os dígitos das fontes deste app são de largura fixa?
 * Não era item de aparelho. A largura de avanço de um glifo está gravada na
 * tabela `hmtx` do TTF — é fato do arquivo, e um device não tem o que opinar
 * sobre ele. O que só o aparelho responde é outra coisa (se a família carregou,
 * se o texto coube, se dá para ler no sol), e continua pendente.
 *
 * O gate tem DOIS lados, e é o segundo que o faz poder reprovar:
 *
 * 1. Mede as quatro fontes que `app/_layout.tsx` carrega e imprime a tabela.
 *    Sozinho isto nunca reprovaria — a Inter declara `tnum` e a Archivo Black
 *    já é tabular —, e gate que não pode falhar é decoração.
 * 2. Confere o `typography.numeric` de `src/theme/theme.ts` contra a medição:
 *    se a escala da coluna de reais usa uma fonte de dígitos proporcionais e
 *    NÃO pede `tabular-nums`, reprova. É a regressão que de fato pode
 *    acontecer — remover o `fontVariant`, ou apontar a escala para uma família
 *    sem `tnum` — e é exatamente o tipo de coisa que morreu em silêncio na ADR
 *    0010 por não ter comando que quebrasse (ver ADR 0018).
 *
 * Node puro, zero dependência nova: `fontkit` e `opentype.js` resolveriam o
 * parsing, e uma medição que existe para não confiar em suposição não deveria
 * estrear puxando árvore de dependências. Mesmo argumento do gate de paleta.
 *
 * Uso:
 *   node scripts/digitos-check.mjs                  # as quatro fontes do app
 *   node scripts/digitos-check.mjs caminho/x.ttf    # uma fonte qualquer
 *   node scripts/digitos-check.mjs --tabela         # só as tabelas, para o doc
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import fonte from './fonte.js';

const { medirDigitos, tabelaDigitos, extrairTipografiaNumeric } = fonte;

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO_TEMA = join(RAIZ, 'src', 'theme', 'theme.ts');

/**
 * As quatro famílias que `app/_layout.tsx` passa para `useFonts`. Os pesos que
 * hoje não carregam coluna entram junto de propósito: se `numeric` um dia mudar
 * de peso, a medição já existe e a decisão não recomeça do zero.
 */
const FONTES_DO_APP = [
  ['Inter_400Regular', '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'],
  ['Inter_600SemiBold', '@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'],
  ['Inter_700Bold', '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'],
  [
    'ArchivoBlack_400Regular',
    '@expo-google-fonts/archivo-black/400Regular/ArchivoBlack_400Regular.ttf',
  ],
].map(([nome, relativo]) => ({ nome, caminho: join(RAIZ, 'node_modules', relativo) }));

function medirArquivo(nome, caminho) {
  let buf;
  try {
    buf = readFileSync(caminho);
  } catch (erro) {
    throw new Error(
      `não consegui ler a fonte '${nome}' em ${caminho}: ${erro.message}. ` +
        'Rodou `npm install`?',
    );
  }
  return { nome, caminho, medida: medirDigitos(buf) };
}

/** Uma frase por fonte, com o número que a sustenta. */
function veredito({ nome, medida }) {
  if (medida.larguraFixa) {
    return `${nome}: TABULAR por padrão — os dez dígitos avançam ${medida.larguraDoZero} de ${medida.unitsPerEm}.`;
  }
  const emAmplitude = (medida.amplitude / medida.unitsPerEm).toFixed(3);
  const correcao = medida.temTnum
    ? "declara `tnum` na GSUB, então `fontVariant: ['tabular-nums']` corrige"
    : 'e NÃO declara `tnum`: não há como corrigir sem trocar de família';
  return `${nome}: PROPORCIONAL — amplitude de ${medida.amplitude} de ${medida.unitsPerEm} (${emAmplitude} em); ${correcao}.`;
}

/**
 * O segundo lado do gate. A escala da coluna de reais precisa fechar com o que
 * a fonte dela realmente faz.
 */
function conferirTema(medidas) {
  const numeric = extrairTipografiaNumeric(readFileSync(CAMINHO_TEMA, 'utf8'));
  const daEscala = medidas.find((m) => m.nome === numeric.fontFamily);

  if (!daEscala) {
    return {
      ok: false,
      linhas: [
        `✗ typography.numeric usa '${numeric.fontFamily}', que este comando não mede.`,
        '  Acrescente a família em FONTES_DO_APP — escala de coluna sem medição é o débito de novo.',
      ],
    };
  }

  const { medida } = daEscala;
  if (medida.larguraFixa) {
    return {
      ok: true,
      linhas: [
        `✓ typography.numeric usa ${numeric.fontFamily}, que já é tabular. Nada a pedir.`,
      ],
    };
  }
  if (numeric.temTabularNums) {
    return {
      ok: true,
      linhas: [
        `✓ typography.numeric usa ${numeric.fontFamily} (proporcional) e pede 'tabular-nums';` +
          ` a família declara 'tnum'.`,
      ],
    };
  }
  return {
    ok: false,
    linhas: [
      `✗ typography.numeric usa ${numeric.fontFamily}, cujos dígitos divergem em até ` +
        `${medida.amplitude} de ${medida.unitsPerEm}, e NÃO pede 'tabular-nums'.`,
      medida.temTnum
        ? "  A família declara 'tnum': acrescente fontVariant: ['tabular-nums'] em src/theme/theme.ts."
        : `  A família não declara 'tnum'. Trocar de família é decisão de marca, não de implementação.`,
    ],
  };
}

function main(argv) {
  const soTabela = argv.includes('--tabela');
  const caminhos = argv.filter((a) => !a.startsWith('--'));

  const alvos =
    caminhos.length > 0
      ? caminhos.map((c) => ({ nome: basename(c), caminho: c }))
      : FONTES_DO_APP;

  const medidas = alvos.map(({ nome, caminho }) => medirArquivo(nome, caminho));

  const tabelas = medidas
    .map(({ nome, medida }) => `**${nome}** — ${medida.unitsPerEm} unidades por em\n\n${tabelaDigitos(medida)}`)
    .join('\n\n');

  if (soTabela) {
    process.stdout.write(`${tabelas}\n`);
    return 0;
  }

  const saida = [`digitos-check — ${medidas.length} fonte(s) lidas da tabela hmtx do TTF`, ''];
  for (const m of medidas) saida.push(`  ${veredito(m)}`);
  saida.push('');

  // Divergência COM `tnum` avisa e não reprova: a correção existe, e é o outro
  // lado do gate que confere se ela foi aplicada onde importa. Sem `tnum` não
  // há correção possível em código, e aí reprova.
  const semCorrecao = medidas.filter((m) => !m.medida.larguraFixa && !m.medida.temTnum);
  for (const m of semCorrecao) {
    saida.push(`  ✗ ${m.nome} é proporcional e não declara 'tnum': dígito dela dança e não há`);
    saida.push('    feature que conserte. Qualquer coluna de números nessa família é ilusão.');
  }
  const comCorrecao = medidas.filter((m) => !m.medida.larguraFixa && m.medida.temTnum);
  for (const m of comCorrecao) {
    saida.push(`  ! ${m.nome} só fica tabular sob pedido: quem usa essa família numa coluna`);
    saida.push("    precisa declarar fontVariant: ['tabular-nums'].");
  }
  if (semCorrecao.length + comCorrecao.length > 0) saida.push('');

  // Só confere o tema quando mede o conjunto do app; com fonte avulsa por
  // argumento, a pergunta é sobre aquele arquivo, não sobre a escala.
  let temaOk = true;
  if (caminhos.length === 0) {
    const tema = conferirTema(medidas);
    temaOk = tema.ok;
    saida.push('  src/theme/theme.ts:');
    for (const l of tema.linhas) saida.push(`  ${l}`);
    saida.push('');
  }

  process.stdout.write(`${saida.join('\n')}${tabelas}\n`);

  return semCorrecao.length > 0 || !temaOk ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (erro) {
  process.stderr.write(`digitos-check falhou: ${erro.message}\n`);
  process.exitCode = 1;
}
