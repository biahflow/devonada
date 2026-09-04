#!/usr/bin/env node
/**
 * `npm run local:up` — sobe Postgres (ou SQLite), API e Metro de uma vez.
 *
 *     npm run local:up                 # ou: node scripts/subir-local.mjs
 *     npm run tunel:up                 # idem, mas alcançável de fora de casa
 *     npm run tunel:up -- --sem-llm    # idem, com a leitura de documento desligada
 *
 * MODO TÚNEL (`--tunel`), para usar o app no celular em qualquer rede:
 *
 * O modo padrão serve pelo IP da LAN, que só existe dentro de casa. Com
 * `--tunel`, as duas pontas ganham endereço público:
 *
 * - **API** por `cloudflared` (quick tunnel, sem conta e sem domínio: a URL é
 *   sorteada e morre junto com o processo).
 * - **Metro** por `expo start --tunnel`, que é o caminho suportado pelo Expo
 *   Go e usa o ngrok que o próprio Expo empacota.
 *
 * A ORDEM AQUI É LEI, e é o motivo de o modo túnel não ser só uma flag no fim:
 * `EXPO_PUBLIC_API_BASE_URL` é EMBUTIDA no bundle quando o Metro compila. O
 * túnel da API tem que existir, e o `.env` tem que apontar para ele, ANTES de
 * o Metro subir. Invertido, o app sai do forno apontando para um IP de LAN
 * que o celular não alcança — e o sintoma é uma tela de erro de rede genérica,
 * não uma mensagem dizendo que a URL está errada.
 *
 * `caffeinate` sobe junto: o túnel morre quando o Mac dorme, e um Mac que
 * dorme sozinho no meio do teste é o mesmo bug com outra cara.
 *
 * O QUE O TÚNEL CUSTA, dito antes de você decidir: enquanto ele está no ar, a
 * API de desenvolvimento está na internet. A URL é sorteada e não indexada,
 * mas isso é obscuridade, não segurança — o registro de conta é aberto, e
 * quem chegar na URL pode criar conta e usar a LEITURA DE DOCUMENTO, que gasta
 * a sua chave de LLM. Por isso existe `--sem-llm`, que sobe a API com as
 * chaves vazias: a extração passa a responder "este recurso ainda não está
 * configurado neste servidor" (`backend/llm/openai_cliente.py:58`) em vez de
 * cobrar. Use o túnel enquanto testa e derrube depois — `npm run local:down`.
 *
 * Substitui a sequência manual de `docs/backend.md`, seção "Como subir". Essa
 * seção existe porque cada um dos seis comandos manuais tem uma armadilha que
 * já custou tempo real de sessão — e este script automatiza exatamente as
 * decisões que evitam cada uma delas, nesta ordem:
 *
 * 1. **Interface de rede.** `route -n get default` diz qual é a ativa — NUNCA
 *    assuma `en0`. Numa das máquinas de desenvolvimento o Wi-Fi é a `en1`, e a
 *    `en0` devolve IP vazio. Sem IP, um celular físico não alcança a API.
 * 2. **Porta da API.** Tenta 8001 (a convenção do projeto) e sobe até achar
 *    uma livre. O sintoma de subir na porta errada é traiçoeiro: o app NÃO
 *    acusa porta errada, ele conversa com a API de outro projeto (já
 *    aconteceu com o `homecareos-api-1`) e devolve erro de forma ou falha de
 *    rede genérica.
 * 3. **`.env` do app.** O fallback de `src/config/env.ts` é
 *    `http://localhost:8001`, que do celular físico aponta para o próprio
 *    celular. As duas pontas (porta escolhida e `.env`) têm que concordar.
 * 4. **Banco.** Postgres é o gate de release, mas o Docker cai — já caiu no
 *    meio de uma sessão real. Sem ele, o fallback é SQLite com
 *    `Base.metadata.create_all` (não Alembic: há migração que o SQLite não
 *    aceita, o mesmo motivo de `backend/tests/conftest.py`).
 * 5. **Chave de sessão.** `DEVONADA_JWT_SECRET` não tem default
 *    (`backend/config.py`) — vazia, toda rota autenticada devolve 500. Sem
 *    uma configurada, este script gera uma só para esta sessão (nunca grava
 *    segredo em arquivo).
 * 6. **Host do uvicorn.** `--host 0.0.0.0` é obrigatório; o default
 *    (`127.0.0.1`) só aceita o próprio Mac.
 *
 * No fim, confere de verdade — pelo IP da rede, não por `localhost` — em vez
 * de dizer "pronto" sem provar. Não existe `venv/` neste repositório nem
 * `python3` >= 3.12 garantido; por isso todo comando do backend passa por
 * `uv run --python 3.12 --with-requirements requirements.txt`.
 *
 * Ver `scripts/derrubar-local.mjs` para o script irmão.
 */
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = join(ROOT, 'backend');
const ENV_PATH = join(ROOT, '.env');
const LOCAL_RUN_PATH = join(ROOT, '.local-run.json');
const LOG_DIR = join(ROOT, '.local-logs');
const API_LOG = join(LOG_DIR, 'api.log');
const METRO_LOG = join(LOG_DIR, 'metro.log');
const TUNEL_LOG = join(LOG_DIR, 'cloudflared.log');
const SQLITE_URL = 'sqlite+pysqlite:///./devonada-local.db';
const PRIMEIRA_PORTA = 8001;
const ULTIMA_PORTA = 8010;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TUNEL = process.argv.includes('--tunel');
const SEM_LLM = process.argv.includes('--sem-llm');

