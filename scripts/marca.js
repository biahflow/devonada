/**
 * A marca em arquivo — leitura de SVG, localização de navegador e leitura de PNG.
 *
 * Vive DENTRO do repositório pelo mesmo motivo de `contraste.js` e `fonte.js`: a
 * rasterização dos três PNG da marca acontecia por um script que morava fora
 * daqui, e ferramenta fora do repo é passo que ninguém consegue repetir — e que
 * envelhece em silêncio quando a paleta vira (ADR 0018). O SVG já era versionado;
 * o que faltava era o comando que o transforma em PNG.
 *
 * CommonJS, sem dependência, sem I/O. Assim `scripts/rasterizar-assets.mjs` a
 * importa como ferramenta de linha de comando e `scripts/marca.test.js` a
 * exercita sob o jest — as duas leem a MESMA implementação, que é a única forma
 * de o teste provar alguma coisa sobre o que o comando faz.
 *
 * O que é I/O (ler arquivo, chamar o Chrome, escrever PNG) fica no `.mjs`. O que
 * dá para errar em silêncio — um hex que deixou de corresponder ao token, um
 * PNG que saiu com 512px, um caminho de navegador cravado numa máquina só — está
 * aqui, com teste.
 */

// --- SVG: as cores que ele de fato usa --------------------------------------

/**
 * Todo `#RRGGBB` que o SVG usa, em maiúsculas e sem repetição, na ordem em que
 * aparecem.
 *
 * COMENTÁRIO NÃO CONTA. Os SVG da marca citam o hex ao lado do nome do token
 * justamente para quem lê o arquivo saber de onde a cor veio, e contar essas
 * citações como uso faria a conferência aprovar um arquivo que documenta uma cor
 * e desenha outra.
 *
 * Abreviação de três dígitos lança em vez de ser expandida: `#E32` e `#EE3322`
 * são a mesma cor para o navegador e strings diferentes para qualquer
 * comparação com o theme, e um formato só é mais barato que a conversão.
 */
function extrairCoresDoSvg(svg) {
  const semComentario = String(svg).replace(/<!--[\s\S]*?-->/g, '');
  const cores = [];
  const padrao = /#([0-9a-fA-F]+)/g;
  let casa;
  while ((casa = padrao.exec(semComentario)) !== null) {
    const digitos = casa[1];
    if (digitos.length !== 6) {
      throw new Error(
        `cor em formato inesperado: '#${digitos}' (esperado #RRGGBB). ` +
          'Os SVG da marca usam seis dígitos para poderem ser comparados com os tokens do theme.',
      );
    }
    const hex = `#${digitos.toUpperCase()}`;
    if (!cores.includes(hex)) cores.push(hex);
  }
  return cores;
}

/**
 * Confere os SVG da marca contra os tokens de `src/theme/theme.ts`.
 *
 * `nomesPermitidos` é uma lista DECLARADA, pela mesma razão da lista de pares do
 * `paleta-check`: a marca estática usa duas cores — o grafite e o ponto vermelho
 * —, e uma conferência que aceitasse qualquer token do theme aprovaria em
 * silêncio um ícone pintado de âmbar. Quando o ícone alternativo por estado
 * existir (pós-MVP), a lista cresce aqui, no mesmo commit.
 *
 * Devolve um achado por cor encontrada, com o nome do token de onde ela vem.
 * Isso é o que permite ao comando IMPRIMIR a procedência em vez de afirmá-la.
 *
 * @param arquivos [{ nome, svg }]
 * @param tokens   Map<nome, '#RRGGBB'> — a saída de `contraste.extrairTokens`
 * @param nomesPermitidos string[] — nomes de token que a marca pode usar
 */
function conferirCoresDaMarca(arquivos, tokens, nomesPermitidos) {
  const permitidos = nomesPermitidos.map((nome) => {
    const hex = tokens.get(nome);
    if (hex === undefined) {
      throw new Error(
        `o token '${nome}' não existe em src/theme/theme.ts. ` +
          'Token renomeado tem de derrubar o comando, não sumir da conferência.',
      );
    }
    return { nome, hex: hex.toUpperCase() };
  });

  const achados = [];
  const problemas = [];

  for (const { nome, svg } of arquivos) {
    for (const hex of extrairCoresDoSvg(svg)) {
      const donos = permitidos.filter((p) => p.hex === hex).map((p) => p.nome);
      achados.push({ arquivo: nome, hex, tokens: donos });
      if (donos.length === 0) {
        problemas.push(
          `${nome}: ${hex} não é nenhum dos tokens permitidos da marca ` +
            `(${permitidos.map((p) => `${p.nome} ${p.hex}`).join(', ')}).`,
        );
      }
    }
  }

  return { ok: problemas.length === 0, achados, problemas };
}

