import type { CampoExtraido, ExtracaoContrato } from '../api/contratos';
import type { NovaDivida } from '../api/debts';

/**
 * Converte a extração numa PROPOSTA de dívida para o usuário revisar.
 *
 * Duas regras que sustentam o guardrail 1:
 *
 * 1. Campo sem `trecho` do contrato é DESCARTADO, mesmo que traga valor. Sem
 *    evidência citável, o número é palpite do modelo — e palpite não entra em
 *    formulário de dinheiro nem pré-preenchido.
 * 2. Nada aqui calcula. É seleção e cópia; a aritmética já veio do backend.
 */
export function extracaoParaProposta(extracao: ExtracaoContrato): Partial<NovaDivida> {
  const campos = extracao.campos;
  if (!campos) return {};

  return {
    ...comEvidencia('credor', campos.credor),
    ...comEvidencia('valorCobrado', campos.valorCobrado),
    ...comEvidencia('dataOrigem', campos.dataOrigem),
    ...comEvidencia('tipo', campos.tipo),
    ...comEvidencia('taxaJurosMensal', campos.taxaJurosMensal),
  };
}

function comEvidencia<K extends string, T>(
  chave: K,
  campo: CampoExtraido<T> | undefined,
): Partial<Record<K, T>> {
  if (!campo || campo.valor === null || campo.valor === undefined) return {};
  if (!campo.trecho) return {};
  return { [chave]: campo.valor } as Partial<Record<K, T>>;
}

/** Campos que o usuário precisa conferir antes de salvar. */
export function camposParaRevisar(extracao: ExtracaoContrato): string[] {
  const campos = extracao.campos;
  if (!campos) return [];

  return Object.entries(campos)
    .filter(([, campo]) => {
      const c = campo as CampoExtraido<unknown>;
      return c.valor === null || !c.trecho || c.confianca === 'baixa';
    })
    .map(([chave]) => chave);
}
