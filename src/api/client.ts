import * as SecureStore from 'expo-secure-store';
import { env } from '../config/env';

const TOKEN_KEY = 'auth_token';

/** Erro tipado — a UI decide como exibir a partir de status + message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 401 aqui não é "sessão expirou": o beta usa um token estático, e o backend
 * responde 401 tanto para token ausente quanto para token diferente do dele.
 * Em ambos os casos a saída é a mesma — reconfigurar a conexão. O predicado
 * mora junto do ApiError para que nenhuma tela precise comparar `status === 401`
 * por conta própria e errar o número.
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Único ponto de saída de rede do app. Anexa o Bearer token, serializa JSON,
 * e normaliza erros. Nenhuma chamada de LLM passa por aqui — o app só conhece
 * a SUA API.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    throw new ApiError(0, 'Sem conexão com o servidor. Confira sua internet e tente de novo.', e);
  }

  return parseResposta<T>(res);
}

/** Corpo e erro são normalizados no mesmo lugar para JSON e para multipart. */
async function parseResposta<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : `Erro ${res.status}.`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}

interface ArquivoUpload {
  uri: string;
  nome: string;
  mimeType: string;
}

/**
 * Upload multipart. Vive aqui, e não numa chamada solta, porque o egress único
 * é guardrail (docs/guardrails.md, seção 2) — e documento sensível é o último
 * lugar onde abrir exceção.
 *
 * NÃO defina Content-Type manualmente: o runtime precisa gerar o boundary do
 * multipart. Definir a mão produz um corpo que o servidor não consegue separar.
 */
export async function upload<T>(
  path: string,
  arquivo: ArquivoUpload,
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const form = new FormData();
  // O React Native aceita este formato de "arquivo" no FormData; não é um Blob.
  form.append('arquivo', {
    uri: arquivo.uri,
    name: arquivo.nome,
    type: arquivo.mimeType,
  } as unknown as Blob);

  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      method: 'POST',
      headers,
      body: form,
      signal: opts.signal,
    });
  } catch (e) {
    throw new ApiError(0, 'Sem conexão com o servidor. Confira sua internet e tente de novo.', e);
  }

  return parseResposta<T>(res);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
