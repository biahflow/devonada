import type { IsoDate } from '../api/types';

/**
 * Conversão de data para exibição e para o contrato. Nenhuma REGRA de data mora
 * aqui: "atrasada", "vence em N dias" e afins vêm calculados do backend, senão
 * o fuso do aparelho vira fonte de divergência (docs/api-contract.md, M3).
 *
 * IsoDate é sempre data pura ("2024-03-15"), sem hora e sem fuso.
 */

export function isoParaBR(iso: IsoDate | undefined): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${ano}`;
}

/** Constrói o IsoDate a partir dos componentes LOCAIS — nunca via toISOString(),
 *  que desloca o dia conforme o fuso do aparelho. */
export function dateParaIso(date: Date): IsoDate {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function isoParaDate(iso: IsoDate | undefined): Date {
  if (!iso) return new Date();
  const [ano, mes, dia] = iso.split('-').map(Number);
  if (!ano || !mes || !dia) return new Date();
  return new Date(ano, mes - 1, dia);
}
