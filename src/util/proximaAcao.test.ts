import { proximaAcao } from './proximaAcao';
import type { ResumoDividas } from '../api/types';

function resumo(parcial: Partial<ResumoDividas>): ResumoDividas {
  return {
    totalDevido: 1834000,
    totalQuitadoNoAno: 0,
    quantidadeDividas: 2,
    porCriticidade: [],
    proximosVencimentos: [],
    evolucaoSaldo: [],
    ...parcial,
  };
}

describe('proximaAcao — a ação sugerida', () => {
  it('atraso vem antes de tudo', () => {
    const acao = proximaAcao(
      resumo({
        porCriticidade: [{ tipo: 'juros_abusivos', total: 100000, quantidade: 1 }],
        proximosVencimentos: [
          {
            dividaId: 'd1',
            credor: 'Nubank',
            valor: 45000,
            vencimento: '2026-08-01',
            situacao: 'atrasada',
          },
        ],
      }),
    );
    expect(acao.texto).toContain('Nubank');
    expect(acao.destino).toBe('/dividas/d1');
  });

  it('sem dado nenhum, pede o contrato', () => {
    expect(proximaAcao(resumo({})).rotuloCta).toBe('Mandar o contrato');
  });
});

describe('proximaAcao — o custo diário dos juros', () => {
  it('diz a frase quando o campo vem e toda a carteira tem taxa', () => {
    const acao = proximaAcao(
      resumo({ custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 0 }),
    );
    expect(acao.texto).toContain('Hoje, sua dívida cresce R$ 41,00 por dia.');
    // A frase entra ANTES da ação, não no lugar dela.
    expect(acao.texto).toContain('preciso ler o contrato');
    expect(acao.rotuloCta).toBe('Mandar o contrato');
    expect(acao.destino).toBe('/dividas/contrato');
  });

  it('com dívida sem taxa, o número é dito como PISO e o que falta é nomeado', () => {
    // A consequência honesta da escolha (a): o agregado subestima, e quem
    // subestima em silêncio está afirmando um total que não tem.
    const acao = proximaAcao(
      resumo({ custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 2 }),
    );
    expect(acao.texto).toContain(
      'Hoje, sua dívida cresce pelo menos R$ 41,00 por dia — 2 dívidas ainda estão sem a taxa cadastrada.',
    );
  });

  it('uma só dívida sem taxa fala no singular', () => {
    const acao = proximaAcao(
      resumo({ custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 1 }),
    );
    expect(acao.texto).toContain('1 dívida ainda está sem a taxa cadastrada');
  });

  it('sem o campo, o card diz exatamente o que dizia antes do M10', () => {
    const semCampo = proximaAcao(resumo({}));
    const comCampo = proximaAcao(
      resumo({ custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 0 }),
    );
    expect(semCampo.texto).not.toContain('por dia');
    expect(semCampo.texto).not.toContain('R$');
    expect(comCampo.texto.endsWith(semCampo.texto)).toBe(true);
  });

  it('sem a contagem, a frase não sai — piso não pode ser anunciado como total', () => {
    const acao = proximaAcao(resumo({ custoDiarioJuros: 4100 }));
    expect(acao.texto).not.toContain('por dia');
  });

  it('zero nunca vira "R$ 0,00 por dia"', () => {
    // O servidor manda zero quando a taxa informada é zero ou quando os juros
    // não chegam a um centavo ao dia. Dizer "cresce R$ 0,00 por dia" é ruído no
    // primeiro caso e afirmação falsa no segundo.
    const acao = proximaAcao(resumo({ custoDiarioJuros: 0, quantidadeDividasSemTaxa: 0 }));
    expect(acao.texto).not.toContain('R$ 0,00');
    expect(acao.texto).not.toContain('por dia');
  });

  // O backend serializa ausência como `null`, não omitindo o campo. O tipo do
  // front diz `?: number`, então um guard escrito com `!== undefined` deixa o
  // `null` passar — e a partir daí ou `formatBRL(null)` imprime R$ 0,00, ou a
  // contagem nula vira "null dívidas" na tela. Só um teste que fale JSON de
  // verdade pega os dois.
  function doServidor(json: string): ResumoDividas {
    return JSON.parse(json) as ResumoDividas;
  }

  const BASE =
    '"totalDevido":1834000,"totalQuitadoNoAno":0,"quantidadeDividas":2,"porCriticidade":[],"proximosVencimentos":[],"evolucaoSaldo":[]';

  it('custo nulo no JSON não vira "R$ 0,00 por dia"', () => {
    const acao = proximaAcao(
      doServidor(`{${BASE},"custoDiarioJuros":null,"quantidadeDividasSemTaxa":2}`),
    );
    expect(acao.texto).not.toContain('R$');
    expect(acao.texto).not.toContain('por dia');
  });

  it('contagem nula no JSON não vira frase nenhuma', () => {
    const acao = proximaAcao(
      doServidor(`{${BASE},"custoDiarioJuros":4100,"quantidadeDividasSemTaxa":null}`),
    );
    expect(acao.texto).not.toContain('por dia');
    expect(acao.texto).not.toContain('null');
  });
});

describe('copy do custo diário', () => {
  // Gêmeo dos testes que quebram em "recomendada" (M4), "ilegal" (M6) e
  // "você já gastou" (M7). Aqui o risco é outro: a frase mais concreta da tela
  // é também a mais fácil de transformar em cobrança moral. A dívida cresce
  // porque juro é juro — não porque a pessoa foi descuidada.
  const PROIBIDO =
    /culpa|culpad[ao]|você (está |vem )?perdendo|perdendo dinheiro|jogando fora|joga fora|desperdí|desperdi[çc]|irresponsáv|descuid|vergonha|você deveria|não deveria|se você tivesse|cada segundo|a cada minuto|neste momento|correndo agora/i;

  const CENARIOS: Partial<ResumoDividas>[] = [
    { custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 0 },
    { custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 1 },
    { custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 3 },
    { custoDiarioJuros: 1, quantidadeDividasSemTaxa: 0 },
    { custoDiarioJuros: 0, quantidadeDividasSemTaxa: 0 },
    {},
  ];

  it('nenhum cenário culpa o usuário pelo crescimento da dívida', () => {
    for (const cenario of CENARIOS) {
      const acao = proximaAcao(resumo(cenario));
      expect(acao.texto).not.toMatch(PROIBIDO);
      expect(acao.rotuloCta).not.toMatch(PROIBIDO);
    }
  });

  it('nenhum cenário trata o número como contagem em tempo real', () => {
    // Guardrail 4 proíbe contagem regressiva de juros correndo na tela. Este
    // número é uma foto do dia, e a copy tem de deixar isso claro.
    for (const cenario of CENARIOS) {
      const texto = proximaAcao(resumo(cenario)).texto;
      expect(texto).not.toMatch(/agora mesmo|em tempo real|neste instante|por segundo/i);
    }
  });

  it('nenhum cenário afirma direito nem ilegalidade', () => {
    for (const cenario of CENARIOS) {
      const texto = proximaAcao(resumo(cenario)).texto;
      expect(texto).not.toMatch(/ilegal|abusiv|é seu direito|você tem direito|garantid[ao]/i);
    }
  });
});
