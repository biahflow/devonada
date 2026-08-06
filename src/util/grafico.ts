/**
 * Projeção geométrica para os gráficos.
 *
 * ISTO NÃO É CÁLCULO FINANCEIRO. Nenhum valor novo nasce aqui: nada soma, tira
 * média, aplica taxa ou projeta saldo. É conversão de números que o backend já
 * enviou para coordenadas de tela — a mesma natureza de `formatBRL`. O guardrail
 * 1.2 proíbe produzir valor derivado, não desenhar o que já existe.
 */

export interface Ponto {
  x: number;
  y: number;
}

interface Escala {
  pontos: Ponto[];
  /** Menor e maior valor da série, para rotular os extremos. */
  min: number;
  max: number;
}

/**
 * Distribui a série na largura e inverte o eixo Y (em SVG, y cresce para baixo).
 *
 * Casos que precisam sobreviver, porque vão acontecer de verdade:
 * - série vazia: `evolucaoSaldo` vem assim até haver histórico acumulado;
 * - um ponto só: primeiro mês de uso;
 * - todos os valores iguais: nada mudou no período — não pode virar divisão
 *   por zero nem uma linha colada no topo.
 */
export function escalarSerie(
  valores: readonly number[],
  largura: number,
  altura: number,
  padding = 0,
): Escala {
  if (valores.length === 0) return { pontos: [], min: 0, max: 0 };

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const util = Math.max(0, altura - padding * 2);

  // Amplitude zero (um ponto, ou todos iguais): a linha vai para o meio da
  // área útil. Alternativa seria dividir por zero ou grudar na borda.
  const amplitude = max - min;

  const pontos = valores.map((valor, i) => {
    const x = valores.length === 1 ? largura / 2 : (i / (valores.length - 1)) * largura;
    const proporcao = amplitude === 0 ? 0.5 : (valor - min) / amplitude;
    // 1 - proporcao porque o Y do SVG cresce para baixo.
    const y = padding + (1 - proporcao) * util;
    return { x, y };
  });

  return { pontos, min, max };
}

/** Caminho SVG de linha reta entre os pontos. Sem curva: suavizar uma série de
 *  12 pontos inventa valores intermediários que não existem. */
export function caminhoDeLinha(pontos: readonly Ponto[]): string {
  if (pontos.length === 0) return '';
  return pontos
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

/**
 * Proporção de cada valor em relação ao maior da lista, para largura de barra.
 * Devolve 0..1. Lista vazia ou máximo zero devolve zeros — barra sem largura é
 * uma leitura honesta de "não há nada aqui".
 */
export function proporcoes(valores: readonly number[]): number[] {
  if (valores.length === 0) return [];
  const max = Math.max(...valores);
  if (max <= 0) return valores.map(() => 0);
  return valores.map((v) => Math.max(0, v) / max);
}
