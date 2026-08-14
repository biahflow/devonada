import { request } from './client';
import type { Meta, MetaPatch, NovaMeta, Uuid } from './types';

/**
 * Metas nomeadas — a "Rota de Chegada" da fase verde.
 *
 * NÃO É `/v1/caixa/metas` (`getMetas` em `api/caixa.ts`). Aquele guarda os seis
 * potes fixos do perfil que entram na cascata do fechamento; este é a coleção
 * livre da aba Metas. Ver ADR 0017.
 *
 * `aporteSugerido` e `status` chegam prontos e não são recalculados aqui — eles
 * dependem do mês em que a pergunta é feita, e duas contas do mesmo dado
 * divergiriam no arredondamento (ADR 0003).
 */
export function listMetas() {
  return request<{ metas: Meta[] }>('/v1/metas');
}

export function createMeta(input: NovaMeta) {
  return request<{ meta: Meta }>('/v1/metas', { method: 'POST', body: input });
}

/** `null` GRAVA ausência — é como o usuário remove o prazo ou o aporte. */
export function updateMeta(id: Uuid, patch: MetaPatch) {
  return request<{ meta: Meta }>(`/v1/metas/${id}`, { method: 'PATCH', body: patch });
}

export function deleteMeta(id: Uuid) {
  return request<void>(`/v1/metas/${id}`, { method: 'DELETE' });
}
