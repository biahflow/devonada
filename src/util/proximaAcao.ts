import type { CriticidadeTipo, ResumoDividas } from '../api/types';
import { formatBRL } from './money';

export interface ProximaAcao {
  texto: string;
  rotuloCta: string;
  /** Rota do expo-router para onde o CTA leva. */
  destino: string;
}

/**
 * A próxima ação que o buddy sugere na Rota.
 *
 * REGRA DETERMINÍSTICA, e ela precisa ser: o card do buddy é a primeira coisa
 * acionável da tela, e uma sugestão vinda de LLM ali seria conselho financeiro
 * gerado por modelo — exatamente o que o guardrail 7 impede. Aqui não há
 * modelo, não há conta e não há número novo: só escolha de qual fato, dentre os
 * que o backend já mandou, merece a atenção de hoje.
 *
 * O QUE ESTA FUNÇÃO CONTINUA NÃO FAZENDO, e é o ponto: ela não CALCULA "essa
 * dívida cresce R$ 41 por dia". Esse número é `saldo × taxa ÷ 30` — valor
 * derivado, e o guardrail 1.2 proíbe o cliente produzi-lo. O que mudou no M10
 * foi só a origem: o campo passou a existir no servidor
 * (`custoDiarioJuros`, em `backend/domain/resumo.py`, com as três escolhas de
 * método declaradas lá), e aqui ele é lido, formatado e dito. Se um dia o campo
 * sumir do payload, a frase some junto — nunca é reconstruída daqui.
 *
 * A ordem de prioridade segue a de ataque (`src/util/dividas.ts`) com uma
 * exceção: atraso vem antes de tudo. Uma parcela vencida tem consequência de
 * calendário — multa, juros de mora, nome inscrito — e ela corre hoje, enquanto
 * a criticidade descreve um custo que corre todo mês.
 */
export function proximaAcao(resumo: ResumoDividas): ProximaAcao {
  const acao = acaoSugerida(resumo);
  const crescimento = fraseDoCrescimento(resumo);
  return crescimento ? { ...acao, texto: `${crescimento} ${acao.texto}` } : acao;
}

/**
 * A frase concreta do custo diário — ou `null`, que é a resposta sempre que o
 * servidor não mandou os dois campos de que ela depende.
 *
 * DOIS CAMPOS, não um. `custoDiarioJuros` soma só as dívidas COM taxa
 * conhecida; `quantidadeDividasSemTaxa` diz quantas ficaram de fora. Com a
 * contagem em zero o número é o total e a frase o afirma; com a contagem
 * positiva ele é um PISO e a frase diz "pelo menos", nomeando o que falta. Sem
 * a contagem não dá para saber qual dos dois é — e piso anunciado como total é
 * exatamente a subestimação silenciosa que este par existe para impedir.
 *
 * `typeof !== 'number'` em vez de `!== undefined` porque ausência trafega como
 * `null` no JSON, e `null !== undefined` é verdadeiro: passar `null` adiante
 * faria `formatBRL` imprimir "R$ 0,00 por dia", que é a afirmação falsa mais
 * cara que este card poderia fazer.
 *
 * Zero também não vira frase. O servidor manda zero quando a taxa informada é
 * zero ou quando os juros não chegam a um centavo ao dia; nos dois casos
 * "cresce R$ 0,00 por dia" não é a frase mais forte do card — é ruído, e no
 * segundo caso é falso.
 *
 * A copy descreve a DÍVIDA, nunca a pessoa. Ela cresce porque juro é juro, não
 * porque alguém foi descuidado, e o card existe para levar à ação seguinte —
 * não para cobrar o passado (guardrail 4).
 */
function fraseDoCrescimento(resumo: ResumoDividas): string | null {
  const centavos = resumo.custoDiarioJuros;
  const semTaxa = resumo.quantidadeDividasSemTaxa;
  if (typeof centavos !== 'number' || typeof semTaxa !== 'number') return null;
  if (centavos <= 0) return null;

  if (semTaxa === 0) {
    return `Hoje, sua dívida cresce ${formatBRL(centavos)} por dia.`;
  }

  const faltando =
    semTaxa === 1 ? '1 dívida ainda está' : `${semTaxa} dívidas ainda estão`;
  return `Hoje, sua dívida cresce pelo menos ${formatBRL(centavos)} por dia — ${faltando} sem a taxa cadastrada.`;
}

/** A ação em si, escolhida entre os fatos que o backend já mandou. */
function acaoSugerida(resumo: ResumoDividas): ProximaAcao {
  const atrasada = resumo.proximosVencimentos.find((v) => v.situacao === 'atrasada');
  if (atrasada) {
    return {
      texto: `A parcela do ${atrasada.credor} está atrasada. Quanto antes você resolver, menos encargo entra — e dá pra negociar a multa se ela passou de 2%.`,
      rotuloCta: 'Ver essa dívida',
      destino: `/dividas/${atrasada.dividaId}`,
    };
  }

  const critica = [...resumo.porCriticidade].sort(
    (a, b) => PESO[a.tipo] - PESO[b.tipo],
  )[0];

  if (critica && critica.tipo === 'juros_abusivos') {
    return {
      texto:
        'Rotativo e cheque especial são o que cresce mais rápido. É por aí que a gente começa — me manda a fatura que eu procuro o que dá pra contestar.',
      rotuloCta: 'Mandar a fatura',
      destino: '/dividas/contrato',
    };
  }

  const proximo = resumo.proximosVencimentos[0];
  if (proximo) {
    return {
      texto: `O próximo compromisso é com o ${proximo.credor}. Enquanto ele não vence, dá pra usar o tempo pra preparar uma negociação.`,
      rotuloCta: 'Ver essa dívida',
      destino: `/dividas/${proximo.dividaId}`,
    };
  }

  // Há dívida, mas nenhum contrato lido e nenhum cronograma. É o estado de quem
  // cadastrou na mão e parou — e a saída dele é sempre a mesma: sem o
  // documento, não há achado, não há valor justo e não há script.
  return {
    texto:
      'Pra eu achar o que dá pra contestar, preciso ler o contrato ou a fatura. É de lá que sai o valor justo e o script da negociação.',
    rotuloCta: 'Mandar o contrato',
    destino: '/dividas/contrato',
  };
}

const PESO: Record<CriticidadeTipo, number> = {
  juros_abusivos: 0,
  com_garantia: 1,
  essencial: 2,
  consumo: 3,
};
