/**
 * Testes do comando que gera os três PNG da marca.
 *
 * O que este comando pode errar em silêncio não é a imagem — imagem errada
 * qualquer um vê. É o resto:
 *
 * - um hex de marca que deixou de existir no theme e continuou no SVG (foi
 *   exatamente isso que aconteceu com o teal `#029488` e o violeta `#7C3AED` da
 *   marca anterior: a paleta inteira virou e os assets ficaram, porque não havia
 *   comando que reclamasse);
 * - uma captura que saiu em 2048px numa tela Retina, ou pela metade, e passou
 *   como se fosse 1024;
 * - um caminho de navegador que só existe na máquina de quem escreveu.
 *
 * Os testes vêm em duas camadas, como os de `fonte.test.js`:
 *
 * 1. Entradas SINTÉTICAS, montadas aqui, onde a resposta é conhecida porque foi
 *    escrita nesta linha — inclusive máquinas que não são esta, descritas pelo
 *    `existe` injetado.
 * 2. Os ARQUIVOS REAIS versionados em `assets/`, contra o `src/theme/theme.ts`
 *    real. É a mesma conferência que `npm run assets:build` faz, então o teste
 *    quebra pelo mesmo motivo que o comando quebraria — que é a única forma de
 *    ele provar alguma coisa sobre o comando.
 *
 * O arquivo é `.js` e não `.ts` de propósito: `scripts/` é ferramenta de linha
 * de comando rodada por `node` puro, fora do `tsconfig.json` e sem
 * transpilador. Testar a mesma implementação que o comando executa exige falar
 * a língua dela.
 */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const {
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
} = require('./marca');
const { extrairTokens } = require('./contraste');

const RAIZ = join(__dirname, '..');
const ASSETS = join(RAIZ, 'assets');

const lerAsset = (nome) => readFileSync(join(ASSETS, nome), 'utf8');
const lerAssetBinario = (nome) => readFileSync(join(ASSETS, nome));

const TOKENS = extrairTokens(readFileSync(join(RAIZ, 'src', 'theme', 'theme.ts'), 'utf8'));
const SVGS = ['icon.svg', 'adaptive-icon.svg', 'splash.svg'];
const PNGS = ['icon.png', 'adaptive-icon.png', 'splash.png'];

/** Um PNG mínimo e válido: assinatura, IHDR com as dimensões, e IEND. */
function pngSintetico(largura, altura, { truncado = false } = {}) {
  const assinatura = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(largura, 8);
  ihdr.writeUInt32BE(altura, 12);
  if (truncado) return Buffer.concat([assinatura, ihdr]);
  const iend = Buffer.alloc(12);
  iend.write('IEND', 4, 'ascii');
  return Buffer.concat([assinatura, ihdr, iend]);
}

describe('extrairCoresDoSvg', () => {
  it('lê fill e stroke, normaliza para maiúsculas e não repete', () => {
    const svg = `<svg><rect fill="#101216"/><circle fill="#e5352b" stroke="#101216"/></svg>`;
    expect(extrairCoresDoSvg(svg)).toEqual(['#101216', '#E5352B']);
  });

  it('IGNORA o hex citado em comentário', () => {
    // Os SVG da marca citam o hex ao lado do nome do token para quem lê o
    // arquivo saber de onde a cor veio. Contar a citação como uso faria a
    // conferência aprovar um arquivo que documenta uma cor e desenha outra.
    const svg = `<svg><!-- #101216 colors.background --><circle fill="#E5352B"/></svg>`;
    expect(extrairCoresDoSvg(svg)).toEqual(['#E5352B']);
  });

  it('lança na abreviação de três dígitos em vez de expandi-la', () => {
    expect(() => extrairCoresDoSvg('<svg><rect fill="#E32"/></svg>')).toThrow(
      /formato inesperado/,
    );
  });
});

