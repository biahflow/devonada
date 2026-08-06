/**
 * Dinheiro é sempre inteiro em centavos no app inteiro — nunca float.
 * O backend também deve trafegar centavos. Aritmética inteira aqui evita
 * imprecisão de ponto flutuante.
 */
export function formatBRL(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.trunc(centavos));
  const reais = Math.floor(abs / 100);
  const cents = abs % 100;
  const parteInteira = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const parteCents = String(cents).padStart(2, '0');
  return `${negativo ? '-' : ''}R$ ${parteInteira},${parteCents}`;
}
