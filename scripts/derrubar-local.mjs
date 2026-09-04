#!/usr/bin/env node
/**
 * `npm run local:down` — para a API e o Metro subidos por `subir-local.mjs`.
 *
 *     npm run local:down                # para API e Metro; Postgres fica de pé
 *     npm run local:down -- --tudo      # idem, e também para o Postgres (docker compose stop)
 *
 * Duas decisões deliberadas, e as duas protegem dado do usuário:
 *
 * 1. **Postgres só para com `--tudo`.** Container é lento de subir de novo (o
 *    healthcheck de `docker-compose.yml` espera até 50s), e quem roda
 *    `local:down` normalmente quer parar de servir, não perder o ambiente.
 * 2. **Nunca apaga banco.** Nem `backend/devonada-local.db` (o fallback
 *    SQLite), nem o volume `devonada_pgdata` do Postgres — mesmo com
 *    `--tudo`, que só faz `docker compose stop`, nunca `down -v`. Perder o
 *    banco de desenvolvimento derruba a conta de teste junto, e essa não é
 *    decisão de um script que só quer parar de servir.
 *
 * Prefere o pid gravado em `.local-run.json` por `subir-local.mjs`. Sem esse
 * arquivo, cai para procurar pelo padrão de comando (`uvicorn main:app`,
 * `expo start`) e avisa que está fazendo isso — os dois processos que
 * `subir-local.mjs` sobe são filhos de um wrapper (`uv run ...`, `npm exec
 * ...`) cujo nome também contém o padrão, então a varredura pega as duas
 * pontas.
 *
 * O sinal vai para o GRUPO de processos (pid negativo), não só para o pid
 * gravado: `subir-local.mjs` sobe os dois com `detached: true`, o que os
 * torna líder de um novo grupo — e é isso que garante que o processo
 * `uvicorn` de verdade (filho do `uv run`) e os workers do Metro morrem
 * junto, não só o wrapper. Quando o pid não é líder de grupo (o caso comum da
 * varredura por padrão), cai para sinalizar o pid direto.
 *
 * Sai com código 0 mesmo quando não havia nada rodando — parar o que já está
 * parado não é erro.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = join(ROOT, 'backend');
const LOCAL_RUN_PATH = join(ROOT, '.local-run.json');

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function lerEstado() {
  if (!existsSync(LOCAL_RUN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LOCAL_RUN_PATH, 'utf8'));
  } catch {
    console.log(`Não consegui ler ${LOCAL_RUN_PATH} — ignorando e caindo para busca por padrão de processo.`);
    return null;
  }
}

function processoVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function pararProcesso(pid, nome) {
  if (!pid) return;
  if (!processoVivo(pid)) {
    console.log(`${nome}: pid ${pid} já não está rodando.`);
    return;
  }
  try {
    // pid negativo = sinal para o grupo inteiro (ver docstring).
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (e2) {
      console.log(`${nome}: não consegui sinalizar o pid ${pid} (${e2.message}).`);
      return;
    }
  }
  const inicio = Date.now();
  while (Date.now() - inicio < 8000) {
    if (!processoVivo(pid)) {
      console.log(`${nome}: parado (pid ${pid}).`);
      return;
    }
    await esperar(300);
  }
  console.log(`${nome}: pid ${pid} ainda de pé depois de 8s — pode precisar de \`kill -9 ${pid}\` manual.`);
}

function pidsPorPadrao(padrao) {
  try {
    const saida = execFileSync('pgrep', ['-f', padrao], { encoding: 'utf8' });
    return saida
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

async function main() {
  const tudo = process.argv.includes('--tudo');
  console.log('Derrubando o ambiente local do devo.nada...\n');

  const estado = lerEstado();

  if (estado) {
    await pararProcesso(estado.apiPid, 'API');
    await pararProcesso(estado.metroPid, 'Metro');
  } else {
    console.log(`Não achei ${LOCAL_RUN_PATH} — procurando processos pelo padrão de comando.`);
    const apiPids = pidsPorPadrao('uvicorn main:app');
    const metroPids = pidsPorPadrao('expo start');
    for (const pid of apiPids) {
      await pararProcesso(pid, 'API');
    }
    for (const pid of metroPids) {
      await pararProcesso(pid, 'Metro');
    }
    if (apiPids.length === 0 && metroPids.length === 0) {
      console.log('Nenhum processo de API ou Metro encontrado — já estava tudo parado.');
    }
  }

  console.log('');
  if (tudo) {
    console.log('--tudo: parando o Postgres também (`docker compose stop`; o volume de dados fica de pé).');
    try {
      execFileSync('docker', ['compose', 'stop'], { cwd: BACKEND, stdio: 'inherit' });
    } catch (e) {
      console.log(`Não consegui parar o Postgres via docker compose: ${e.message}`);
    }
  } else {
    console.log(
      'Postgres fica de pé (passe --tudo para derrubar também). Container é lento de subir de novo, ' +
        'e quem roda `local:down` normalmente quer parar de servir, não perder o ambiente.',
    );
  }

  if (existsSync(LOCAL_RUN_PATH)) {
    rmSync(LOCAL_RUN_PATH);
  }

  console.log('\nAmbiente derrubado. Nenhum banco foi apagado.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`Erro inesperado: ${e.message}`);
    process.exit(1);
  });
