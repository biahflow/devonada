import { Screen } from '../../src/components/ui/Screen';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { EmptyState } from '../../src/components/ui/EmptyState';

export default function PainelScreen() {
  return (
    <Screen>
      <PageHeader
        eyebrow="Diagnóstico"
        title="Painel"
        description="Quanto pesa, para onde vai e o que muda se você agir."
      />
      <EmptyState
        icon="pie-chart"
        title="Sem dados para mostrar"
        description="O painel de endividamento chega no M2, depois que houver dívidas cadastradas."
      />
    </Screen>
  );
}
