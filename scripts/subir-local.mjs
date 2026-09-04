#!/usr/bin/env node
/**
 * `npm run local:up` — sobe Postgres (ou SQLite), API e Metro de uma vez.
 *
 *     npm run local:up                 # ou: node scripts/subir-local.mjs
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
const SQLITE_URL = 'sqlite+pysqlite:///./devonada-local.db';
const PRIMEIRA_PORTA = 8001;
const ULTIMA_PORTA = 8010;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function passo(n, titulo) {
  console.log(`\n[${n}/8] ${titulo}`);
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

function sincronizarEnvApp(ip, porta) {
  const valorDesejado = `http://${ip}:${porta}`;
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

function subirApi(porta, dbUrlExtra, jwtSecret) {
  mkdirSync(LOG_DIR, { recursive: true });
  const logFd = openSync(API_LOG, 'a');
  const env = { ...process.env };
  if (dbUrlExtra) env.DEVONADA_DATABASE_URL = dbUrlExtra;
  if (jwtSecret) env.DEVONADA_JWT_SECRET = jwtSecret;
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

function subirMetro() {
  mkdirSync(LOG_DIR, { recursive: true });
  const logFd = openSync(METRO_LOG, 'a');
  const processo = spawn('npx', ['expo', 'start'], { cwd: ROOT, detached: true, stdio: ['ignore', logFd, logFd] });
  processo.unref();
  return processo.pid;
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
  console.log('Subindo o ambiente local do devo.nada...');

  passo(1, 'Rede');
  const iface = descobrirInterface();
  const ip = descobrirIp(iface);
  console.log(`   interface ativa: ${iface} · IP: ${ip}`);

  passo(2, 'Porta da API');
  const { porta, ocupadas } = escolherPorta();
  for (const o of ocupadas) {
    console.log(`   porta ${o.porta} ocupada por ${o.comando} (pid ${o.pid}).`);
  }
  console.log(`   API vai subir na porta ${porta}${porta !== PRIMEIRA_PORTA ? ' — não é a 8001, a convenção do projeto' : ''}.`);

  passo(3, '.env do app');
  sincronizarEnvApp(ip, porta);

  passo(4, 'Banco de dados');
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

  passo(5, 'Chave de sessão (JWT)');
  const jwtGerado = obterSegredoJwt();

  const criadoEm = new Date().toISOString();

  passo(6, 'Subindo a API');
  const apiPid = subirApi(porta, dbUrlExtra, jwtGerado);
  console.log(`   uvicorn em pid ${apiPid}, log em ${relative(ROOT, API_LOG)}`);
  gravarEstado({ criadoEm, ip, porta, banco, apiPid, metroPid: null, apiLog: API_LOG, metroLog: METRO_LOG });

  passo(7, 'Subindo o Metro');
  const metroPid = subirMetro();
  console.log(`   expo start em pid ${metroPid}, log em ${relative(ROOT, METRO_LOG)}`);
  gravarEstado({ criadoEm, ip, porta, banco, apiPid, metroPid, apiLog: API_LOG, metroLog: METRO_LOG });

  passo(8, 'Conferindo');
  await aguardarUrl(`http://${ip}:${porta}/v1/dividas`, {
    statusEsperado: 401,
    timeoutMs: 30000,
    aviso: '   ainda esperando a API subir...',
  });
  console.log('   GET /v1/dividas -> 401 (esperado, sem token) OK');

  await aguardarUrl(`http://${ip}:${porta}/exclusao`, { statusEsperado: 200, timeoutMs: 10000 });
  console.log('   GET /exclusao -> 200 OK');

  console.log('   compilando o primeiro bundle do Metro — isto demora, aguarde...');
  await aguardarUrl(`http://${ip}:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true`, {
    statusEsperado: 200,
    timeoutMs: 180000,
    intervalMs: 3000,
    aviso: '   ainda compilando o bundle...',
  });
  console.log('   GET do bundle do Metro -> 200 OK');

  console.log('\nTudo no ar.');
  console.log(`  Expo Go:   exp://${ip}:8081`);
  console.log(`  API:       http://${ip}:${porta}`);
  console.log(`  Banco:     ${banco}${banco === 'sqlite' ? ' (fallback — Postgres é o gate de release)' : ''}`);
  console.log(`  Log API:   ${API_LOG}`);
  console.log(`  Log Metro: ${METRO_LOG}`);
}

main().catch((e) => {
  console.error(`\nParou: ${e.message}`);
  process.exit(1);
});
