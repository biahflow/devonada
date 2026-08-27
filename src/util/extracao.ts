import type {
  CampoExtraido,
  CamposBoleto,
  CamposCartaCobranca,
  CamposContrato,
  CamposPrintCobranca,
  ExtracaoContrato,
} from '../api/contratos';
import type { NovaDivida } from '../api/debts';

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
  const campos = extracao.campos;
  if (!campos) return {};

  const chave: Partial<NovaDivida> = { extracaoId: extracao.id };

  switch (extracao.tipo) {
    case 'boleto': {
      const b = campos as CamposBoleto;
      return {
        ...chave,
        ...comEvidencia('credor', b.beneficiario),
        ...comEvidencia('valorCobrado', b.valor),
      };
    }
    case 'carta': {
      const c = campos as CamposCartaCobranca;
      return {
        ...chave,
        ...comEvidencia('credor', c.credor),
        ...comEvidencia('valorCobrado', c.valorCobrado),
      };
    }
    case 'print': {
      const p = campos as CamposPrintCobranca;
      return {
        ...chave,
        ...comEvidencia('credor', p.credor),
        ...comEvidencia('valorCobrado', p.valorCobrado),
      };
    }
    case 'contrato':
    default: {
      const c = campos as CamposContrato;
      return {
        ...chave,
        ...comEvidencia('credor', c.credor),
        ...comEvidencia('valorCobrado', c.valorCobrado),
        ...comEvidencia('dataOrigem', c.dataOrigem),
        ...comEvidencia('tipo', c.tipo),
        ...comEvidencia('taxaJurosMensal', c.taxaJurosMensal),
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
