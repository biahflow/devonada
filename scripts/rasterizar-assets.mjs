#!/usr/bin/env node
/**
 * `npm run assets:build` — os três PNG da marca, gerados a partir dos SVG.
 *
 * A rasterização já era por Chrome headless, e já era a única opção: esta
 * máquina não tem `rsvg-convert`, ImageMagick nem `sharp`, e nenhum deles vale
 * uma dependência npm para produzir três arquivos que mudam uma vez por ano. O
 * que mudou é onde o comando mora. Ele vivia FORA do repositório, e o
 * design-system registrava isso numa linha, sem justificativa — a mesma lição
 * que a ADR 0018 já tinha cobrado do validador de paleta: passo que vive fora do
 * repo é passo que ninguém consegue repetir, e que ninguém percebe quando para
 * de valer.
 *
 * O comando faz três coisas, e a primeira é a que pode reprovar:
 *
 * 1. Confere os hex dos SVG contra os tokens de `src/theme/theme.ts`. Cor de
 *    marca escrita à mão que deixou de existir no theme derruba aqui, antes de
 *    virar PNG — foi exatamente assim que os assets anteriores ficaram para trás:
 *    teal `#029488` e violeta `#7C3AED` continuaram no arquivo depois de a paleta
 *    inteira ter virado, e nada reclamou porque não havia comando para reclamar.
 * 2. Rasteriza cada SVG a 1024×1024 pelo navegador que achar nesta máquina.
 * 3. Lê de volta o IHDR de cada PNG e confere as dimensões. Janela que não abriu
 *    no tamanho pedido devolve imagem menor sem erro nenhum.
 *
 * Uso:
 *   node scripts/rasterizar-assets.mjs             # confere e rasteriza os três
 *   node scripts/rasterizar-assets.mjs --conferir  # só a conferência de cor,
 *                                                  # sem navegador (útil onde
 *                                                  # não há Chrome instalado)
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import contraste from './contraste.js';
import marca from './marca.js';

const { extrairTokens } = contraste;
const {
  conferirCoresDaMarca,
  lerDimensoesPng,
  pngCompleto,
  localizarNavegador,
  paginaDeRasterizacao,
  argumentosDoChrome,
} = marca;

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO_TEMA = join(RAIZ, 'src', 'theme', 'theme.ts');
const ASSETS = join(RAIZ, 'assets');

/** Os três PNG que `app.json` referencia, cada um com sua fonte versionada. */
const ALVOS = [
  { svg: 'icon.svg', png: 'icon.png', papel: 'ícone do app (iOS)' },
  { svg: 'adaptive-icon.svg', png: 'adaptive-icon.png', papel: 'camada de frente do Android' },
  { svg: 'splash.svg', png: 'splash.png', papel: 'abertura nativa' },
];

/** Os 1024² da tabela do design-system, seção 6. */
const TAMANHO = 1024;

/**
 * As cores que a marca estática pode usar — lista DECLARADA, como a lista de
 * pares do `paleta-check`. `debt` e não `warning` ou `primary` porque o ícone é
 * um arquivo e o estado em que a pessoa chega é `divida`; ícone alternativo por
 * estado da rota é pós-MVP, e quando existir esta lista cresce no mesmo commit.
 */
const TOKENS_DA_MARCA = ['background', 'debt'];

const md5 = (buf) => createHash('md5').update(buf).digest('hex');

function lerSvgs() {
  return ALVOS.map(({ svg }) => {
    const caminho = join(ASSETS, svg);
    let conteudo;
    try {
      conteudo = readFileSync(caminho, 'utf8');
    } catch (erro) {
      throw new Error(`não consegui ler ${caminho}: ${erro.message}`);
    }
    return { nome: svg, svg: conteudo };
  });
}

/** A conferência de cor, e a procedência impressa em vez de afirmada. */
function conferir(arquivos, tokens) {
  const { ok, achados, problemas } = conferirCoresDaMarca(arquivos, tokens, TOKENS_DA_MARCA);

  const linhas = ['  cores, conferidas contra src/theme/theme.ts:'];
  for (const { arquivo, hex, tokens: donos } of achados) {
    const origem = donos.length > 0 ? donos.map((d) => `colors.${d}`).join(' / ') : 'SEM TOKEN';
    linhas.push(`    ${arquivo.padEnd(18)} ${hex}  ${origem}`);
  }
  for (const problema of problemas) linhas.push(`    ✗ ${problema}`);

  return { ok, linhas };
}

/** O prazo da captura. Uma página estática de um círculo leva ~2s nesta máquina. */
const PRAZO_MS = 60_000;

const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const finalDoLog = (caminho) => {
  try {
    return readFileSync(caminho, 'utf8').trim().split('\n').slice(-5).join('\n');
  } catch {
    return '(sem log)';
  }
};

/**
 * Uma captura. Devolve o PNG em memória; quem escreve em `assets/` é o main.
 *
 * O COMANDO NÃO ESPERA O NAVEGADOR ENCERRAR, e isso é medido, não preguiça:
 * recebendo `--user-data-dir` próprio, o Chrome desta máquina escreve o PNG em
 * ~2s e continua vivo indefinidamente (verificado em 45s, 60s e 120s, com a
 * captura correta em disco desde o começo). Esperar o processo morrer seria
 * esperar para sempre — o mesmo modo de falha do `npm test` daqui, que conclui a
 * suíte e não sai.
 *
 * Então o que se espera é o ARQUIVO, e o critério é o formato: o PNG termina no
 * chunk `IEND`, e enquanto ele não está lá a captura está pela metade. Com o
 * arquivo pronto, o navegador leva SIGKILL no grupo inteiro — `detached` existe
 * para o grupo existir, porque matar só o pai deixa os processos de renderização
 * do Chrome órfãos e vivos.
 */
