import { paramsParaProposta, propostaParaParams, temProposta } from './proposta';
import type { DividaPropostaCardData } from '../api/types';

function umCard(over: Partial<DividaPropostaCardData> = {}): DividaPropostaCardData {
  return { kind: 'divida_proposta', ...over };
}

describe('propostaParaParams', () => {
  it('leva só o que o assistente entendeu', () => {
    const params = propostaParaParams(umCard({ credor: 'Nubank', valorCobrado: 150000 }));
    expect(params).toEqual({ credor: 'Nubank', valorCobrado: '150000' });
  });

  it('campo ausente ou nulo não vira parâmetro vazio', () => {
    // Ausente significa "a pessoa não disse". Um parâmetro vazio na URL viraria
    // afirmação de que ela disse nada.
    const params = propostaParaParams(umCard({ credor: 'Nubank', valorCobrado: null }));
    expect(params).toEqual({ credor: 'Nubank' });
  });

  it('não leva o dividaId: ele é a rota, não um campo do formulário', () => {
    const params = propostaParaParams(umCard({ dividaId: 'divida-1', credor: 'Nubank' }));
    expect(params).toEqual({ credor: 'Nubank' });
  });
});

describe('paramsParaProposta', () => {
  it('devolve os campos válidos já tipados', () => {
    expect(
      paramsParaProposta({
        credor: 'Nubank',
        valorCobrado: '150000',
        dataOrigem: '2026-03-10',
        tipo: 'juros_abusivos',
        taxaJurosMensal: '250',
        totalParcelas: '12',
        primeiroVencimento: '2026-04-10',
      }),
    ).toEqual({
      credor: 'Nubank',
      valorCobrado: 150000,
      dataOrigem: '2026-03-10',
      tipo: 'juros_abusivos',
      taxaJurosMensal: 250,
      totalParcelas: 12,
      primeiroVencimento: '2026-04-10',
    });
  });

  it('descarta valor que não é inteiro positivo', () => {
    // Parâmetro de rota é entrada não confiável (guardrail 7.3): o campo abre
    // vazio, que é a verdade sobre o que se sabe dele.
    expect(paramsParaProposta({ valorCobrado: '1500,50' })).toEqual({});
    expect(paramsParaProposta({ valorCobrado: '-500' })).toEqual({});
    expect(paramsParaProposta({ valorCobrado: '0' })).toEqual({});
    expect(paramsParaProposta({ valorCobrado: '12abc' })).toEqual({});
  });

  it('descarta data fora do formato e fora do calendário', () => {
    expect(paramsParaProposta({ dataOrigem: '10/03/2026' })).toEqual({});
    expect(paramsParaProposta({ dataOrigem: '2026-02-31' })).toEqual({});
    expect(paramsParaProposta({ dataOrigem: '2026-03-10' })).toEqual({ dataOrigem: '2026-03-10' });
  });

  it('descarta classificação que não existe', () => {
    expect(paramsParaProposta({ tipo: 'cartao_de_credito' })).toEqual({});
  });

  it('descarta número de parcelas acima do teto do contrato', () => {
    expect(paramsParaProposta({ totalParcelas: '481' })).toEqual({});
    expect(paramsParaProposta({ totalParcelas: '480' })).toEqual({ totalParcelas: 480 });
  });

  it('um campo inválido não derruba os válidos ao lado', () => {
    expect(paramsParaProposta({ credor: 'Nubank', valorCobrado: 'muito' })).toEqual({
      credor: 'Nubank',
    });
  });

  it('parâmetro repetido na URL usa a primeira ocorrência', () => {
    expect(paramsParaProposta({ credor: ['Nubank', 'Outro'] })).toEqual({ credor: 'Nubank' });
  });

  it('credor em branco não vira campo preenchido', () => {
    expect(paramsParaProposta({ credor: '   ' })).toEqual({});
  });
});

describe('ida e volta', () => {
  it('o que sai do card chega igual ao formulário', () => {
    const card = umCard({
      dividaId: 'divida-1',
      credor: 'Banco Teste S/A',
      valorCobrado: 150000,
      dataOrigem: '2026-03-10',
      tipo: 'consumo',
      taxaJurosMensal: 250,
      totalParcelas: 12,
      primeiroVencimento: '2026-04-10',
    });

    expect(paramsParaProposta(propostaParaParams(card))).toEqual({
      credor: 'Banco Teste S/A',
      valorCobrado: 150000,
      dataOrigem: '2026-03-10',
      tipo: 'consumo',
      taxaJurosMensal: 250,
      totalParcelas: 12,
      primeiroVencimento: '2026-04-10',
    });
  });
});

describe('temProposta', () => {
  it('rota sem rascunho não avisa que veio da conversa', () => {
    expect(temProposta({})).toBe(false);
    expect(temProposta({ id: 'divida-1' })).toBe(false);
  });

  it('rota com rascunho válido avisa', () => {
    expect(temProposta({ id: 'divida-1', credor: 'Nubank' })).toBe(true);
  });
});
