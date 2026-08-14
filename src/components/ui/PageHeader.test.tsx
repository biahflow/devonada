import { render, screen, fireEvent } from '@testing-library/react-native';
import { PageHeader } from './PageHeader';

/**
 * A seta de voltar da ADR 0016.
 *
 * O app esconde o header nativo nos seis layouts, então esta seta é a ÚNICA saída
 * de toda tela empilhada — no Android não existe nem o gesto como consolo. Ela
 * precisa ter nome acessível: é um controle sem texto visível, e sem
 * `accessibilityLabel` fica muda para quem usa leitor de tela
 * (docs/design-system.md, seção 5).
 */
describe('PageHeader', () => {
  it('sem onBack não existe seta nenhuma', () => {
    render(<PageHeader title="Suas parcelas" />);
    expect(screen.queryByLabelText('Voltar')).toBeNull();
  });

  it('com onBack a seta tem nome e chama o handler', () => {
    const voltar = jest.fn();
    render(<PageHeader title="Suas parcelas" onBack={voltar} />);

    fireEvent.press(screen.getByLabelText('Voltar'));

    expect(voltar).toHaveBeenCalledTimes(1);
  });

  // O slot `action` fica à direita e a seta acima: adicionar uma não pode ter
  // custado a outra, porque várias telas usam as duas ao mesmo tempo.
  it('a seta convive com o slot de ação', () => {
    render(
      <PageHeader
        titleLead="Suas"
        title="dívidas"
        onBack={() => {}}
        action={<PageHeader title="marcador" />}
      />,
    );

    expect(screen.getByLabelText('Voltar')).toBeTruthy();
    expect(screen.getByText('marcador')).toBeTruthy();
  });
});
