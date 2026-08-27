import type {
  CampoExtraido,
  CamposBoleto,
  CamposCartaCobranca,
  CamposContrato,
  CamposPrintCobranca,
  ExtracaoContrato,
} from '../api/contratos';
import { formatBRL } from './money';
import { formatBasisPoints } from './percent';
import { isoParaBR } from './date';

/**
 * Uma linha da tela de revisão: o rótulo, o campo extraído com sua evidência, e
 * como o valor deve aparecer. A formatação mora aqui — `CampoRevisao` só exibe.
 */
export interface LinhaRevisao {
  rotulo: string;
  campo: CampoExtraido<unknown> | undefined;
  valorFormatado?: string;
}

/**
 * As linhas de revisão de uma extração, escolhidas pelo TIPO de documento (M13).
 *
 * Cada tipo tem campos diferentes, mas todos passam pela mesma célula de
 * revisão, que já aplica o guardrail 8: campo sem trecho não mostra valor, e o
 * trecho é renderizado como texto puro. Nada aqui calcula — só formata o número
 * que o backend já apurou.
 */
export function linhasDeRevisao(extracao: ExtracaoContrato): LinhaRevisao[] {
  const campos = extracao.campos;
  if (!campos) return [];

  switch (extracao.tipo) {
    case 'boleto': {
      const b = campos as CamposBoleto;
      return [
        { rotulo: 'Beneficiário', campo: b.beneficiario, valorFormatado: texto(b.beneficiario) },
        { rotulo: 'Valor', campo: b.valor, valorFormatado: dinheiro(b.valor) },
        { rotulo: 'Vencimento', campo: b.vencimento, valorFormatado: data(b.vencimento) },
        {
          rotulo: 'Linha digitável',
          campo: b.linhaDigitavel,
          valorFormatado: texto(b.linhaDigitavel),
        },
        { rotulo: 'Nosso número', campo: b.nossoNumero, valorFormatado: texto(b.nossoNumero) },
      ];
    }
    case 'carta': {
      const c = campos as CamposCartaCobranca;
      return [
        { rotulo: 'Credor', campo: c.credor, valorFormatado: texto(c.credor) },
        { rotulo: 'Valor cobrado', campo: c.valorCobrado, valorFormatado: dinheiro(c.valorCobrado) },
        { rotulo: 'Vencimento', campo: c.dataVencimento, valorFormatado: data(c.dataVencimento) },
        { rotulo: 'Referência', campo: c.referencia, valorFormatado: texto(c.referencia) },
      ];
    }
    case 'print': {
      const p = campos as CamposPrintCobranca;
      return [
        { rotulo: 'Credor', campo: p.credor, valorFormatado: texto(p.credor) },
        { rotulo: 'Valor cobrado', campo: p.valorCobrado, valorFormatado: dinheiro(p.valorCobrado) },
        { rotulo: 'Referência', campo: p.referencia, valorFormatado: texto(p.referencia) },
      ];
    }
    case 'contrato':
    default: {
      const c = campos as CamposContrato;
      return [
        { rotulo: 'Credor', campo: c.credor, valorFormatado: texto(c.credor) },
        { rotulo: 'Valor', campo: c.valorCobrado, valorFormatado: dinheiro(c.valorCobrado) },
        { rotulo: 'Data de origem', campo: c.dataOrigem, valorFormatado: data(c.dataOrigem) },
        { rotulo: 'Juros ao mês', campo: c.taxaJurosMensal, valorFormatado: taxa(c.taxaJurosMensal) },
        { rotulo: 'Custo Efetivo Total', campo: c.cet, valorFormatado: taxa(c.cet) },
        {
          rotulo: 'Parcelas',
          campo: c.totalParcelas,
          valorFormatado: c.totalParcelas.valor?.toString(),
        },
      ];
    }
  }
}

function dinheiro(campo: CampoExtraido<number>): string | undefined {
  return campo.valor !== null ? formatBRL(campo.valor) : undefined;
}

function taxa(campo: CampoExtraido<number>): string | undefined {
  return campo.valor !== null ? formatBasisPoints(campo.valor) : undefined;
}

function data(campo: CampoExtraido<string>): string | undefined {
  return isoParaBR(campo.valor ?? undefined);
}

function texto(campo: CampoExtraido<string>): string | undefined {
  return campo.valor ?? undefined;
}
