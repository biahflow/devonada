import type { ActionCardData } from '../../api/types';
import { ValorJustoCard } from './ValorJustoCard';
import { InfoCard } from './InfoCard';
import { DividaResumoCard } from './DividaResumoCard';
import { PlanoSugeridoCard } from './PlanoSugeridoCard';

/**
 * Despacha o card certo pelo campo discriminante `kind`.
 *
 * O switch é EXAUSTIVO de propósito: sem `default`, acrescentar um `kind` à
 * união sem tratá-lo aqui vira erro de compilação. Antes havia um
 * `default: null`, que transformava card não tratado em card invisível — o
 * pior modo de falha possível numa tela onde o card é quem carrega o número.
 */
export function ActionCard({ card }: { card: ActionCardData }) {
  switch (card.kind) {
    case 'valor_justo':
      return <ValorJustoCard data={card} />;
    case 'info':
      return <InfoCard data={card} />;
    case 'divida_resumo':
      return <DividaResumoCard data={card} />;
    case 'plano_sugerido':
      return <PlanoSugeridoCard data={card} />;
  }
}
