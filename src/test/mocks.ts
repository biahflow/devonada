import type { ExtracaoContrato } from '../api/contratos';
import type { Divida, PerfilFinanceiro, ResumoDividas } from '../api/types';

/**
 * Fábricas de dado de teste. Cada uma monta um objeto plausível e aceita
 * override parcial — assim o teste declara só o que importa para ele, e o
 * leitor vê na chamada qual é a variável do caso.
 */

export function umaDivida(over: Partial<Divida> = {}): Divida {
  return {
    id: 'divida-1',
    credor: 'Banco Teste S/A',
    valorCobrado: 150000,
    dataOrigem: '2021-06-01',
    tipo: 'juros_abusivos',
    situacao: 'ativa',
    ...over,
  };
}

export function umResumo(over: Partial<ResumoDividas> = {}): ResumoDividas {
  return {
    totalDevido: 4850000,
    totalQuitadoNoAno: 320000,
    quantidadeDividas: 3,
    custoMedioJurosMensal: 380,
    porCriticidade: [
      { tipo: 'juros_abusivos', total: 2100000, quantidade: 1 },
      { tipo: 'consumo', total: 2750000, quantidade: 2 },
    ],
    proximosVencimentos: [],
    evolucaoSaldo: [],
    ...over,
  };
}

export function umPerfil(over: Partial<PerfilFinanceiro> = {}): PerfilFinanceiro {
  return { rendaMensal: 550000, dependentes: 1, ...over };
}

export function umaExtracao(over: Partial<ExtracaoContrato> = {}): ExtracaoContrato {
  return {
    id: 'extracao-1',
    status: 'concluida',
    campos: {
      credor: { valor: 'Banco Teste S/A', confianca: 'alta', trecho: 'CREDOR: Banco Teste S/A' },
      valorCobrado: { valor: 150000, confianca: 'alta', trecho: 'Valor total: R$ 1.500,00' },
      dataOrigem: { valor: '2021-06-01', confianca: 'alta', trecho: 'Contratação em 01/06/2021' },
      tipo: { valor: 'juros_abusivos', confianca: 'media', trecho: 'Modalidade: rotativo' },
      taxaJurosMensal: { valor: 1250, confianca: 'alta', trecho: 'Taxa: 12,50% a.m.' },
      totalParcelas: { valor: 12, confianca: 'alta', trecho: 'Em 12 parcelas' },
      cet: { valor: 18000, confianca: 'baixa', trecho: 'CET: 180,00% a.a.' },
    },
    ...over,
  };
}