// --- PNG: o que saiu do navegador -------------------------------------------

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Largura e altura lidas do IHDR — os 8 bytes de assinatura, o tamanho do chunk,
 * o rótulo `IHDR`, e então dois inteiros de 32 bits big-endian.
 *
 * Existe porque a alternativa é confiar: o Chrome recorta a captura pela janela,
 * e uma janela que não abriu no tamanho pedido devolve um PNG menor sem erro
 * nenhum. Um ícone de 1024 que virou 800 passa despercebido no olho e quebra na
 * loja.
 */
function lerDimensoesPng(buf) {
  if (buf.length < 24) {
    throw new Error(`arquivo curto demais para ser PNG: ${buf.length} bytes`);
  }
  for (let i = 0; i < ASSINATURA_PNG.length; i += 1) {
    if (buf[i] !== ASSINATURA_PNG[i]) {
      throw new Error('arquivo não é PNG: a assinatura de 8 bytes não confere');
    }
  }
  const rotulo = buf.toString('ascii', 12, 16);
  if (rotulo !== 'IHDR') {
    throw new Error(`PNG malformado: o primeiro chunk é '${rotulo}', esperado 'IHDR'`);
  }
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
}

/**
 * O arquivo terminou de ser escrito?
 *
 * Todo PNG acaba no chunk `IEND` — quatro bytes de tamanho zero, o rótulo, e o
 * CRC. Enquanto ele não está lá, o que existe em disco é uma captura pela
 * metade.
 *
 * É por isso que este predicado existe: a captura é lida enquanto o navegador
 * ainda está vivo (ver `rasterizar-assets.mjs`), então "o arquivo apareceu" não
 * é o mesmo que "o arquivo está pronto". Comparar tamanho entre duas leituras
 * adivinharia; o rótulo do fim do formato responde.
 */
function pngCompleto(buf) {
  return buf.length >= 20 && buf.toString('ascii', buf.length - 8, buf.length - 4) === 'IEND';
}

// --- Navegador: achar o Chrome sem cravar caminho ---------------------------

/**
 * Onde procurar, na ordem. `CHROME_PATH` vem primeiro porque é a saída de quem
 * tem o binário em lugar que esta lista não prevê — e é o que impede a lista de
 * virar a razão pela qual o comando não roda numa máquina.
 *
 * Nome sem barra é procurado no PATH; caminho absoluto é testado direto.
 */
function candidatosDeNavegador(plataforma, env = {}) {
  const daPessoa = env.CHROME_PATH ? [env.CHROME_PATH] : [];

  if (plataforma === 'darwin') {
    const casa = env.HOME ? [`${env.HOME}/Applications`] : [];
    const pastas = ['/Applications', ...casa];
    const apps = [
      ['Google Chrome.app', 'Google Chrome'],
      ['Google Chrome Canary.app', 'Google Chrome Canary'],
      ['Chromium.app', 'Chromium'],
      ['Brave Browser.app', 'Brave Browser'],
      ['Microsoft Edge.app', 'Microsoft Edge'],
    ];
    const emPasta = pastas.flatMap((pasta) =>
      apps.map(([app, binario]) => `${pasta}/${app}/Contents/MacOS/${binario}`),
    );
    return [...daPessoa, ...emPasta];
  }

  if (plataforma === 'win32') {
    const bases = [
      env['PROGRAMFILES'],
      env['PROGRAMFILES(X86)'],
      env['LOCALAPPDATA'],
    ].filter(Boolean);
    const relativos = [
      'Google\\Chrome\\Application\\chrome.exe',
      'Chromium\\Application\\chrome.exe',
      'Microsoft\\Edge\\Application\\msedge.exe',
    ];
    return [
      ...daPessoa,
      ...bases.flatMap((base) => relativos.map((rel) => `${base}\\${rel}`)),
    ];
  }

  return [
    ...daPessoa,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];
}

/** Absoluto em POSIX (`/x`) ou em Windows (`C:\x`, `\\servidor\x`). */
function ehCaminhoAbsoluto(caminho) {
  return /^([/\\]|[A-Za-z]:[/\\])/.test(caminho);
}

