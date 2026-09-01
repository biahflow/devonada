import type { ExtracaoContrato } from '../api/contratos';
import type {
  Caixa,
  Divida,
  PerfilFinanceiro,
  RespostaSimulacao,
  ResumoDividas,
  RevisaoCobranca,
  Simulacao,
} from '../api/types';

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
    // Default sem histórico, mesmo efeito que `evolucaoSaldo: []` tinha antes
    // de T6 mover a conta da rota para o servidor: barra escondida.
    saldoInicialDaRota: null,
    rotaPercorridaBps: null,
    ...over,
  };
}

export function umPerfil(over: Partial<PerfilFinanceiro> = {}): PerfilFinanceiro {
  return { rendaMensal: 550000, dependentes: 1, ...over };
}

export function umaSimulacao(over: Partial<Simulacao> = {}): Simulacao {
  return {
    estrategia: 'avalanche',
    mesesAteQuitacao: 26,
    dataLiberdade: '2028-10',
    totalJurosPagos: 780000,
    totalPago: 5630000,
    economiaVsMinimo: 940000,
    ordemPagamento: [
      {
        dividaId: 'divida-1',
        credor: 'Cartão X',
        posicao: 1,
        quitadaEm: '2026-12',
        jurosPagos: 120000,
      },
    ],
    evolucaoSaldo: [
      { mes: '2026-08', saldo: 4850000 },
      { mes: '2026-09', saldo: 4610000 },
    ],
    ...over,
  };
}

export function umaResposta(over: Partial<RespostaSimulacao> = {}): RespostaSimulacao {
  return {
    simulacoes: [
      umaSimulacao(),
      umaSimulacao({
        estrategia: 'bola_de_neve',
        mesesAteQuitacao: 28,
        dataLiberdade: '2028-12',
        totalJurosPagos: 910000,
      }),
    ],
    comparacao: { melhorEstrategia: 'avalanche', diferencaJuros: 130000, diferencaMeses: 2 },
    dividasSemTaxa: [],
    ...over,
  };
}

export function umaExtracao(over: Partial<ExtracaoContrato> = {}): ExtracaoContrato {
  return {
    id: 'extracao-1',
    status: 'concluida',
    tipo: 'contrato',
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

/** Extração de BOLETO (M13). */
export function umBoleto(over: Partial<ExtracaoContrato> = {}): ExtracaoContrato {
  return {
    id: 'extracao-boleto-1',
    status: 'concluida',
    tipo: 'boleto',
    campos: {
      beneficiario: { valor: 'Sabesp', confianca: 'alta', trecho: 'Beneficiário: Sabesp' },
      valor: { valor: 8990, confianca: 'alta', trecho: 'Valor do documento: R$ 89,90' },
      vencimento: { valor: '2026-09-05', confianca: 'alta', trecho: 'Vencimento: 05/09/2026' },
      linhaDigitavel: {
        valor: '34191.79001 01043.510047 91020.150008 1 99110000008990',
        confianca: 'media',
        trecho: '34191.79001 01043.510047 91020.150008 1 99110000008990',
      },
      nossoNumero: { valor: null, confianca: 'baixa' },
    },
    ...over,
  };
}

/** Extração de CARTA de cobrança (M13). */
export function umaCarta(over: Partial<ExtracaoContrato> = {}): ExtracaoContrato {
  return {
    id: 'extracao-carta-1',
    status: 'concluida',
    tipo: 'carta',
    campos: {
      credor: { valor: 'Loja Crédito Fácil', confianca: 'alta', trecho: 'Cordialmente, Loja Crédito Fácil' },
      valorCobrado: { valor: 45000, confianca: 'alta', trecho: 'Débito em aberto: R$ 450,00' },
      dataVencimento: { valor: null, confianca: 'baixa' },
      referencia: { valor: 'Contrato 8842', confianca: 'media', trecho: 'Ref. contrato 8842' },
    },
    ...over,
  };
}

/** Extração de PRINT de cobrança (M13). */
export function umPrint(over: Partial<ExtracaoContrato> = {}): ExtracaoContrato {
  return {
    id: 'extracao-print-1',
    status: 'concluida',
    tipo: 'print',
    campos: {
      credor: { valor: 'Banco Digital', confianca: 'media', trecho: 'Banco Digital: sua fatura venceu' },
      valorCobrado: { valor: 32000, confianca: 'media', trecho: 'Total: R$ 320,00' },
      referencia: { valor: null, confianca: 'baixa' },
    },
    ...over,
  };
}

export function umCaixa(over: Partial<Caixa> = {}): Caixa {
  return {
    rendaBrutaTipica: 1000000,
    origemRenda: 'informada',
    impostoReservado: 0,
    rendaLiquida: 1000000,
    essenciais: 400000,
    naoEssenciais: 0,
    provisaoMensal: 0,
    aporteReserva: 0,
    aporteAposentadoria: 0,
    // Default é NUNCA DECLAROU (M11, ADR 0019) — mesma disciplina de
    // `saldoInicialDaRota` em `umResumo`: `null` é o estado que não muda o
    // comportamento das telas que não conhecem respiro ainda.
    respiro: null,
    respiroAtivo: null,
    respiroUsadoNoMes: null,
    respiroDisponivelNoMes: null,
    respiroSaldoAcumulado: null,
    // F-011 (ADR 0021): `false`/`null` é o estado que não muda nada para as telas
    // que ainda não conhecem renda tipada. Quem testa o outro lado passa por `over`.
    impostoNaoDeclarado: false,
    compromissoPercentualBps: null,
    compromissoPercentual: null,
    mesAncoraRenda: null,
    comprometidoDividas: 0,
    capacidadeHoje: 600000,
    capacidadeMaxima: 600000,
    aporteMaximo: 600000,
    minimoExistencial: 60000,
    minimoExistencialVigenteEm: '2023-06-19',
    abaixoDoPiso: false,
    naoFecha: false,
    // Vazio por padrão: a maioria dos testes de tela não fala de "como
    // calculamos", e quem fala declara a trilha que quer exercitar.
    trilhas: [],
    preenchimento: 'nivel_0',
    ...over,
  };
}

/**
 * Uma revisão de cobrança sem achado — o caso do cadastro manual.
 *
 * SUBIU PARA CÁ NO M14, quando a terceira tela passou a precisar dela
 * (`triagem`, `revisao` e `como-calculamos`). A terceira cópia de um builder é
 * onde as três começam a divergir em silêncio: uma ganha `trilha`, outra não, e
 * o teste que deveria proteger o campo novo passa sem exercitá-lo.
 */
export function umaRevisao(over: Partial<RevisaoCobranca> = {}): RevisaoCobranca {
  return {
    dividaId: 'divida-1',
    credor: 'Banco Teste',
    valorCobrado: 987000,
    achados: [],
    // O script é sempre presente (M12); nem toda tela o exibe, mas o tipo o
    // exige. Sem achado, o backend devolve o script mínimo de segurança.
    script: { canal: 'email', blocos: [] },
    fundamentos: [],
    ...over,
  };
}
