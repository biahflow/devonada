#!/usr/bin/env node
/**
 * Imprime um QR que entrega o token do beta ao aparelho.
 *
 * POR QUE ISTO EXISTE: `BUDDY_API_TOKEN` tem 43 caracteres
 * (`secrets.token_urlsafe(32)`), e a única forma de colocá-lo no celular era
 * digitar à mão na tela de Conexão. Ninguém digita isso certo, e quem desiste
 * fica com o app em 401 achando que a "sessão expirou". A câmera nativa do
 * celular lê este QR e abre o app já com o token — sem scanner embutido, sem
 * permissão de câmera, sem digitação.
 *
 * O token NÃO é impresso em texto: guardrail de `docs/guardrails.md` (token
 * nunca em log). Só o QR vai para a tela.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Leitor de .env deliberadamente burro: só `CHAVE=valor`, sem aspas nem expansão. */
function lerEnv(caminho) {
  let bruto;
  try {
    bruto = readFileSync(caminho, 'utf8');
  } catch {
    return null;
  }
  const vars = {};
  for (const linha of bruto.split('\n')) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith('#')) continue;
    const igual = limpa.indexOf('=');
    if (igual === -1) continue;
    vars[limpa.slice(0, igual).trim()] = limpa.slice(igual + 1).trim();
  }
  return vars;
}

function morrer(mensagem) {
  console.error(`\n  ${mensagem}\n`);
  process.exit(1);
}

const backend = lerEnv(join(raiz, 'backend', '.env'));
if (!backend) {
  morrer('Não achei backend/.env. Copie o backend/.env.example e preencha o BUDDY_API_TOKEN.');
}

const token = backend.BUDDY_API_TOKEN;
if (!token) {
  morrer(
    'BUDDY_API_TOKEN está vazio em backend/.env. Gere um valor com:\n' +
      '    python -c "import secrets; print(secrets.token_urlsafe(32))"',
  );
}

const expoGo = process.argv.includes('--expo-go');
const rota = 'painel/token';
const query = `valor=${encodeURIComponent(token)}`;

let url;
let comoUsar;

if (expoGo) {
  // Em Expo Go o scheme do app não está registrado — quem atende é o próprio
  // Expo Go, no formato exp://host:porta/--/rota. O host sai da URL da API,
  // que já aponta para esta máquina na LAN.
  const app = lerEnv(join(raiz, '.env')) ?? {};
  const base = app.EXPO_PUBLIC_API_BASE_URL;
  if (!base) {
    morrer('Para --expo-go eu preciso de EXPO_PUBLIC_API_BASE_URL no .env da raiz.');
  }
  let host;
  try {
    host = new URL(base).hostname;
  } catch {
    morrer(`EXPO_PUBLIC_API_BASE_URL não é uma URL válida: ${base}`);
  }
  url = `exp://${host}:8081/--/${rota}?${query}`;
  comoUsar = `Expo Go em ${host}. Se o Metro não estiver na 8081, este QR não abre.`;
} else {
  url = `buddyfinanceiro://${rota}?${query}`;
  comoUsar = 'Dev build ou app instalado. Em Expo Go, rode com --expo-go.';
}

console.log('\n  Aponte a CÂMERA do celular para o QR abaixo e toque na notificação.');
console.log(`  ${comoUsar}\n`);
qrcode.generate(url, { small: true }, (qr) => console.log(qr));
console.log('  O token vai dentro do QR e não é impresso aqui.\n');