const TOTAL_PASSOS = TUNEL ? 10 : 8;

function passo(n, titulo) {
  console.log(`\n[${n}/${TOTAL_PASSOS}] ${titulo}`);
}

// --- 1. Interface de rede e IP ---------------------------------------------

function descobrirInterface() {
  let saida;
  try {
    saida = execFileSync('route', ['-n', 'get', 'default'], { encoding: 'utf8' });
  } catch {
    throw new Error('Não consegui rodar `route -n get default` para achar a interface de rede ativa.');
  }
  const linha = saida.split('\n').find((l) => l.trim().startsWith('interface:'));
  const iface = linha?.split(':')[1]?.trim();
  if (!iface) {
    throw new Error('`route -n get default` não devolveu uma interface — confira se há rede ativa.');
  }
  return iface;
}

function descobrirIp(iface) {
  let ip = '';
  try {
    ip = execFileSync('ipconfig', ['getifaddr', iface], { encoding: 'utf8' }).trim();
  } catch {
    ip = '';
  }
  if (!ip) {
    throw new Error(
      `A interface ${iface} não devolveu IP. Sem IP, um aparelho físico não alcança a API — ` +
        'confira a conexão de rede (Wi-Fi) e rode de novo. Não assuma que é a en0: em algumas ' +
        'máquinas o Wi-Fi está em outra interface.',
    );
  }
  return ip;
}

// --- 2. Porta da API ---------------------------------------------------------

