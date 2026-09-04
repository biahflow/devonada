import type { CampoExtraido, ExtracaoContrato } from '../api/contratos';
import type { Divida } from '../api/types';
import { camposMarcados, linhasDeConciliacao, type LinhaConciliacao } from './conciliacao';
import { extracaoParaProposta } from './extracao';

function campo<T>(
  valor: T | null,
  trecho?: string,
  confianca: 'alta' | 'media' | 'baixa' = 'alta',
): CampoExtraido<T> {
  return { valor, confianca, trecho };
}

function umContrato(
  overrides: Partial<NonNullable<ExtracaoContrato['campos']>> = {},
): ExtracaoContrato {
  return {
    id: 'extracao-1',
    status: 'concluida',
    tipo: 'contrato',
    campos: {
      credor: campo('Banco Teste S/A', 'CREDOR: Banco Teste S/A'),
      valorCobrado: campo(150000, 'Valor total: R$ 1.500,00'),
      dataOrigem: campo('2021-06-01', 'Contratação em 01/06/2021'),
      tipo: campo('juros_abusivos' as never, 'Modalidade: rotativo'),
      taxaJurosMensal: campo(1250, 'Taxa: 12,50% a.m.'),
      totalParcelas: campo(12, 'Em 12 parcelas'),
      cet: campo(18000, 'CET: 180,00% a.a.'),
      ...overrides,
    },
  };
}

