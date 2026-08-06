import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { EmptyState } from '../../../src/components/ui/EmptyState';

export default function DividasScreen() {
  return (
    <Screen>
      <PageHeader
        eyebrow="Raio-x"
        title="Suas dívidas"
        description="Um retrato honesto do que existe hoje, sem susto."
      />
      <EmptyState
        icon="file-text"
        title="Ainda não há dívidas aqui"
        description="O cadastro de dívidas chega no M1. Por enquanto, converse com o buddy na aba Chat."
      />
    </Screen>
  );
}
