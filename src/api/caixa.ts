import { request } from './client';
import type {
  Caixa,
  FonteRenda,
  ItemConfirmado,
  PropostaFechamento,
  Gasto,
  MetasCaixa,
  ProvisaoAnual,
  Recebimento,
  SnapshotCaixa,
  Uuid,
} from './types';

/**
 * Módulo de caixa (M7).
 *
 * A cascata inteira — imposto, custo de vida, provisões, potes e as duas
 * capacidades — vem calculada de `GET /v1/caixa`. O app não soma nada:
 * capacidade é a restrição de tudo que o produto propõe, e duas somas do mesmo
 * dado divergiriam no arredondamento (ADR 0003).
 */
export function getCaixa() {
  return request<{ caixa: Caixa }>('/v1/caixa');
}

export function getHistoricoCaixa() {
  return request<{ snapshots: SnapshotCaixa[] }>('/v1/caixa/historico');
}

/* --- Fontes de renda --- */

export type NovaFonteRenda = Omit<FonteRenda, 'id'>;

export function listarFontes() {
  return request<{ fontes: FonteRenda[] }>('/v1/caixa/fontes');
}

export function criarFonte(fonte: NovaFonteRenda) {
  return request<{ fonte: FonteRenda }>('/v1/caixa/fontes', { method: 'POST', body: fonte });
}

export function atualizarFonte(id: Uuid, patch: Partial<NovaFonteRenda>) {
  return request<{ fonte: FonteRenda }>(`/v1/caixa/fontes/${id}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function excluirFonte(id: Uuid) {
  return request<void>(`/v1/caixa/fontes/${id}`, { method: 'DELETE' });
}

/**
 * O que de fato caiu no mês. Reenviar o mesmo mês SOBRESCREVE — corrigir um
 * valor digitado errado é o caso comum.
 */
export function registrarRecebimento(fonteId: Uuid, mes: string, valor: number) {
  return request<{ recebimento: Recebimento }>(`/v1/caixa/fontes/${fonteId}/recebimentos`, {
    method: 'POST',
    body: { mes, valor },
  });
}

/* --- Gastos --- */

export type NovoGasto = Omit<Gasto, 'id'>;

export function listarGastos() {
  return request<{ gastos: Gasto[] }>('/v1/caixa/gastos');
}

export function criarGasto(gasto: NovoGasto) {
  return request<{ gasto: Gasto }>('/v1/caixa/gastos', { method: 'POST', body: gasto });
}

export function atualizarGasto(id: Uuid, patch: Partial<NovoGasto>) {
  return request<{ gasto: Gasto }>(`/v1/caixa/gastos/${id}`, { method: 'PATCH', body: patch });
}

export function excluirGasto(id: Uuid) {
  return request<void>(`/v1/caixa/gastos/${id}`, { method: 'DELETE' });
}

/* --- Provisões anuais --- */

/** `aporteMensal` e `mesesRestantes` são derivados no servidor, não enviados. */
export type NovaProvisao = Omit<ProvisaoAnual, 'id' | 'aporteMensal' | 'mesesRestantes'>;

export function listarProvisoes() {
  return request<{ provisoes: ProvisaoAnual[] }>('/v1/caixa/provisoes');
}

export function criarProvisao(provisao: NovaProvisao) {
  return request<{ provisao: ProvisaoAnual }>('/v1/caixa/provisoes', {
    method: 'POST',
    body: provisao,
  });
}

export function atualizarProvisao(id: Uuid, patch: Partial<NovaProvisao>) {
  return request<{ provisao: ProvisaoAnual }>(`/v1/caixa/provisoes/${id}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function excluirProvisao(id: Uuid) {
  return request<void>(`/v1/caixa/provisoes/${id}`, { method: 'DELETE' });
}

/* --- Metas --- */

export function getMetas() {
  return request<{ metas: MetasCaixa }>('/v1/caixa/metas');
}

/** `null` GRAVA ausência — é como o usuário desfaz uma meta. */
export function updateMetas(metas: MetasCaixa) {
  return request<{ metas: MetasCaixa }>('/v1/caixa/metas', { method: 'PUT', body: metas });
}

/* --- Fechamento do mês --- */

/**
 * A proposta pré-preenchida. PROPÕE, não grava: quem confirma é o usuário, no
 * POST abaixo. Replicar em silêncio faria um número que ninguém conferiu entrar
 * na capacidade — e daí no plano que ele leva a um credor.
 */
export function getFechamento(mes?: string) {
  const query = mes ? `?mes=${encodeURIComponent(mes)}` : '';
  return request<{ proposta: PropostaFechamento }>(`/v1/caixa/fechamento${query}`);
}

/** Só o que vai em `itens` é gravado. Item omitido não vira zero. */
export function confirmarFechamento(mes: string, itens: readonly ItemConfirmado[]) {
  return request<{ caixa: Caixa }>('/v1/caixa/fechamento', {
    method: 'POST',
    body: { mes, itens },
  });
}
