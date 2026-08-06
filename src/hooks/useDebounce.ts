import { useEffect, useState } from 'react';

/**
 * Devolve o valor depois que ele para de mudar por `atrasoMs`.
 *
 * Existe para o slider do simulador: arrastar emite dezenas de valores por
 * segundo, e cada um viraria uma requisição de simulação. Em rede móvel isso é
 * bateria e dado do usuário gastos para produzir resultados que ninguém chega
 * a ler.
 */
export function useDebounce<T>(valor: T, atrasoMs = 400): T {
  const [estabilizado, setEstabilizado] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => setEstabilizado(valor), atrasoMs);
    return () => clearTimeout(id);
  }, [valor, atrasoMs]);

  return estabilizado;
}
