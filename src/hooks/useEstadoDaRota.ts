import { useState } from 'react';
import { useResumo } from './usePainel';
import { mesAtual } from '../util/mes';
import { estadoDaRota, type EstadoDaRota } from '../util/estadoDaRota';

/**
 * O estado da rota do usuário, para quem precisa colorir a marca.
 *
 * Usa a MESMA chave de cache do painel (`painelKeys.resumo`), então a topbar e
 * a barra de abas não disparam requisição própria — elas leem o resumo que o
 * painel já buscou. E como a chave vive dentro do prefixo `['dividas']`,
 * quitar uma dívida repinta o ponto sozinho, sem que `useQuitarDivida` precise
 * saber que a marca existe (ADR 0002).
 *
 * Fora das abas — na splash e no login — o resumo não carrega, porque não há
 * sessão. `estadoDaRota` devolve `neutro` nesse caso, que é o certo: ali o
 * ponto ainda não tem nada a reportar.
 */
export function useEstadoDaRota(): EstadoDaRota {
  // mesAtual() lê o relógio, então nunca durante o render.
  const [mes] = useState(() => mesAtual());
  const { resumo } = useResumo(mes);
  return estadoDaRota(resumo);
}