/** O primeiro diretório do PATH que contém `nome`, ou `null`. */
function resolverNoPath(nome, pathEnv, plataforma, existe) {
  if (!pathEnv) return null;
  const separador = plataforma === 'win32' ? ';' : ':';
  const barra = plataforma === 'win32' ? '\\' : '/';
  for (const dir of pathEnv.split(separador)) {
    if (!dir) continue;
    const completo = dir.endsWith(barra) ? `${dir}${nome}` : `${dir}${barra}${nome}`;
    if (existe(completo)) return completo;
  }
  return null;
}

/**
 * O caminho do primeiro navegador que existe nesta máquina.
 *
 * Lança com a lista inteira do que foi procurado quando não acha — mensagem de
 * "Chrome não encontrado" sem dizer onde procurou obriga quem lê a abrir o
 * código para descobrir onde colocar o binário, ou qual variável exportar.
 *
 * `existe` é injetado para o teste poder descrever máquinas que não são esta.
 */
function localizarNavegador({ plataforma, env = {}, existe }) {
  const candidatos = candidatosDeNavegador(plataforma, env);
  for (const candidato of candidatos) {
    if (ehCaminhoAbsoluto(candidato)) {
      if (existe(candidato)) return candidato;
    } else {
      const achado = resolverNoPath(candidato, env.PATH, plataforma, existe);
      if (achado) return achado;
    }
  }
  throw new Error(
    'não achei Chrome, Chromium, Brave nem Edge nesta máquina. A rasterização dos PNG da ' +
      'marca depende de um deles (a máquina não tem rsvg-convert, ImageMagick nem sharp, e ' +
      'nenhum deles entra como dependência npm só para gerar três arquivos).\n' +
      'Aponte o binário com CHROME_PATH=/caminho/do/chrome, ou instale um destes. ' +
      `Procurei em:\n${candidatos.map((c) => `  ${c}`).join('\n')}`,
  );
}

// --- A página que o navegador fotografa -------------------------------------

/**
 * O SVG embutido numa página do tamanho exato da captura.
 *
 * Por que uma página e não `--screenshot` direto no arquivo `.svg`: aberto
 * sozinho, o SVG herda margem de corpo e política de escala do navegador, e o
 * PNG sai com borda ou com o desenho fora de posição. Aqui a margem é zero, o
 * `svg` é `block` (sem a linha de base que `inline` reserva embaixo) e o quadro
 * tem exatamente as dimensões pedidas — a captura vira uma cópia 1:1.
 *
 * `corDeFundo` vem do theme, e não do gosto de quem escreveu: os três SVG já
 * pintam o próprio fundo, então ela só apareceria num vão de arredondamento — e
 * se aparecer, tem de ser o mesmo grafite, não o branco padrão do navegador.
 */
function paginaDeRasterizacao(svg, tamanho, corDeFundo) {
  return `<!doctype html>
<meta charset="utf-8">
<title>rasterização da marca devo.nada</title>
<style>
  html, body { margin: 0; padding: 0; background: ${corDeFundo}; }
  svg { display: block; width: ${tamanho}px; height: ${tamanho}px; }
</style>
${svg}
`;
}

/**
 * Os argumentos da captura. Cada um paga o próprio lugar:
 *
 * - `--force-device-scale-factor=1` é o que garante 1024 pixels e não 2048 numa
 *   máquina de tela Retina. Sem ele o ícone sai com o dobro do tamanho pedido, e
 *   o único sintoma é o número no `sips`.
 * - `--hide-scrollbars` impede a barra de rolagem de comer uma faixa da direita.
 * - `--user-data-dir` aponta para um diretório descartável: sem ele o comando
 *   abre o perfil real da pessoa, com as extensões e a sessão dela dentro.
 * - `--no-first-run`, `--no-default-browser-check`, `--disable-component-update`
 *   e `--disable-background-networking` calam o que um perfil recém-criado faz
 *   por reflexo — inclusive acordar o atualizador do Chrome, que é trabalho de
 *   rede que não tem nada a ver com fotografar um círculo.
 * - `--virtual-time-budget` fecha o tempo que a página tem para se assentar.
 */
function argumentosDoChrome({ url, saida, tamanho, perfil }) {
  return [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-update',
    '--disable-background-networking',
    `--user-data-dir=${perfil}`,
    `--window-size=${tamanho},${tamanho}`,
    `--screenshot=${saida}`,
    '--virtual-time-budget=2000',
    url,
  ];
}

module.exports = {
  extrairCoresDoSvg,
  conferirCoresDaMarca,
  lerDimensoesPng,
  pngCompleto,
  candidatosDeNavegador,
  ehCaminhoAbsoluto,
  resolverNoPath,
  localizarNavegador,
  paginaDeRasterizacao,
  argumentosDoChrome,
};