describe('conferirCoresDaMarca', () => {
  const tokens = new Map([
    ['background', '#101216'],
    ['debt', '#E5352B'],
    ['warning', '#F0A31C'],
  ]);

  it('aprova o grafite e o vermelho, e diz de qual token cada um veio', () => {
    const arquivos = [{ nome: 'icon.svg', svg: '<circle fill="#E5352B"/><rect fill="#101216"/>' }];
    const { ok, achados } = conferirCoresDaMarca(arquivos, tokens, ['background', 'debt']);
    expect(ok).toBe(true);
    expect(achados).toEqual([
      { arquivo: 'icon.svg', hex: '#E5352B', tokens: ['debt'] },
      { arquivo: 'icon.svg', hex: '#101216', tokens: ['background'] },
    ]);
  });

  it('REPROVA a cor da marca anterior, nomeando arquivo e hex', () => {
    // O caso real: `#029488` era o traçado teal do ícone antigo e sobreviveu à
    // troca de paleta inteira sem nada reclamar.
    const arquivos = [{ nome: 'icon.svg', svg: '<path stroke="#029488"/>' }];
    const { ok, problemas } = conferirCoresDaMarca(arquivos, tokens, ['background', 'debt']);
    expect(ok).toBe(false);
    expect(problemas[0]).toMatch(/icon\.svg/);
    expect(problemas[0]).toMatch(/#029488/);
  });

  it('REPROVA um token do theme que não está na lista da marca', () => {
    // Âmbar existe no theme e não é cor de ícone estático: o ponto do arquivo é
    // vermelho porque `divida` é o estado em que a pessoa chega.
    const arquivos = [{ nome: 'icon.svg', svg: '<circle fill="#F0A31C"/>' }];
    expect(conferirCoresDaMarca(arquivos, tokens, ['background', 'debt']).ok).toBe(false);
  });

  it('lança quando um token declarado sumiu do theme, em vez de ignorá-lo', () => {
    expect(() => conferirCoresDaMarca([], tokens, ['debtOld'])).toThrow(/não existe/);
  });
});

describe('lerDimensoesPng', () => {
  it('lê largura e altura do IHDR', () => {
    expect(lerDimensoesPng(pngSintetico(1024, 1024))).toEqual({ largura: 1024, altura: 1024 });
    expect(lerDimensoesPng(pngSintetico(2048, 1024))).toEqual({ largura: 2048, altura: 1024 });
  });

  it('recusa o que não é PNG', () => {
    const naoPng = Buffer.alloc(64, 0x41);
    expect(() => lerDimensoesPng(naoPng)).toThrow(/não é PNG/);
    expect(() => lerDimensoesPng(Buffer.alloc(8))).toThrow(/curto demais/);
  });

  it('recusa PNG cujo primeiro chunk não é IHDR', () => {
    const errado = pngSintetico(1024, 1024);
    errado.write('IDAT', 12, 'ascii');
    expect(() => lerDimensoesPng(errado)).toThrow(/IHDR/);
  });
});

describe('pngCompleto', () => {
  it('reconhece o IEND do fim do arquivo', () => {
    expect(pngCompleto(pngSintetico(1024, 1024))).toBe(true);
  });

  it('recusa a captura pela metade', () => {
    // O comando lê o arquivo enquanto o navegador ainda está vivo: "apareceu"
    // não é "está pronto".
    expect(pngCompleto(pngSintetico(1024, 1024, { truncado: true }))).toBe(false);
  });
});

describe('localizar o navegador', () => {
  it('respeita CHROME_PATH antes de qualquer lista', () => {
    const env = { CHROME_PATH: '/opt/meu-chrome' };
    expect(candidatosDeNavegador('darwin', env)[0]).toBe('/opt/meu-chrome');
    expect(localizarNavegador({ plataforma: 'darwin', env, existe: (c) => c === '/opt/meu-chrome' }))
      .toBe('/opt/meu-chrome');
  });

  it('acha o Chrome do macOS sem que o caminho esteja cravado no comando', () => {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    expect(localizarNavegador({ plataforma: 'darwin', env: {}, existe: (c) => c === chrome })).toBe(
      chrome,
    );
  });

  it('cai para o Chromium quando só ele existe', () => {
    const chromium = '/Applications/Chromium.app/Contents/MacOS/Chromium';
    expect(
      localizarNavegador({ plataforma: 'darwin', env: {}, existe: (c) => c === chromium }),
    ).toBe(chromium);
  });

  it('procura no PATH o candidato que é só um nome, no Linux', () => {
    const env = { PATH: '/usr/local/bin:/usr/bin' };
    const existe = (c) => c === '/usr/bin/chromium';
    // `google-chrome` vem antes na lista e não existe nesta máquina descrita.
    expect(localizarNavegador({ plataforma: 'linux', env, existe })).toBe('/usr/bin/chromium');
    expect(resolverNoPath('google-chrome', env.PATH, 'linux', existe)).toBeNull();
  });

  it('lança dizendo ONDE procurou quando não acha nenhum', () => {
    const erro = (() => {
      try {
        localizarNavegador({ plataforma: 'darwin', env: {}, existe: () => false });
        return null;
      } catch (e) {
        return e;
      }
    })();
    expect(erro).not.toBeNull();
    expect(erro.message).toMatch(/CHROME_PATH/);
    expect(erro.message).toMatch(/Google Chrome/);
  });

  it('sabe o que é caminho absoluto nos dois formatos', () => {
    expect(ehCaminhoAbsoluto('/Applications/x')).toBe(true);
    expect(ehCaminhoAbsoluto('C:\\Program Files\\chrome.exe')).toBe(true);
    expect(ehCaminhoAbsoluto('google-chrome')).toBe(false);
  });
});

describe('a página que o navegador fotografa', () => {
  it('embute o SVG num quadro do tamanho exato, sem margem', () => {
    const html = paginaDeRasterizacao('<svg id="marca"/>', 1024, '#101216');
    expect(html).toContain('<svg id="marca"/>');
    expect(html).toMatch(/margin:\s*0/);
    expect(html).toContain('width: 1024px');
    expect(html).toContain('height: 1024px');
    // `inline` reservaria a linha de base embaixo do desenho e a captura sairia
    // com uma faixa do fundo.
    expect(html).toMatch(/svg\s*{[^}]*display:\s*block/);
    expect(html).toContain('background: #101216');
  });
});

describe('os argumentos da captura', () => {
  const args = argumentosDoChrome({
    url: 'file:///tmp/x.html',
    saida: '/tmp/x.png',
    tamanho: 1024,
    perfil: '/tmp/perfil',
  });

  it('pede captura, tamanho de janela e escala 1', () => {
    expect(args).toContain('--screenshot=/tmp/x.png');
    expect(args).toContain('--window-size=1024,1024');
    // Sem isto o ícone sai 2048² numa máquina Retina, e o único sintoma é o
    // número do `sips`.
    expect(args).toContain('--force-device-scale-factor=1');
    expect(args).toContain('--headless');
    expect(args[args.length - 1]).toBe('file:///tmp/x.html');
  });

  it('usa um perfil descartável, e não o perfil real de quem roda', () => {
    expect(args).toContain('--user-data-dir=/tmp/perfil');
  });
});

// --- Camada 2: os arquivos que estão versionados ----------------------------

describe('os SVG versionados da marca', () => {
  it('só usam cores que existem em src/theme/theme.ts', () => {
    const arquivos = SVGS.map((nome) => ({ nome, svg: lerAsset(nome) }));
    const { ok, problemas, achados } = conferirCoresDaMarca(arquivos, TOKENS, [
      'background',
      'debt',
    ]);
    expect(problemas).toEqual([]);
    expect(ok).toBe(true);
    // Duas cores por arquivo: o grafite e o ponto. Nada mais.
    expect(achados).toHaveLength(6);
  });

  it('não carregam nenhum hex da marca anterior', () => {
    // O teal, o violeta e o fundo branco do ícone que veio do Budgi.
    for (const nome of SVGS) {
      const svg = lerAsset(nome).toUpperCase();
      expect(svg).not.toContain('#029488');
      expect(svg).not.toContain('#7C3AED');
      expect(svg).not.toContain('#FFFFFF');
    }
  });

  it('desenham um ponto centrado num quadro de 1024', () => {
    for (const nome of SVGS) {
      const svg = lerAsset(nome);
      expect(svg).toContain('viewBox="0 0 1024 1024"');
      expect(svg).toMatch(/<circle cx="512" cy="512"/);
    }
  });

  it('diferem apenas no raio — e é o raio que justifica três arquivos', () => {
    const raio = (nome) => Number(/<circle[^>]*r="([\d.]+)"/.exec(lerAsset(nome))[1]);

    // iOS: 62% da caixa. Sobra grafite em todo o perímetro depois do squircle —
    // o ponto precisa de moldura para ler como ponto, e não como fundo vermelho.
    expect(raio('icon.svg')).toBeCloseTo(0.62 * 1024 * 0.5, 5);
    // Android: 55% da caixa, DENTRO da janela garantida da máscara, que é a de
    // 72dp de 108dp — 66,7%. É o número que design-system.md escrevia como "72%"
    // por ter confundido a medida em dp com porcentagem; a 72% da caixa o disco
    // era recortado na borda em launcher circular e o grafite sumia.
    expect(raio('adaptive-icon.svg')).toBeCloseTo(0.55 * 1024 * 0.5, 5);
    // O disco tem de caber na janela da máscara com folga visível.
    expect(raio('adaptive-icon.svg')).toBeLessThan((72 / 108) * 1024 * 0.5);
    // Splash: 15% da caixa — com resizeMode "contain", ~62dp de largura de tela
    // num aparelho de 411dp, que é o halo de SplashDevoNada.tsx.
    expect(raio('splash.svg')).toBeCloseTo(0.15 * 1024 * 0.5, 5);
  });
});

describe('os PNG versionados da marca', () => {
  it('têm 1024×1024, que é o que a loja e o app.json esperam', () => {
    for (const nome of PNGS) {
      expect(lerDimensoesPng(lerAssetBinario(nome))).toEqual({ largura: 1024, altura: 1024 });
    }
  });

  it('estão completos', () => {
    for (const nome of PNGS) expect(pngCompleto(lerAssetBinario(nome))).toBe(true);
  });
});
