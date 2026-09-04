import type {
  CampoExtraido,
  CamposBoleto,
  CamposCartaCobranca,
  CamposContrato,
  CamposPrintCobranca,
  ExtracaoContrato,
} from '../api/contratos';
import type { NovaDivida } from '../api/debts';
import type { CriticidadeTipo, IsoDate } from '../api/types';

/**
 * Converte a extração numa PROPOSTA de dívida para o usuário revisar.
 *
 * Duas regras que sustentam o guardrail 8:
 *
 * 1. Campo sem `trecho` do documento é DESCARTADO, mesmo que traga valor. Sem
 *    evidência citável, o número é palpite do modelo — e palpite não entra em
 *    formulário de dinheiro nem pré-preenchido.
 * 2. Nada aqui calcula. É seleção e cópia; a aritmética já veio do backend.
 *
 * O `extracaoId` é a EXCEÇÃO à regra 1, e de propósito: ele não é um campo lido
 * do documento, é a CHAVE da leitura. Viaja sempre que houver campos a propor,
 * para a dívida criada ligar-se à extração (`revisao.py` a usa para produzir os
 * achados e o `valorJusto`). Sem ele, a ligação dívida→extração se perde e a
 * revisão daquela dívida nunca mostra achado.
 *
 * Cada TIPO de documento (M13) carrega campos diferentes: o contrato traz o
 * núcleo inteiro; boleto, carta e print trazem só credor e valor, quando
 * citáveis. O resto o usuário completa à mão — que é a verdade honesta de um
 * print de cobrança.
 */
export function extracaoParaProposta(extracao: ExtracaoContrato): Partial<NovaDivida> {
  if (!extracao.campos) return {};

  const campos = camposDaDivida(extracao);
  const chave: Partial<NovaDivida> = { extracaoId: extracao.id };

  return {
    ...chave,
    ...comEvidencia('credor', campos.credor),
    ...comEvidencia('valorCobrado', campos.valorCobrado),
    ...comEvidencia('dataOrigem', campos.dataOrigem),
    ...comEvidencia('tipo', campos.tipo),
    ...comEvidencia('taxaJurosMensal', campos.taxaJurosMensal),
  };
}

/**
 * O mapa "campo do DOCUMENTO → campo da DÍVIDA", por TIPO de documento
 * (docs/inventario.md, limitação 23).
 *
 * Fonte ÚNICA: `extracaoParaProposta` usa este mapa para montar a proposta, e
 * `linhasDeConciliacao` (`src/util/conciliacao.ts`) usa o mesmo mapa para achar
 * o trecho que sustenta cada linha. Antes deste corte havia dois `switch`
 * independentes — um em cada arquivo — que precisavam ser mantidos batendo à
 * mão. Se divergissem, nasceria linha de conciliação com valor proposto e sem
 * trecho à vista: o guardrail 8.1 furado por dentro, sem nada quebrar.
 *
 * Tipado campo a campo de propósito, não `CampoExtraido<unknown>` genérico: é
 * essa tipagem que faz `extracaoParaProposta` continuar devolvendo
 * `Partial<NovaDivida>` correto.
 */
export interface CamposDaDivida {
  credor?: CampoExtraido<string>;
  valorCobrado?: CampoExtraido<number>;
  dataOrigem?: CampoExtraido<IsoDate>;
  tipo?: CampoExtraido<CriticidadeTipo>;
  taxaJurosMensal?: CampoExtraido<number>;
}

export function camposDaDivida(extracao: ExtracaoContrato): CamposDaDivida {
  const campos = extracao.campos;
  if (!campos) return {};

  switch (extracao.tipo) {
    case 'boleto': {
      const b = campos as CamposBoleto;
      return { credor: b.beneficiario, valorCobrado: b.valor };
    }
    case 'carta': {
      const c = campos as CamposCartaCobranca;
      return { credor: c.credor, valorCobrado: c.valorCobrado };
    }
    case 'print': {
      const p = campos as CamposPrintCobranca;
      return { credor: p.credor, valorCobrado: p.valorCobrado };
    }
    case 'contrato':
    default: {
      const c = campos as CamposContrato;
      return {
        credor: c.credor,
        valorCobrado: c.valorCobrado,
        dataOrigem: c.dataOrigem,
        tipo: c.tipo,
        taxaJurosMensal: c.taxaJurosMensal,
      };
    }
  }
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
