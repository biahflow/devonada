import type { CampoExtraido, ExtracaoContrato } from '../api/contratos';
import { camposParaRevisar, extracaoParaProposta } from './extracao';

function campo<T>(
  valor: T | null,
  trecho?: string,
  confianca: 'alta' | 'media' | 'baixa' = 'alta',
): CampoExtraido<T> {
  return { valor, confianca, trecho };
}

function extracao(
  overrides: Partial<NonNullable<ExtracaoContrato['campos']>> = {},
): ExtracaoContrato {
  return {
    id: 'e1',
    status: 'concluida',
    campos: {
      credor: campo('Banco Teste S/A', 'CREDOR: Banco Teste S/A'),
      valorCobrado: campo(150000, 'Valor total: R$ 1.500,00'),
      dataOrigem: campo('2021-06-01', 'Data da contratação: 01/06/2021'),
      tipo: campo('consignado' as never, 'Modalidade: consignado'),
      taxaJurosMensal: campo(1250, 'Taxa de juros: 12,50% a.m.'),
      totalParcelas: campo(12, 'Em 12 parcelas'),
      cet: campo(18000, 'CET: 180,00% a.a.'),
      ...overrides,
    },
  };
}

describe('extracaoParaProposta', () => {
  it('devolve vazio quando não há campos', () => {
    expect(extracaoParaProposta({ id: 'e1', status: 'processando' })).toEqual({});
  });

  it('copia os campos que têm valor e evidência', () => {
    const proposta = extracaoParaProposta(extracao());
    expect(proposta.credor).toBe('Banco Teste S/A');
    expect(proposta.valorCobrado).toBe(150000);
    expect(proposta.dataOrigem).toBe('2021-06-01');
    expect(proposta.taxaJurosMensal).toBe(1250);
  });

  it('DESCARTA campo com valor mas sem trecho que comprove', () => {
    // Número sem evidência citável é palpite do modelo. Palpite não entra em
    // formulário de dinheiro, nem pré-preenchido.
    const proposta = extracaoParaProposta(extracao({ valorCobrado: campo(999999, undefined) }));
    expect(proposta).not.toHaveProperty('valorCobrado');
  });

  it('descarta campo nulo em vez de propor zero', () => {
    const proposta = extracaoParaProposta(
      extracao({ taxaJurosMensal: campo<number>(null, 'nada aqui') }),
    );
    expect(proposta).not.toHaveProperty('taxaJurosMensal');
  });

  it('preserva centavos e basis points como inteiros', () => {
    const proposta = extracaoParaProposta(extracao());
    expect(Number.isInteger(proposta.valorCobrado)).toBe(true);
    expect(Number.isInteger(proposta.taxaJurosMensal)).toBe(true);
  });

  it('não inventa campo que a extração não trouxe', () => {
    const proposta = extracaoParaProposta(
      extracao({ credor: campo<string>(null), valorCobrado: campo<number>(null) }),
    );
    expect(Object.keys(proposta)).not.toContain('credor');
    expect(Object.keys(proposta)).not.toContain('valorCobrado');
  });
});

describe('camposParaRevisar', () => {
  it('não aponta nada quando tudo veio com valor, trecho e confiança alta', () => {
    expect(camposParaRevisar(extracao())).toEqual([]);
  });

  it('aponta campo sem valor', () => {
    expect(camposParaRevisar(extracao({ cet: campo<number>(null, 'trecho') }))).toContain('cet');
  });

  it('aponta campo sem evidência', () => {
    expect(camposParaRevisar(extracao({ credor: campo('X', undefined) }))).toContain('credor');
  });

  it('aponta campo de confiança baixa mesmo com evidência', () => {
    expect(camposParaRevisar(extracao({ valorCobrado: campo(1000, 'trecho', 'baixa') }))).toContain(
      'valorCobrado',
    );
  });
});
