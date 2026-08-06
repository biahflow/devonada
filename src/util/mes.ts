import type { IsoMes } from '../api/types';

/**
 * Aritmética de calendário sobre a string `YYYY-MM`.
 *
 * Feita em inteiros, sem `Date`, pelo mesmo motivo de `src/util/date.ts`: o
 * construtor de Date carrega fuso, e uma dívida do mês 03 não pode virar 02
 * porque o aparelho está em outro fuso.
 *
 * `mesAtual()` lê o relógio e por isso NUNCA é chamada durante o render —
 * só na inicialização preguiçosa de estado ou em evento.
 */

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

function partes(mes: IsoMes): { ano: number; m: number } | null {
  const [ano, m] = mes.split('-').map(Number);
  if (!ano || !m || m < 1 || m > 12) return null;
  return { ano, m };
}

function montar(ano: number, m: number): IsoMes {
  return `${ano}-${String(m).padStart(2, '0')}`;
}

export function mesAtual(): IsoMes {
  const agora = new Date();
  return montar(agora.getFullYear(), agora.getMonth() + 1);
}

export function mesAnterior(mes: IsoMes): IsoMes {
  const p = partes(mes);
  if (!p) return mes;
  return p.m === 1 ? montar(p.ano - 1, 12) : montar(p.ano, p.m - 1);
}

export function mesSeguinte(mes: IsoMes): IsoMes {
  const p = partes(mes);
  if (!p) return mes;
  return p.m === 12 ? montar(p.ano + 1, 1) : montar(p.ano, p.m + 1);
}

/** Compara duas strings `YYYY-MM`: ordem lexicográfica já é ordem cronológica. */
export function ehAnterior(a: IsoMes, b: IsoMes): boolean {
  return a < b;
}

export function formatMes(mes: IsoMes): string {
  const p = partes(mes);
  if (!p) return mes;
  return `${MESES[p.m - 1]} de ${p.ano}`;
}

/** Curto, para o eixo do gráfico: "mar/24". */
export function formatMesCurto(mes: IsoMes): string {
  const p = partes(mes);
  if (!p) return mes;
  return `${MESES[p.m - 1]!.slice(0, 3)}/${String(p.ano).slice(2)}`;
}