function checarPorta(porta) {
  try {
    const saida = execFileSync('lsof', ['-nP', `-iTCP:${porta}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    const dados = saida.trim().split('\n')[1]?.trim().split(/\s+/) ?? [];
    return { livre: false, comando: dados[0] ?? 'processo desconhecido', pid: dados[1] ?? '?' };
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new Error('`lsof` não está disponível nesta máquina — não dá para checar se a porta está livre.');
    }
    // lsof sai com código != 0 quando não há ninguém escutando: porta livre.
    return { livre: true };
  }
}

function escolherPorta() {
  const ocupadas = [];
  for (let porta = PRIMEIRA_PORTA; porta <= ULTIMA_PORTA; porta += 1) {
    const status = checarPorta(porta);
    if (status.livre) {
      return { porta, ocupadas };
    }
    ocupadas.push({ porta, comando: status.comando, pid: status.pid });
  }
  throw new Error(`Nenhuma porta livre entre ${PRIMEIRA_PORTA} e ${ULTIMA_PORTA}.`);
}

// --- 3. .env do app -----------------------------------------------------------

function sincronizarEnvApp(valorDesejado) {
  const linhaDesejada = `EXPO_PUBLIC_API_BASE_URL=${valorDesejado}`;

  if (!existsSync(ENV_PATH)) {
    const conteudo =
      `# Gerado por scripts/subir-local.mjs — aponta o app para a API local.\n` +
      `# EXPO_PUBLIC_* é público (vai embutido no bundle); nunca coloque segredo aqui.\n` +
      `${linhaDesejada}\n`;
    writeFileSync(ENV_PATH, conteudo);
    console.log(`   .env criado com ${linhaDesejada}`);
    return;
  }

  const original = readFileSync(ENV_PATH, 'utf8');
  const linhas = original.split('\n');
  const regex = /^EXPO_PUBLIC_API_BASE_URL=(.*)$/;
  let encontrada = false;
  let valorAnterior = null;
  const novasLinhas = linhas.map((linha) => {
    const m = linha.match(regex);
    if (m) {
      encontrada = true;
      valorAnterior = m[1];
      return linhaDesejada;
    }
    return linha;
  });

  if (!encontrada) {
    novasLinhas.push(linhaDesejada);
    writeFileSync(ENV_PATH, novasLinhas.join('\n'));
    console.log(`   .env não tinha EXPO_PUBLIC_API_BASE_URL — adicionei: ${linhaDesejada}`);
    return;
  }

  if (valorAnterior === valorDesejado) {
    console.log(`   .env já aponta para ${valorDesejado} — nada a mudar.`);
    return;
  }

  writeFileSync(ENV_PATH, novasLinhas.join('\n'));
  console.log(`   .env atualizado: EXPO_PUBLIC_API_BASE_URL mudou de ${valorAnterior || '(vazio)'} para ${valorDesejado}.`);
}

// --- 4. Banco de dados --------------------------------------------------------

function dockerDisponivel() {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function aguardarPostgresSaudavel(timeoutMs = 60000) {
  const inicio = Date.now();
  let ultimoStatus = 'container ainda não existe';
  let ultimoAviso = 0;
  while (Date.now() - inicio < timeoutMs) {
    try {
      ultimoStatus = execFileSync(
        'docker',
        ['inspect', '-f', '{{.State.Health.Status}}', 'devonada-postgres'],
        { encoding: 'utf8' },
      ).trim();
    } catch {
      ultimoStatus = 'container ainda não existe';
    }
    if (ultimoStatus === 'healthy') {
      return;
    }
    if (Date.now() - ultimoAviso > 10000) {
      console.log(`   aguardando Postgres ficar healthy (status atual: ${ultimoStatus})...`);
      ultimoAviso = Date.now();
    }
    await esperar(2000);
  }
  throw new Error(
    `Postgres não ficou "healthy" em ${Math.round(timeoutMs / 1000)}s (status: ${ultimoStatus}). ` +
      'Veja `docker compose logs` em backend/.',
  );
}

function subirPostgres() {
  try {
    execFileSync('docker', ['compose', 'up', '-d'], { cwd: BACKEND, stdio: 'inherit' });
  } catch (e) {
    throw new Error(`\`docker compose up -d\` falhou em backend/: ${e.message}`);
  }
}

function rodarAlembic() {
  try {
    execFileSync(
      'uv',
      ['run', '--python', '3.12', '--with-requirements', 'requirements.txt', 'alembic', 'upgrade', 'head'],
      { cwd: BACKEND, stdio: 'inherit' },
    );
  } catch (e) {
    throw new Error(`\`alembic upgrade head\` falhou: ${e.message}`);
  }
}

function prepararSqlite() {
  console.log(
    '   Docker indisponível — caindo para SQLite (FALLBACK). Postgres continua sendo o gate de ' +
      'release; isto serve só para exercitar a tela agora.',
  );
  try {
    execFileSync(
      'uv',
      [
        'run',
        '--python',
        '3.12',
        '--with-requirements',
        'requirements.txt',
        'python',
        '-c',
        'from db import engine; from orm import Base; Base.metadata.create_all(engine); print("schema OK")',
      ],
      { cwd: BACKEND, stdio: 'inherit', env: { ...process.env, DEVONADA_DATABASE_URL: SQLITE_URL } },
    );
  } catch (e) {
    throw new Error(`Criar o schema SQLite falhou: ${e.message}`);
  }
}

// --- 5. Chave de sessão (JWT) --------------------------------------------------

function obterSegredoJwt() {
  if (process.env.DEVONADA_JWT_SECRET && process.env.DEVONADA_JWT_SECRET.trim() !== '') {
    console.log('   DEVONADA_JWT_SECRET já está no ambiente do shell — usando.');
    return null;
  }
  const caminhoEnvBackend = join(BACKEND, '.env');
  if (existsSync(caminhoEnvBackend)) {
    const conteudo = readFileSync(caminhoEnvBackend, 'utf8');
    const m = conteudo.match(/^DEVONADA_JWT_SECRET=(.+)$/m);
    if (m && m[1].trim() !== '') {
      console.log('   backend/.env já tem DEVONADA_JWT_SECRET — usando o que já está lá.');
      return null;
    }
  }
  const gerado = randomBytes(32).toString('base64url');
  console.log(
    '   Sem DEVONADA_JWT_SECRET em backend/.env nem no ambiente — gerei uma chave só para esta ' +
      'sessão (não gravei em arquivo). Sem ela, toda rota autenticada devolveria 500.',
  );
  return gerado;
}

// --- 6 e 7. Subir API e Metro ---------------------------------------------------

function subirApi(porta, dbUrlExtra, jwtSecret, { semLlm = false } = {}) {
  mkdirSync(LOG_DIR, { recursive: true });
  const logFd = openSync(API_LOG, 'a');
  const env = { ...process.env };
  if (dbUrlExtra) env.DEVONADA_DATABASE_URL = dbUrlExtra;
  if (jwtSecret) env.DEVONADA_JWT_SECRET = jwtSecret;
  if (semLlm) {
    // Variável de ambiente vence `backend/.env` no pydantic-settings, e chave
    // vazia é o estado que os dois adaptadores já tratam: a extração responde
    // "ainda não está configurado neste servidor" em vez de gastar a chave.
    // Vazio, não apagado — apagar deixaria o SDK cair no ambiente do processo.
    env.OPENAI_API_KEY = '';
    env.ANTHROPIC_API_KEY = '';
  }
  const args = [
    'run',
    '--python',
    '3.12',
    '--with-requirements',
    'requirements.txt',
    'uvicorn',
    'main:app',
    '--host',
    '0.0.0.0',
    '--port',
    String(porta),
    '--reload',
  ];
  const processo = spawn('uv', args, { cwd: BACKEND, env, detached: true, stdio: ['ignore', logFd, logFd] });
  processo.unref();
  return processo.pid;
}

function subirMetro({ tunel = false } = {}) {
  mkdirSync(LOG_DIR, { recursive: true });
  const logFd = openSync(METRO_LOG, 'a');
  const args = tunel ? ['expo', 'start', '--tunnel'] : ['expo', 'start'];
  const processo = spawn('npx', args, { cwd: ROOT, detached: true, stdio: ['ignore', logFd, logFd] });
  processo.unref();
  return processo.pid;
}

// --- Túnel (só no modo --tunel) --------------------------------------------------

/**
 * As duas dependências do modo túnel são externas ao `npm install` normal, e
 * falham de formas diferentes: sem `cloudflared` o script não tem como abrir a
 * ponta da API; sem `@expo/ngrok` o `expo start --tunnel` PARA E PERGUNTA se
 * pode instalar — e como ele sobe detached, com stdin fechado, a pergunta
 * ficaria esperando para sempre num log que ninguém está lendo. Conferir as
 * duas antes de subir qualquer coisa transforma isso numa mensagem clara.
 */
function exigirDependenciasDeTunel() {
  try {
    execFileSync('cloudflared', ['--version'], { stdio: 'ignore' });
  } catch {
    throw new Error(
      'O modo túnel precisa do cloudflared, que não está no PATH.\n' +
        '  Instale com: brew install cloudflared',
    );
  }

  if (!existsSync(join(ROOT, 'node_modules', '@expo', 'ngrok'))) {
    throw new Error(
      'O modo túnel precisa do @expo/ngrok (é ele que o `expo start --tunnel` usa).\n' +
        '  Instale com: npm install --save-dev @expo/ngrok@^4.1.0',
    );
  }
}

function subirCloudflared(porta) {
  mkdirSync(LOG_DIR, { recursive: true });
  // 'w' (trunca), não 'a' como os outros logs: a URL do quick tunnel é
  // sorteada a cada execução, e a anterior fica morta no arquivo. Lendo um log
  // acumulado, o script acha a URL velha, escreve ela no `.env` e só descobre
  // na conferência — com um 530 do Cloudflare, que não diz que a culpa é do
  // log. Aconteceu ao testar este script.
  const logFd = openSync(TUNEL_LOG, 'w');
  // `--protocol http2` em vez do QUIC padrão: o QUIC é UDP na 7844, e é a
  // primeira coisa que VPN corporativa, firewall de empresa e Wi-Fi de hotel
  // bloqueiam — o sintoma é "failed to dial to edge with quic: timeout", com o
  // túnel tentando para sempre. O http2 sai por TCP 443, que passa nos mesmos
  // lugares onde um navegador passa. Custa um pouco de desempenho e compra
  // funcionar fora de casa, que é o motivo deste modo existir.
  const args = ['tunnel', '--protocol', 'http2', '--url', `http://127.0.0.1:${porta}`];
  const processo = spawn('cloudflared', args, {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  processo.unref();
  return processo.pid;
}

/**
 * Espera uma URL aparecer num log que outro processo está escrevendo.
 *
 * Reler o arquivo inteiro a cada tentativa (em vez de acompanhar o stream) é
 * de propósito: o processo é detached e escreve direto no descritor, então não
 * há stream para escutar daqui. Os logs são de uma sessão e têm poucos KB.
 */
async function aguardarNoLog(logPath, regex, { timeoutMs, oQue, aviso }) {
  const inicio = Date.now();
  let ultimoAviso = 0;
  while (Date.now() - inicio < timeoutMs) {
    if (existsSync(logPath)) {
      const m = readFileSync(logPath, 'utf8').match(regex);
      if (m) return m[0];
    }
    if (aviso && Date.now() - ultimoAviso > 15000) {
      console.log(aviso);
      ultimoAviso = Date.now();
    }
    await esperar(1000);
  }
  throw new Error(
    `Não achei ${oQue} em ${relative(ROOT, logPath)} depois de ${Math.round(timeoutMs / 1000)}s. ` +
      'O log tem o que o processo respondeu.',
  );
}

/**
 * Descobre o endereço público do Metro depois que o túnel do Expo sobe.
 *
 * NÃO SAI DO LOG, e é por isso que esta função existe: com o stdout preso num
 * arquivo, o Expo escreve "Tunnel ready" e guarda o QR e a URL para si — os
 * dois só aparecem quando o terminal é interativo. Sobram duas fontes, nesta
 * ordem:
 *
 * 1. O inspector do ngrok em `127.0.0.1:4040`, que devolve a `public_url`
 *    literal. É a fonte boa: nada é inferido.
 * 2. `.expo/settings.json`, que guarda o `urlRandomness` — o prefixo sorteado
 *    da URL. Reconstruir a partir dele exige saber o formato
 *    (`<randomness>-anonymous-<porta>.exp.direct`), então fica de reserva,
 *    para o caso de o inspector estar desligado.
 */
async function aguardarUrlDoExpo({ timeoutMs, aviso }) {
  const inicio = Date.now();
  let ultimoAviso = 0;
  const settingsPath = join(ROOT, '.expo', 'settings.json');

  while (Date.now() - inicio < timeoutMs) {
    try {
      const controle = new AbortController();
      const t = setTimeout(() => controle.abort(), 3000);
      const r = await fetch('http://127.0.0.1:4040/api/tunnels', { signal: controle.signal });
      clearTimeout(t);
      if (r.ok) {
        const { tunnels = [] } = await r.json();
        const achado = tunnels.map((t2) => t2.public_url).find((u) => u && u.includes('.exp.direct'));
        if (achado) return achado.replace(/^https?:\/\//, 'exp://');
      }
    } catch {
      // inspector ainda não subiu, ou está desligado — cai para o settings.json
    }

    if (existsSync(settingsPath)) {
      try {
        const { urlRandomness } = JSON.parse(readFileSync(settingsPath, 'utf8'));
        if (urlRandomness) return `exp://${urlRandomness.toLowerCase()}-anonymous-8081.exp.direct`;
      } catch {
        // arquivo sendo reescrito pelo Expo neste instante — tenta de novo
      }
    }

    if (aviso && Date.now() - ultimoAviso > 15000) {
      console.log(aviso);
      ultimoAviso = Date.now();
    }
    await esperar(1000);
  }
  throw new Error(
    'O túnel do Expo não publicou endereço em ' +
      `${Math.round(timeoutMs / 1000)}s. Procure por "Tunnel ready" em ${relative(ROOT, METRO_LOG)}.`,
  );
}

/**
 * Confere uma URL pública sem depender do resolvedor DNS desta máquina.
 *
 * Existe porque o caso comum de "a conferência falhou mas está tudo certo" é
 * VPN: o resolvedor interno devolve NXDOMAIN para `trycloudflare.com`, e o
 * script não tem como distinguir isso de um túnel quebrado — que é a diferença
 * entre "pode usar" e "não adianta pegar o celular".
 *
 * O caminho é resolver o nome por DNS-over-HTTPS (sai pela 443, que passa onde
 * o navegador passa) e depois pedir a URL fixando aquele IP. `curl --resolve`
 * faz isso mantendo nome, SNI e certificado corretos; o `fetch` do Node não
 * expõe esse controle sem trocar o dispatcher.
 */
async function conferirPorDoH(url, statusEsperado) {
  const host = new URL(url).host;
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${host}&type=A`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!r.ok) throw new Error(`DoH respondeu HTTP ${r.status}`);
  const { Answer = [] } = await r.json();
  const ip = Answer.find((a) => a.type === 1)?.data;
  if (!ip) throw new Error(`DoH não devolveu IP para ${host}`);

  const codigo = execFileSync(
    'curl',
    ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--resolve', `${host}:443:${ip}`, '--max-time', '20', url],
    { encoding: 'utf8' },
  ).trim();
  if (String(statusEsperado) !== codigo) {
    throw new Error(`${url} respondeu HTTP ${codigo} pelo IP ${ip} (esperado ${statusEsperado})`);
  }
  return ip;
}

/**
 * Impede o Mac de dormir enquanto o túnel está no ar.
 *
 * `-i` (idle) e `-s` (sistema, quando na tomada) são o que interessa; `-d`
 * mantém o display aceso e é o preço de o `caffeinate` não separar as duas
 * coisas em Macs mais novos. Não impede sono por tampa fechada — isso é
 * ajuste do sistema, não deste script, e está dito na saída final.
 */
function manterAcordado() {
  const processo = spawn('caffeinate', ['-dis'], { detached: true, stdio: 'ignore' });
  processo.unref();
  return processo.pid;
}

/**
 * Desenha o QR do endereço do Expo aqui, em vez de esperá-lo do Metro.
 *
 * O Expo só desenha o QR quando o stdout é um terminal, e aqui ele é um
 * arquivo de log — então o QR dele não existe para reaproveitar. Gerar o
 * nosso a partir da URL dá no mesmo para a câmera do iPhone e não depende do
 * modo de saída de outro processo.
 */
async function mostrarQr(url) {
  try {
    const { default: qr } = await import('qrcode-terminal');
    console.log('');
    qr.generate(url, { small: true });
    return true;
  } catch {
    return false;
  }
}

function gravarEstado(estado) {
  writeFileSync(LOCAL_RUN_PATH, `${JSON.stringify(estado, null, 2)}\n`);
}

// --- 8. Conferir -----------------------------------------------------------------

async function aguardarUrl(url, { statusEsperado, timeoutMs, intervalMs = 1000, aviso }) {
  const inicio = Date.now();
  let ultimoErro = 'sem resposta ainda';
  let ultimoAviso = 0;
  while (Date.now() - inicio < timeoutMs) {
    try {
      const controle = new AbortController();
      const t = setTimeout(() => controle.abort(), 5000);
      const resposta = await fetch(url, { signal: controle.signal });
      clearTimeout(t);
      if (resposta.status === statusEsperado) {
        return;
      }
      ultimoErro = `HTTP ${resposta.status}`;
    } catch (e) {
      ultimoErro = e.message;
    }
    if (aviso && Date.now() - ultimoAviso > 15000) {
      console.log(aviso);
      ultimoAviso = Date.now();
    }
    await esperar(intervalMs);
  }
  throw new Error(
    `${url} não respondeu ${statusEsperado} em ${Math.round(timeoutMs / 1000)}s (última tentativa: ${ultimoErro}).`,
  );
}

// --- main ---------------------------------------------------------------------

async function main() {
  console.log(`Subindo o ambiente local do devo.nada${TUNEL ? ' com túnel' : ''}...`);

  if (TUNEL) exigirDependenciasDeTunel();

  passo(1, 'Rede');
  // No modo LAN, ficar sem IP é fatal: é ele que o celular usa. No modo túnel
  // não é — quem serve é o cloudflared, e o IP fica só para conferir o Metro
  // aqui do Mac. Uma VPN ativa (rota padrão numa `utun*`) derruba a descoberta
  // e não deve derrubar o túnel junto.
  let iface = null;
  let ip = '127.0.0.1';
  try {
    iface = descobrirInterface();
    ip = descobrirIp(iface);
    console.log(`   interface ativa: ${iface} · IP: ${ip}`);
  } catch (e) {
    if (!TUNEL) throw e;
    console.log(`   sem IP de LAN utilizável (${e.message.split('.')[0]}).`);
  }
  if (TUNEL) console.log('   modo túnel: o IP da LAN é só informação — quem serve é o cloudflared.');

  passo(2, 'Porta da API');
  const { porta, ocupadas } = escolherPorta();
  for (const o of ocupadas) {
    console.log(`   porta ${o.porta} ocupada por ${o.comando} (pid ${o.pid}).`);
  }
  console.log(`   API vai subir na porta ${porta}${porta !== PRIMEIRA_PORTA ? ' — não é a 8001, a convenção do projeto' : ''}.`);

  // No modo LAN o `.env` já pode ser escrito: o endereço final é conhecido.
  // No modo túnel ele espera a URL do cloudflared, que só existe depois da API
  // de pé — ver a ordem explicada no topo do arquivo.
  if (!TUNEL) {
    passo(3, '.env do app');
    sincronizarEnvApp(`http://${ip}:${porta}`);
  }

  passo(TUNEL ? 3 : 4, 'Banco de dados');
  let banco;
  let dbUrlExtra = null;
  if (dockerDisponivel()) {
    console.log('   Docker respondeu — subindo Postgres via docker compose.');
    subirPostgres();
    await aguardarPostgresSaudavel();
    console.log('   Postgres healthy. Rodando `alembic upgrade head`...');
    rodarAlembic();
    banco = 'postgres';
    console.log('   Postgres pronto e migrado.');
  } else {
    prepararSqlite();
    dbUrlExtra = SQLITE_URL;
    banco = 'sqlite';
  }

  passo(TUNEL ? 4 : 5, 'Chave de sessão (JWT)');
  const jwtGerado = obterSegredoJwt();

  const criadoEm = new Date().toISOString();
  const base = { criadoEm, ip, porta, banco, apiLog: API_LOG, metroLog: METRO_LOG, tunel: TUNEL };

  passo(TUNEL ? 5 : 6, 'Subindo a API');
  const apiPid = subirApi(porta, dbUrlExtra, jwtGerado, { semLlm: SEM_LLM });
  console.log(`   uvicorn em pid ${apiPid}, log em ${relative(ROOT, API_LOG)}`);
  if (SEM_LLM) console.log('   --sem-llm: chaves de LLM vazias — a leitura de documento vai responder que não está configurada.');
  gravarEstado({ ...base, apiPid, metroPid: null });

  // A URL que o app vai usar. No modo LAN é o IP; no túnel, o que o
  // cloudflared sortear.
  let apiUrl = `http://${ip}:${porta}`;
  let cloudflaredPid = null;

  if (TUNEL) {
    passo(6, 'Abrindo o túnel da API');
    cloudflaredPid = subirCloudflared(porta);
    console.log(`   cloudflared em pid ${cloudflaredPid}, log em ${relative(ROOT, TUNEL_LOG)}`);
    apiUrl = await aguardarNoLog(TUNEL_LOG, /https:\/\/[a-z0-9-]+\.trycloudflare\.com/, {
      timeoutMs: 60000,
      oQue: 'a URL do quick tunnel',
      aviso: '   ainda esperando o cloudflared publicar a URL...',
    });
    console.log(`   API pública em ${apiUrl}`);
    gravarEstado({ ...base, apiPid, metroPid: null, cloudflaredPid, apiUrl });

    passo(7, '.env do app');
    sincronizarEnvApp(apiUrl);
    console.log('   (é esta URL que vai embutida no bundle — por isso o Metro só sobe agora)');
  }

  passo(TUNEL ? 8 : 7, 'Subindo o Metro');
  const metroPid = subirMetro({ tunel: TUNEL });
  console.log(`   expo start${TUNEL ? ' --tunnel' : ''} em pid ${metroPid}, log em ${relative(ROOT, METRO_LOG)}`);
  gravarEstado({ ...base, apiPid, metroPid, cloudflaredPid, apiUrl });

  let caffeinatePid = null;
  let expUrl = `exp://${ip}:8081`;

  if (TUNEL) {
    caffeinatePid = manterAcordado();
    console.log(`   caffeinate em pid ${caffeinatePid} — o Mac não dorme enquanto o túnel está no ar.`);

    passo(9, 'Esperando o endereço do Expo');
    expUrl = await aguardarUrlDoExpo({
      timeoutMs: 180000,
      aviso: '   ainda esperando o túnel do Expo publicar o endereço...',
    });
    console.log(`   Expo Go em ${expUrl}`);
    gravarEstado({ ...base, apiPid, metroPid, cloudflaredPid, caffeinatePid, apiUrl, expUrl });
  }

  passo(TOTAL_PASSOS, 'Conferindo');
  // No modo túnel, a conferência pode falhar por um motivo que NÃO é o túnel:
  // este Mac. VPN corporativa costuma resolver DNS por servidor interno, e ele
  // devolve NXDOMAIN para `trycloudflare.com` — o celular, fora da VPN,
  // resolve normalmente. Por isso, quando o cloudflared registrou a conexão, o
  // script diz o que está acontecendo e segue, em vez de derrubar um ambiente
  // que está de pé.
  let apiConferida = true;
  try {
    await aguardarUrl(`${apiUrl}/v1/dividas`, {
      statusEsperado: 401,
      // No túnel a paciência é menor de propósito: se o nome não resolve aqui,
      // insistir não muda nada, e o caminho por DoH abaixo responde melhor e
      // mais rápido do que esperar um DNS que nunca vai responder.
      timeoutMs: TUNEL ? 25000 : 30000,
      aviso: '   ainda esperando a API responder...',
    });
    console.log(`   GET ${apiUrl}/v1/dividas -> 401 (esperado, sem token) OK`);

    await aguardarUrl(`${apiUrl}/exclusao`, { statusEsperado: 200, timeoutMs: 15000 });
    console.log('   GET /exclusao -> 200 OK');
  } catch (e) {
    const registrou =
      existsSync(TUNEL_LOG) && readFileSync(TUNEL_LOG, 'utf8').includes('Registered tunnel connection');
    if (!TUNEL || !registrou) throw e;
    console.log(`   este Mac não alcançou a URL (${e.message.split('(')[0].trim()}).`);
    console.log('   O cloudflared registrou a conexão, então vou conferir por fora do DNS local...');
    try {
      const ip = await conferirPorDoH(`${apiUrl}/v1/dividas`, 401);
      await conferirPorDoH(`${apiUrl}/exclusao`, 200);
      console.log(`   pela internet (edge ${ip}): /v1/dividas -> 401 e /exclusao -> 200 OK`);
      console.log('   Ou seja: o túnel serve. Quem não resolve o nome é este Mac — DNS da VPN.');
      console.log('   Do celular, fora da VPN, funciona.');
    } catch (e2) {
      apiConferida = false;
      console.log(`   também não deu por DoH: ${e2.message}`);
      console.log('   A API responde localmente, mas não consegui provar que ela serve de fora:');
      await aguardarUrl(`http://127.0.0.1:${porta}/v1/dividas`, { statusEsperado: 401, timeoutMs: 15000 });
      console.log(`   GET http://127.0.0.1:${porta}/v1/dividas -> 401 OK`);
    }
  }

  console.log('   compilando o primeiro bundle do Metro — isto demora, aguarde...');
  // No modo LAN, conferir pelo IP da rede é a decisão declarada no topo: é o
  // endereço que o celular usa. No túnel, quem o celular usa é o ngrok, e o
  // que interessa provar aqui é só que o Metro compilou — daí o 127.0.0.1,
  // que não depende de haver LAN.
  const hostBundle = TUNEL ? '127.0.0.1' : ip;
  await aguardarUrl(`http://${hostBundle}:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true`, {
    statusEsperado: 200,
    timeoutMs: 180000,
    intervalMs: 3000,
    aviso: '   ainda compilando o bundle...',
  });
  console.log('   GET do bundle do Metro -> 200 OK');

  console.log('\nTudo no ar.');
  console.log(`  Expo Go:   ${expUrl}`);
  console.log(`  API:       ${apiUrl}`);
  console.log(`  Banco:     ${banco}${banco === 'sqlite' ? ' (fallback — Postgres é o gate de release)' : ''}`);
  console.log(`  Log API:   ${API_LOG}`);
  console.log(`  Log Metro: ${METRO_LOG}`);
  if (TUNEL) console.log(`  Log túnel: ${TUNEL_LOG}`);

  if (TUNEL) {
    if (!(await mostrarQr(expUrl))) {
      console.log('\n(não consegui desenhar o QR — use o endereço acima)');
    }
    console.log('\nNo iPhone: escaneie o QR pela câmera, ou abra o link acima no Expo Go.');
    console.log('As duas URLs morrem com os processos: cada `tunel:up` sorteia endereços novos.');
    if (!apiConferida) {
      console.log(
        '\nNão consegui confirmar a API pela URL pública deste Mac (veja acima). Se o app no\n' +
          'celular também não achar a API, aí sim é o túnel — o log está em ' +
          `${relative(ROOT, TUNEL_LOG)}.`,
      );
    }
    if (!SEM_LLM) {
      console.log(
        '\nEnquanto o túnel estiver no ar, sua API de desenvolvimento está na internet e a\n' +
          'leitura de documento gasta sua chave de LLM. Para testar sem esse risco, derrube e\n' +
          'suba com `npm run tunel:up -- --sem-llm`.',
      );
    }
    console.log('\nO Mac não vai dormir sozinho, mas fechar a tampa ainda derruba tudo.');
    console.log('Para encerrar: npm run local:down');
  }
}

main().catch((e) => {
  console.error(`\nParou: ${e.message}`);
  process.exit(1);
});
