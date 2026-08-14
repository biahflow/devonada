import type { CriticidadeTipo } from '../../api/types';

export interface TipoDeDivida {
  id: string;
  emoji: string;
  rotulo: string;
  tipo: CriticidadeTipo;
}

/**
 * As cinco portas de entrada do onboarding.
 *
 * O MAPA PARA `CriticidadeTipo` É O TRABALHO REAL DESTAS OPÇÕES. A pessoa não
 * sabe — e não deveria precisar saber — o que é "criticidade"; ela sabe que deve
 * no cartão. Cada escolha aqui já classifica a dívida pela consequência de não
 * pagar, que é o que decide a ordem de ataque depois. Ver docs/domain.md,
 * seção 2.
 *
 * "DEVO PRA UMA PESSOA" EXISTE POR UM MOTIVO. É enorme no Brasil, nenhum app
 * trata, e o peso emocional é diferente do de uma dívida bancária: não há
 * cobrança formal, mas há o almoço de domingo. Entra como `consumo` porque a
 * consequência financeira é a mais branda — o que essa dívida cobra é outra
 * coisa, e o app não finge medir.
 *
 * VIVE FORA DA TELA porque o passo 2 também precisa da lista: desde a ADR 0016 a
 * escolha é múltipla e o passo 2 recebe uma FILA de ids, não um `tipo` solto por
 * param. Quem resolve id → rótulo e tipo é `tipoPorId`.
 */
export const TIPOS_DE_DIVIDA: readonly TipoDeDivida[] = [
  { id: 'cartao', emoji: '💳', rotulo: 'Cartão de crédito / rotativo', tipo: 'juros_abusivos' },
  { id: 'emprestimo', emoji: '🏦', rotulo: 'Empréstimo ou consignado', tipo: 'com_garantia' },
  { id: 'crediario', emoji: '🛒', rotulo: 'Crediário / carnê de loja', tipo: 'consumo' },
  { id: 'conta', emoji: '📄', rotulo: 'Conta atrasada (luz, água, aluguel)', tipo: 'essencial' },
  { id: 'pessoa', emoji: '🤝', rotulo: 'Devo pra uma pessoa', tipo: 'consumo' },
];

/** `undefined` para id desconhecido — param de rota é entrada não confiável. */
export function tipoPorId(id: string): TipoDeDivida | undefined {
  return TIPOS_DE_DIVIDA.find((t) => t.id === id);
}
