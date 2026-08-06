import type { CriticidadeTipo, Divida } from '../api/types';

export type OrdemDivida = 'criticidade' | 'valor' | 'vencimento';

/**
 * Ordem de ataque por consequência de não pagar, conforme docs/domain.md.
 * Não é julgamento moral do gasto: é medida de custo de continuar parado.
 */
const PESO_CRITICIDADE: Record<CriticidadeTipo, number> = {
  juros_abusivos: 0, // cresce mais rápido — atacar primeiro
  com_garantia: 1, // risco de perder o bem
  essencial: 2, // nunca sacrificar, mas raramente é o que explode
  consumo: 3, // maior espaço de negociação
};

/**
 * Ordenação e comparação são permitidas no cliente (guardrail 1.2) — o que é
 * proibido é PRODUZIR valor derivado. Nada aqui soma, aplica taxa ou projeta.
 *
 * Retorna um array novo: `sort` muta, e mutar o dado do cache do TanStack Query
 * causa render inconsistente.
 */
export function ordenarDividas(dividas: readonly Divida[], ordem: OrdemDivida): Divida[] {
  const copia = [...dividas];

  switch (ordem) {
    case 'valor':
      // Maior primeiro: é o que o usuário procura quando abre por valor.
      return copia.sort((a, b) => b.valorCobrado - a.valorCobrado);

    case 'vencimento':
      // proximoVencimento ainda não vem do backend. Ausente vai para o fim, em
      // vez de quebrar a lista ou fingir uma data.
      return copia.sort((a, b) => {
        if (!a.proximoVencimento && !b.proximoVencimento) return 0;
        if (!a.proximoVencimento) return 1;
        if (!b.proximoVencimento) return -1;
        return a.proximoVencimento.localeCompare(b.proximoVencimento);
      });

    case 'criticidade':
      return copia.sort((a, b) => {
        const peso = PESO_CRITICIDADE[a.tipo] - PESO_CRITICIDADE[b.tipo];
        // Empate de criticidade: maior valor primeiro, para a ordem ser estável
        // e previsível entre renders.
        return peso !== 0 ? peso : b.valorCobrado - a.valorCobrado;
      });
  }
}

export const ROTULO_ORDEM: Record<OrdemDivida, string> = {
  criticidade: 'Prioridade',
  valor: 'Valor',
  vencimento: 'Vencimento',
};
