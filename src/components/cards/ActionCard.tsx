import type { ActionCardData } from '../../api/types';
import { ValorJustoCard } from './ValorJustoCard';
import { InfoCard } from './InfoCard';

/** Despacha o card certo pelo campo discriminante `kind`. */
export function ActionCard({ card }: { card: ActionCardData }) {
  switch (card.kind) {
    case 'valor_justo':
      return <ValorJustoCard data={card} />;
    case 'info':
      return <InfoCard data={card} />;
    default:
      return null;
  }
}
