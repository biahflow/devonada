import { env } from '../config/env';
import { esquecerSessao, guardarSessao, tokenDeAcesso, tokenDeRenovacao } from './sessao';
import type { RespostaSessao } from './types';

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

/*
 * `isAuthError` foi removido no M8.
 *
 * Ele existia para as telas oferecerem "configurar conexão" quando faltava o
 * token do beta. Agora um 401 é tratado aqui — renovação silenciosa — e, quando
 * ela falha, a sessão cai e o `_layout` leva ao login. Nenhuma tela decide o que
 * fazer com 401, e é por isso que o predicado não faz mais falta.
 *
 * `ehPaywall` (M9) NÃO É A VOLTA DAQUELE PADRÃO, e a diferença é o motivo pelo
 * qual o outro saiu. O 401 tem uma resposta só, sempre a mesma, e por isso ela
 * pertence a este arquivo. O 402 não tem: a resposta certa depende de qual
 * escrita a pessoa tentou — cadastrar uma dívida, fechar o mês, mandar uma
 * mensagem —, e só a tela sabe disso. Um tratamento central aqui teria de
 * adivinhar, e adivinharia navegando para longe do que o usuário estava
 * fazendo.
 */

/**
 * `402 Payment Required`: o período de teste acabou e a escrita está travada.
 *
 * Nunca acontece em leitura — o servidor não bloqueia GET —, então quem chama
 * isto está tratando o erro de uma mutação.
 */
export function ehPaywall(erro: unknown): boolean {
  return erro instanceof ApiError && erro.status === 402;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Para as rotas de `src/api/auth.ts`. Renovar antes de existir sessão não faz
   * sentido, e o 401 de credencial errada não é sessão vencida — tratá-lo como
   * tal apagaria a sessão de quem só errou a senha na tela de login.
   */
  semRenovacao?: boolean;
}

/**
 * A renovação em voo, compartilhada por TODAS as requisições.
 *
 * É a peça mais importante deste arquivo. Sem ela, o app abre, dez telas
 * montam juntas com o access vencido, e cada uma chama `/refresh` com o mesmo
 * valor. O servidor rotaciona a cada uso (ADR 0012), então a primeira ganha um
 * par novo e as outras nove levam 401 com um refresh que acabou de ser
 * revogado — a sessão morre no boot, e o usuário vê a tela de login sem ter
 * feito nada.
 *
 * Com a promise compartilhada, a primeira falha de 401 cria a renovação e as
 * outras esperam nela.
 */
let renovacaoEmVoo: Promise<boolean> | null = null;

async function renovarSessao(): Promise<boolean> {
  const refresh = await tokenDeRenovacao();
  if (!refresh) {
    await esquecerSessao();
    return false;
  }

  try {
    // `fetch` cru de propósito: passar por `request` faria o 401 desta rota
    // disparar outra renovação, que chamaria esta rota de novo.
    const res = await fetch(`${env.apiBaseUrl}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });

    if (!res.ok) {
      // Refresh recusado é fim de sessão: expirou, foi revogado por logout,
      // pela troca de senha, ou foi rotacionado por outra cópia.
      await esquecerSessao();
      return false;
    }

    const { sessao } = (await res.json()) as RespostaSessao;
    await guardarSessao(sessao);
    return true;
  } catch {
    // Falha de REDE não é fim de sessão. Derrubar aqui deslogaria quem entrou
    // no elevador, e a credencial dele continua boa.
    return false;
  }
}

function renovar(): Promise<boolean> {
  if (renovacaoEmVoo === null) {
    renovacaoEmVoo = renovarSessao().finally(() => {
      renovacaoEmVoo = null;
    });
  }
  return renovacaoEmVoo;
}

async function cabecalhos(extras: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await tokenDeAcesso();
  return token ? { ...extras, Authorization: `Bearer ${token}` } : extras;
}

/**
 * Único ponto de saída de rede do app. Anexa o Bearer token, serializa JSON,
 * renova a sessão quando ela vence, e normaliza erros. Nenhuma chamada de LLM
 * passa por aqui — o app só conhece a SUA API.
 */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const enviar = async () =>
    fetch(`${env.apiBaseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers: await cabecalhos({ 'Content-Type': 'application/json' }),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });

  let res: Response;
  try {
    res = await enviar();
  } catch (e) {
    throw new ApiError(0, 'Sem conexão com o servidor. Confira sua internet e tente de novo.', e);
  }

  // UMA tentativa de renovação, e uma repetição. Repetir de novo insistiria com
  // uma credencial que o servidor acabou de recusar duas vezes.
  if (res.status === 401 && !opts.semRenovacao && (await renovar())) {
    try {
      res = await enviar();
    } catch (e) {
      throw new ApiError(0, 'Sem conexão com o servidor. Confira sua internet e tente de novo.', e);
    }
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
  const montarCorpo = () => {
    const form = new FormData();
    // O React Native aceita este formato de "arquivo" no FormData; não é um Blob.
    form.append('arquivo', {
      uri: arquivo.uri,
      name: arquivo.nome,
      type: arquivo.mimeType,
    } as unknown as Blob);
    return form;
  };

  // O corpo é remontado na repetição: um FormData já consumido pelo fetch não
  // se reenvia, e reusá-lo mandaria um corpo vazio depois da renovação.
  const enviar = async () =>
    fetch(`${env.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: await cabecalhos(),
      body: montarCorpo(),
      signal: opts.signal,
    });

  let res: Response;
  try {
    res = await enviar();
  } catch (e) {
    throw new ApiError(0, 'Sem conexão com o servidor. Confira sua internet e tente de novo.', e);
  }

  if (res.status === 401 && (await renovar())) {
    try {
      res = await enviar();
    } catch (e) {
      throw new ApiError(0, 'Sem conexão com o servidor. Confira sua internet e tente de novo.', e);
    }
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
