import type { CriticidadeTipo, ResumoDividas } from '../api/types';

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
 * O QUE ESTA FUNÇÃO NÃO FAZ, e a ausência é o ponto: ela não diz "essa dívida
 * cresce R$ 41 por dia". Esse número é `saldo × taxa ÷ 30` — valor derivado, e
 * o guardrail 1.2 proíbe o cliente produzi-lo. Ele é a frase mais forte que o
 * card poderia ter, e por isso está anotado em `docs/api-contract.md` como
 * campo a pedir ao backend (`custoDiarioJuros` no resumo), não improvisado
 * aqui.
 *
 * A ordem de prioridade segue a de ataque (`src/util/dividas.ts`) com uma
 * exceção: atraso vem antes de tudo. Uma parcela vencida tem consequência de
 * calendário — multa, juros de mora, nome inscrito — e ela corre hoje, enquanto
 * a criticidade descreve um custo que corre todo mês.
 */
export function proximaAcao(resumo: ResumoDividas): ProximaAcao {
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