function umaDivida(over: Partial<Divida> = {}): Divida {
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

/** O caminho real: a proposta sempre vem do descarte do guardrail 8.1. */
function conciliar(extracao: ExtracaoContrato, divida: Divida): LinhaConciliacao[] {
  return linhasDeConciliacao(extracaoParaProposta(extracao), divida, extracao);
}

function porCampo(linhas: LinhaConciliacao[], campo: string): LinhaConciliacao | undefined {
  return linhas.find((linha) => linha.campo === campo);
}

describe('linhasDeConciliacao — as três situações', () => {
  it('CONFERE quando documento e dívida dizem o mesmo, e não pede decisão', () => {
    const linhas = conciliar(umContrato(), umaDivida({ taxaJurosMensal: 1250 }));

    expect(linhas.map((l) => l.situacao)).toEqual([
      'confere',
      'confere',
      'confere',
      'confere',
      'confere',
    ]);
    // Nada a decidir: nenhuma linha nasce marcada, e nada delas viaja.
    expect(linhas.every((l) => l.marcadaPorPadrao === false)).toBe(true);
    expect(camposMarcados(linhas, () => true)).toEqual({});
  });

  it('DIVERGE nasce DESMARCADA — o digitado vence (ADR 0025, decisão 3)', () => {
    const linhas = conciliar(umContrato(), umaDivida({ valorCobrado: 99000 }));
    const valor = porCampo(linhas, 'valorCobrado');

    expect(valor?.situacao).toBe('diverge');
    expect(valor?.marcadaPorPadrao).toBe(false);
    // Os DOIS lados ficam à vista: "você informou X · o documento diz Y".
    expect(valor?.atualFormatado).toBe('R$ 990,00');
    expect(valor?.documentoFormatado).toBe('R$ 1.500,00');
  });

  it('PREENCHE nasce MARCADA — não há afirmação anterior a sobrescrever', () => {
    // `umaDivida` não tem taxa: é o caso mais comum do cadastro à mão.
    const linhas = conciliar(umContrato(), umaDivida());
    const taxa = porCampo(linhas, 'taxaJurosMensal');

    expect(taxa?.situacao).toBe('preenche');
    expect(taxa?.marcadaPorPadrao).toBe(true);
    expect(taxa?.documentoFormatado).toBe('12,50%');
    // Não há valor anterior para exibir, e inventar um seria mentir.
    expect(taxa?.atualFormatado).toBeUndefined();
  });

  it('dívida com taxa igual à do documento CONFERE em vez de preencher', () => {
    const linhas = conciliar(umContrato(), umaDivida({ taxaJurosMensal: 1250 }));
    expect(porCampo(linhas, 'taxaJurosMensal')?.situacao).toBe('confere');
  });

  it('classifica cada campo de forma independente', () => {
    const linhas = conciliar(
      umContrato(),
      umaDivida({ credor: 'Outro Banco', valorCobrado: 150000 }),
    );

    expect(porCampo(linhas, 'credor')?.situacao).toBe('diverge');
    expect(porCampo(linhas, 'valorCobrado')?.situacao).toBe('confere');
    expect(porCampo(linhas, 'taxaJurosMensal')?.situacao).toBe('preenche');
  });
});

describe('linhasDeConciliacao — o que entra e o que fica de fora', () => {
  it('campo SEM TRECHO não vira linha, mesmo trazendo valor (guardrail 8.1)', () => {
    const linhas = conciliar(
      umContrato({ valorCobrado: campo(999999, undefined) }),
      umaDivida({ valorCobrado: 150000 }),
    );

    expect(porCampo(linhas, 'valorCobrado')).toBeUndefined();
    expect(linhas.map((l) => l.campo)).not.toContain('valorCobrado');
  });

  it('campo nulo não vira linha', () => {
    const linhas = conciliar(
      umContrato({ dataOrigem: campo<string>(null, 'sem data legível') }),
      umaDivida(),
    );
    expect(porCampo(linhas, 'dataOrigem')).toBeUndefined();
  });

  it('os ENCARGOS ficam de fora: não têm coluna em Divida', () => {
    // CET, parcelas e afins viajam com o vínculo e aparecem na revisão como
    // achado — a conciliação só trata o que o PATCH aceita.
    const campos = conciliar(umContrato(), umaDivida()).map((l) => l.campo);
    expect(campos).toEqual(['credor', 'valorCobrado', 'dataOrigem', 'tipo', 'taxaJurosMensal']);
  });

  it('extração sem campos não produz linha nenhuma', () => {
    const linhas = conciliar(
      { id: 'extracao-1', status: 'concluida', tipo: 'contrato' },
      umaDivida(),
    );
    expect(linhas).toEqual([]);
  });

  it('extração em que nada é citável não produz linha — nada a ligar campo a campo', () => {
    const linhas = conciliar(
      umContrato({
        credor: campo('Banco Teste S/A', undefined),
        valorCobrado: campo(150000, undefined),
        dataOrigem: campo<string>(null),
        tipo: campo<string>(null) as never,
        taxaJurosMensal: campo<number>(null),
      }),
      umaDivida(),
    );
    expect(linhas).toEqual([]);
  });
});

describe('linhasDeConciliacao — por tipo de documento (M13)', () => {
  it('BOLETO traz só credor e valor, e o trecho vem do campo certo', () => {
    const boleto: ExtracaoContrato = {
      id: 'extracao-boleto-1',
      status: 'concluida',
      tipo: 'boleto',
      campos: {
        beneficiario: campo('Sabesp', 'Beneficiário: Sabesp'),
        valor: campo(8990, 'Valor do documento: R$ 89,90'),
        vencimento: campo('2026-09-05', 'Vencimento: 05/09/2026'),
        linhaDigitavel: campo('34191.79001', '34191.79001'),
        nossoNumero: campo<string>(null),
      },
    };

    const linhas = conciliar(boleto, umaDivida());

    expect(linhas.map((l) => l.campo)).toEqual(['credor', 'valorCobrado']);
    // O credor do boleto mora em `beneficiario`: o trecho exibido tem de ser o
    // que sustenta o valor proposto, não o de outro campo.
    expect(porCampo(linhas, 'credor')?.extraido?.trecho).toBe('Beneficiário: Sabesp');
    expect(porCampo(linhas, 'valorCobrado')?.extraido?.trecho).toBe(
      'Valor do documento: R$ 89,90',
    );
  });

  it('PRINT traz menos campos ainda, e o que não tem trecho cai fora', () => {
    const print: ExtracaoContrato = {
      id: 'extracao-print-1',
      status: 'concluida',
      tipo: 'print',
      campos: {
        credor: campo('Banco Digital', 'Banco Digital: sua fatura venceu', 'media'),
        valorCobrado: campo(32000, 'Total: R$ 320,00', 'media'),
        referencia: campo<string>(null),
      },
    };

    const linhas = conciliar(print, umaDivida({ credor: 'Banco Digital' }));

    expect(linhas.map((l) => l.campo)).toEqual(['credor', 'valorCobrado']);
    expect(porCampo(linhas, 'credor')?.situacao).toBe('confere');
    expect(porCampo(linhas, 'valorCobrado')?.situacao).toBe('diverge');
    // Um print não tem taxa a extrair — e a dívida não ganha `preenche` por um
    // campo que o documento nunca trouxe.
    expect(porCampo(linhas, 'taxaJurosMensal')).toBeUndefined();
  });

  it('CARTA traz credor e valor', () => {
    const carta: ExtracaoContrato = {
      id: 'extracao-carta-1',
      status: 'concluida',
      tipo: 'carta',
      campos: {
        credor: campo('Loja Crédito Fácil', 'Cordialmente, Loja Crédito Fácil'),
        valorCobrado: campo(45000, 'Débito em aberto: R$ 450,00'),
        dataVencimento: campo<string>(null),
        referencia: campo('Contrato 8842', 'Ref. contrato 8842', 'media'),
      },
    };

    expect(conciliar(carta, umaDivida()).map((l) => l.campo)).toEqual(['credor', 'valorCobrado']);
  });
});

describe('o mapa campo→trecho tem UMA fonte só (docs/inventario.md, limitação 23)', () => {
  // Uma extração por tipo, com TODOS os campos daquele tipo trazendo valor e
  // trecho — o cenário em que `extracaoParaProposta` propõe o máximo possível.
  // Este teste não olha para `camposDaDivida`: ele passa pelas duas funções
  // PÚBLICAS, exatamente como a tela faz. Se algum dia alguém voltar a separar
  // o mapa de `extracaoParaProposta` do mapa de `linhasDeConciliacao`, e os
  // dois divergirem, é aqui que a divergência aparece — como linha sem
  // `extraido`, ou como campo proposto sem linha correspondente.
  const extracoesComEvidenciaCompleta: [string, ExtracaoContrato][] = [
    ['contrato', umContrato()],
    [
      'boleto',
      {
        id: 'extracao-boleto-full',
        status: 'concluida',
        tipo: 'boleto',
        campos: {
          beneficiario: campo('Sabesp', 'Beneficiário: Sabesp'),
          valor: campo(8990, 'Valor do documento: R$ 89,90'),
          vencimento: campo('2026-09-05', 'Vencimento: 05/09/2026'),
          linhaDigitavel: campo('34191.79001', '34191.79001'),
          nossoNumero: campo('123', '123'),
        },
      },
    ],
    [
      'carta',
      {
        id: 'extracao-carta-full',
        status: 'concluida',
        tipo: 'carta',
        campos: {
          credor: campo('Loja Crédito Fácil', 'Cordialmente, Loja Crédito Fácil'),
          valorCobrado: campo(45000, 'Débito em aberto: R$ 450,00'),
          dataVencimento: campo('2026-09-05', 'Vencimento: 05/09/2026'),
          referencia: campo('Contrato 8842', 'Ref. contrato 8842'),
        },
      },
    ],
    [
      'print',
      {
        id: 'extracao-print-full',
        status: 'concluida',
        tipo: 'print',
        campos: {
          credor: campo('Banco Digital', 'Banco Digital: sua fatura venceu'),
          valorCobrado: campo(32000, 'Total: R$ 320,00'),
          referencia: campo('Fatura 99', 'Ref: Fatura 99'),
        },
      },
    ],
  ];

  it.each(extracoesComEvidenciaCompleta)(
    'todo campo que a proposta de %s traz vira linha COM trecho à vista',
    (_tipo, extracao) => {
      const proposta = extracaoParaProposta(extracao);
      const linhas = linhasDeConciliacao(proposta, umaDivida(), extracao);

      // `extracaoId` é a chave da leitura, não um campo de dívida — nunca vira
      // linha (armadilha 2 do spec).
      const camposPropostos = Object.keys(proposta).filter((chave) => chave !== 'extracaoId');
      expect(linhas.map((l) => l.campo).sort()).toEqual([...camposPropostos].sort());

      for (const linha of linhas) {
        expect(linha.extraido).toBeDefined();
        expect(linha.extraido?.trecho).toBeTruthy();
      }
    },
  );
});

describe('camposMarcados — só o que a pessoa aceitou viaja', () => {
  it('manda o que está marcado e nada mais', () => {
    const linhas = conciliar(umContrato(), umaDivida({ valorCobrado: 99000 }));

    // O padrão da tela: `preenche` marcado, `diverge` não.
    expect(camposMarcados(linhas, (l) => l.marcadaPorPadrao)).toEqual({ taxaJurosMensal: 1250 });
  });

  it('nada marcado devolve objeto vazio — "não mude nada" (RF-003)', () => {
    const linhas = conciliar(umContrato(), umaDivida({ valorCobrado: 99000 }));
    expect(camposMarcados(linhas, () => false)).toEqual({});
  });

  it('a divergência marcada à mão passa a viajar', () => {
    const linhas = conciliar(umContrato(), umaDivida({ valorCobrado: 99000 }));
    const campos = camposMarcados(linhas, (l) => l.campo === 'valorCobrado');
    expect(campos).toEqual({ valorCobrado: 150000 });
  });

  it('NUNCA deixa o extracaoId vazar para dentro de campos', () => {
    // `extracaoParaProposta` sempre carrega o `extracaoId` — ele é a chave da
    // leitura, não um campo de dívida. No corpo da requisição ele é o campo de
    // TOPO; dentro de `campos` seria um PATCH tentando ligar documento, que o
    // servidor ignora em silêncio (ADR 0025, decisão 1).
    const linhas = conciliar(umContrato(), umaDivida());

    expect(linhas.every((l) => !('extracaoId' in l.patch))).toBe(true);
    expect(camposMarcados(linhas, () => true)).not.toHaveProperty('extracaoId');
  });

  it('linha que CONFERE não viaja nem quando o predicado diz sim', () => {
    // Mandar de volta o valor que já está no banco é escrita sem efeito — e
    // borraria a intenção de "só o que a pessoa marcou".
    const linhas = conciliar(umContrato(), umaDivida({ taxaJurosMensal: 1250 }));
    expect(camposMarcados(linhas, () => true)).toEqual({});
  });
});

describe('formatação — a conciliação compara e formata, nunca calcula', () => {
  it('dinheiro em centavos, taxa em basis points, data em pt-BR', () => {
    const linhas = conciliar(
      umContrato(),
      umaDivida({ valorCobrado: 99000, dataOrigem: '2020-01-15', taxaJurosMensal: 800 }),
    );

    expect(porCampo(linhas, 'valorCobrado')?.atualFormatado).toBe('R$ 990,00');
    expect(porCampo(linhas, 'dataOrigem')?.atualFormatado).toBe('15/01/2020');
    expect(porCampo(linhas, 'taxaJurosMensal')?.atualFormatado).toBe('8,00%');
  });

  it('classificação sai com o rótulo que a pessoa lê, não com a chave', () => {
    const linhas = conciliar(umContrato(), umaDivida({ tipo: 'consumo' }));
    const tipo = porCampo(linhas, 'tipo');

    expect(tipo?.situacao).toBe('diverge');
    expect(tipo?.atualFormatado).toBe('Consumo');
    expect(tipo?.documentoFormatado).toBe('Juros altos');
  });

  it('não expõe nenhuma diferença derivada entre os dois valores (guardrail 1.2)', () => {
    const linha = porCampo(conciliar(umContrato(), umaDivida({ valorCobrado: 99000 })), 'valorCobrado');
    // A linha carrega os dois lados e nada mais: qualquer "economia de R$ X"
    // aqui seria conta feita no cliente.
    expect(Object.keys(linha ?? {}).sort()).toEqual(
      [
        'atualFormatado',
        'campo',
        'documentoFormatado',
        'extraido',
        'marcadaPorPadrao',
        'patch',
        'rotulo',
        'situacao',
      ].sort(),
    );
  });
});
