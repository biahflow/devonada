import { request } from './client';
import type {
  Caixa,
  EventoPrevisivel,
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

/* --- Eventos previsíveis (F-011, ADR 0021, decisão 2) --- */

export type NovoEventoPrevisivel = Omit<EventoPrevisivel, 'id'>;

/**
 * 13º, férias e o que mais cai uma vez por ano. NÃO ENTRA NA CASCATA — gravar um
 * evento não muda nenhum número de `GET /v1/caixa`. O valor é declarado pelo
 * usuário; nenhum 13º é projetado a partir da renda (ADR 0009).
 */
export function listarEventosPrevisiveis() {
  return request<{ eventos: EventoPrevisivel[] }>('/v1/caixa/eventos-previsiveis');
}

export function criarEventoPrevisivel(evento: NovoEventoPrevisivel) {
  return request<{ evento: EventoPrevisivel }>('/v1/caixa/eventos-previsiveis', {
    method: 'POST',
    body: evento,
  });
}

export function atualizarEventoPrevisivel(id: Uuid, patch: Partial<NovoEventoPrevisivel>) {
  return request<{ evento: EventoPrevisivel }>(`/v1/caixa/eventos-previsiveis/${id}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function excluirEventoPrevisivel(id: Uuid) {
  return request<void>(`/v1/caixa/eventos-previsiveis/${id}`, { method: 'DELETE' });
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

/* --- Respiro (M11, ADR 0019) --- */

/**
 * O que o USUÁRIO declara — SEM DEFAULT, SEM FAIXA E SEM SUGESTÃO (ADR 0019,
 * item 2). Um percentual de fábrica seria o coeficiente de alocação sem fonte
 * que a ADR 0009 proíbe pelo nome.
 */
export interface RespiroInput {
  /** Em centavos. */
  valorMensal: number;
  ativo?: boolean;
}

/** A linha gravada. `saldoAcumulado` é persistido; o disponível do mês não — ele viaja em `Caixa`. */
export interface Respiro {
  valorMensal: number;
  ativo: boolean;
  saldoAcumulado: number;
}

export interface RespostaRespiro {
  respiro: Respiro;
  /**
   * O PREÇO da escolha, em meses a mais de quitação — a mesma
   * `domain/simulacao.py` do M4 rodada duas vezes, não estimativa nova.
   * `null` quando não há dívida com dado suficiente para simular: a tela grava
   * sem preço, em vez de exibir palpite.
   */
  custoEmMeses: number | null;
}

/**
 * Declara (ou atualiza) o respiro do mês. `ativo: false` PRESERVA o saldo
 * acumulado — desativar não é apagar.
 *
 * `422` quando o valor invade o piso legal (mínimo existencial). A mensagem já
 * vem pronta em pt-BR do servidor — a tela exibe, nunca reescreve.
 */
export function putRespiro(input: RespiroInput) {
  return request<RespostaRespiro>('/v1/caixa/respiro', { method: 'PUT', body: input });
}

export interface RespostaUsoDeRespiro {
  /** Existe porque o `DELETE` de uso é inalcançável sem ele — não há listagem. */
  id: Uuid;
  respiroDisponivelNoMes: number | null;
}

/**
 * Um gasto de respiro — o sorvete, o cinema, as unhas. `descricao` é opcional
 * e livre: ninguém deve prestação de contas do próprio lazer.
 *
 * A resposta NÃO carrega alerta, sinal de excesso nem comparação — só o novo
 * disponível e o id do lançamento (guardrail 4.1).
 */
export function registrarUsoDeRespiro(valor: number, descricao?: string) {
  return request<RespostaUsoDeRespiro>('/v1/caixa/respiro/uso', {
    method: 'POST',
    body: { valor, descricao },
  });
}

/**
 * Desfaz um uso — o caminho para um valor digitado errado. Exato mesmo quando
 * o uso tinha consumido o acumulado: registrar uso não escreve em
 * `saldoAcumulado`, então apagar não deixa resto para estornar.
 */
export function excluirUsoDeRespiro(id: Uuid) {
  return request<void>(`/v1/caixa/respiro/uso/${id}`, { method: 'DELETE' });
}

/**
 * Manda o saldo acumulado para aporte extra na dívida. SEMPRE por ação
 * explícita — nunca automático, nunca sugerido em push (ADR 0019, item 5).
 */
export function destinarRespiro(valor: number) {
  return request<{ respiroSaldoAcumulado: number }>('/v1/caixa/respiro/destinacao', {
    method: 'POST',
    body: { valor },
  });
}
