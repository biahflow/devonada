/**
 * Taxa de juros é dinheiro disfarçado: sempre BASIS POINTS INTEIROS.
 * 250 = 2,50% a.m. Float aqui sofreria da mesma imprecisão que os centavos
 * resolvem — ver docs/guardrails.md, seção 1.1.
 */
export function formatBasisPoints(bps: number): string {
  const negativo = bps < 0;
  const abs = Math.abs(Math.trunc(bps));
  const inteiro = Math.floor(abs / 100);
  const decimais = String(abs % 100).padStart(2, '0');
  return `${negativo ? '-' : ''}${inteiro},${decimais}%`;
}