async function rasterizar({ navegador, svg, tamanho, corDeFundo, pasta, nome }) {
  const html = join(pasta, `${nome}.html`);
  const png = join(pasta, `${nome}.png`);
  const log = join(pasta, `${nome}.log`);
  writeFileSync(html, paginaDeRasterizacao(svg, tamanho, corDeFundo));

  const args = argumentosDoChrome({
    // `pathToFileURL` e não `file://` concatenado: o diretório temporário do
    // sistema pode ter espaço ou acento no caminho, e aí a URL colada à mão
    // aponta para lugar nenhum.
    url: pathToFileURL(html).href,
    saida: png,
    tamanho,
    perfil: join(pasta, `perfil-${nome}`),
  });

  const descritor = openSync(log, 'w');
  const processo = spawn(navegador, args, {
    stdio: ['ignore', descritor, descritor],
    detached: true,
  });

  let falhaAoExecutar = null;
  processo.on('error', (erro) => {
    falhaAoExecutar = erro;
  });

  try {
    const limite = Date.now() + PRAZO_MS;
    for (;;) {
      if (falhaAoExecutar) {
        throw new Error(`não consegui executar ${navegador}: ${falhaAoExecutar.message}`);
      }
      if (existsSync(png)) {
        const buf = readFileSync(png);
        if (pngCompleto(buf)) return conferirTamanho(buf, nome, tamanho);
      }
      if (processo.exitCode !== null || processo.signalCode !== null) {
        throw new Error(
          `${navegador} encerrou (código ${processo.exitCode}) sem deixar uma captura ` +
            `completa de ${nome}.\n${finalDoLog(log)}`,
        );
      }
      if (Date.now() > limite) {
        throw new Error(
          `${navegador} não produziu a captura de ${nome} em ${PRAZO_MS / 1000}s.\n` +
            finalDoLog(log),
        );
      }
      await dormir(100);
    }
  } finally {
    try {
      process.kill(-processo.pid, 'SIGKILL');
    } catch {
      processo.kill('SIGKILL');
    }
    closeSync(descritor);
  }
}

function conferirTamanho(buf, nome, tamanho) {
  const { largura, altura } = lerDimensoesPng(buf);
  if (largura !== tamanho || altura !== tamanho) {
    throw new Error(
      `a captura de ${nome} saiu ${largura}×${altura}, e a marca é ${tamanho}×${tamanho}. ` +
        'Janela que não abriu no tamanho pedido devolve imagem menor sem reclamar.',
    );
  }
  return buf;
}

async function main(argv) {
  const soConferir = argv.includes('--conferir');

  const tokens = extrairTokens(readFileSync(CAMINHO_TEMA, 'utf8'));
  const arquivos = lerSvgs();

  const saida = [`rasterizar-assets — ${ALVOS.length} SVG versionados em assets/`, ''];
  const conferencia = conferir(arquivos, tokens);
  saida.push(...conferencia.linhas, '');

  if (!conferencia.ok) {
    saida.push('  Nada foi rasterizado: um PNG gerado de cor que não é mais da paleta é');
    saida.push('  exatamente o débito que este comando existe para fechar.');
    process.stdout.write(`${saida.join('\n')}\n`);
    return 1;
  }

  if (soConferir) {
    saida.push('  --conferir: nenhum PNG foi gerado.');
    process.stdout.write(`${saida.join('\n')}\n`);
    return 0;
  }

  const navegador = localizarNavegador({
    plataforma: process.platform,
    env: process.env,
    existe: existsSync,
  });
  saida.push(`  navegador: ${navegador}`, '');

  const corDeFundo = tokens.get('background');
  const pasta = mkdtempSync(join(tmpdir(), 'devonada-marca-'));
  try {
    for (const alvo of ALVOS) {
      const fonte = arquivos.find((a) => a.nome === alvo.svg);
      const buf = await rasterizar({
        navegador,
        svg: fonte.svg,
        tamanho: TAMANHO,
        corDeFundo,
        pasta,
        nome: alvo.png.replace(/\.png$/, ''),
      });
      writeFileSync(join(ASSETS, alvo.png), buf);
      saida.push(
        `  ✓ ${alvo.svg.padEnd(18)} → assets/${alvo.png.padEnd(18)} ` +
          `${TAMANHO}×${TAMANHO}  ${buf.length} bytes  md5 ${md5(buf)}`,
      );
      saida.push(`      ${alvo.papel}`);
    }
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }

  saida.push('');
  saida.push('  O md5 é estável entre execuções do mesmo navegador: a captura não carrega');
  saida.push('  data nem versão dentro do arquivo. Entre versões de navegador ele pode mudar');
  saida.push('  sem que a imagem mude — o que vale como prova é o pixel, não o hash.');

  process.stdout.write(`${saida.join('\n')}\n`);
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (erro) {
  process.stderr.write(`rasterizar-assets falhou: ${erro.message}\n`);
  process.exitCode = 1;
}
