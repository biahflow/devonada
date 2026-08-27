/**
 * Todo link relativo de Markdown do repositório resolve.
 *
 * O corpus sai de `git ls-files`, nunca de uma lista digitada: lista escrita à
 * mão é lista que deixa de descrever o repositório no dia seguinte.
 *
 * ## Por que existe
 *
 * `AGENTS.md`, `CLAUDE.md`, `README.md` e `docs/agent-guidelines.md` mandavam
 * carregar a camada global de `~/workspace/engineeringOS/` — o caminho absoluto
 * da máquina de uma pessoa, em quatro arquivos de instrução viva. Nunca resolveu
 * para o CI, para colaborador novo ou para agente em nuvem; resolvia para um
 * executor só, e por isso a falha era invisível. Quando o diretório mudou de
 * lugar, morreu para todos — **sem erro**, porque referência que não resolve não
 * é falha, é ausência.
 *
 * Com a camada global vendorizada em `docs/engineering-os/`, aquelas citações
 * viraram links relativos. Este teste é o que faz delas referência de verdade:
 * sem portão, o link só adia o problema que o texto corrido já tinha.
 *
 * O espelho entra no corpus de propósito. Espelho incompleto quebra os links
 * internos entre os documentos globais, que é exatamente o sinal desejado.
 */

const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

const RAIZ = join(__dirname, '..');
const LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g;
const EXTERNO = ['http://', 'https://', 'mailto:', '#'];

/** Os Markdown rastreados, derivados por glob e nunca digitados. */
function markdownRastreado() {
  return execFileSync('git', ['-C', RAIZ, 'ls-files', '-z', '*.md'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function linksQuebrados(arquivo) {
  const texto = readFileSync(join(RAIZ, arquivo), 'utf8');
  const base = dirname(join(RAIZ, arquivo));
  const falhas = [];

  texto.split('\n').forEach((linha, indice) => {
    for (const [, , alvo] of linha.matchAll(LINK)) {
      if (EXTERNO.some((prefixo) => alvo.startsWith(prefixo))) continue;
      // `{{EOS_ROOT}}` é placeholder de adapter, resolvido só na instalação.
      if (alvo.includes('{{')) continue;
      const caminho = alvo.split('#')[0];
      if (!caminho) continue;
      if (!existsSync(resolve(base, caminho))) falhas.push(`${arquivo}:${indice + 1} -> ${alvo}`);
    }
  });

  return falhas;
}

describe('links de Markdown', () => {
  // Fail-closed: um glob que devolve quase nada passaria por engano, dizendo que
  // nada está quebrado porque nada foi olhado.
  it('o corpus não está vazio', () => {
    expect(markdownRastreado().length).toBeGreaterThan(40);
  });

  it('todo link relativo resolve', () => {
    expect(markdownRastreado().flatMap(linksQuebrados)).toEqual([]);
  });
});
