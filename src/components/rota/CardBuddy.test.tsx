import { render, screen } from '@testing-library/react-native';
import { CardBuddy } from './CardBuddy';
import { umResumo } from '../../test/mocks';

/**
 * O card do buddy é onde o custo diário dos juros chega ao usuário. O número em
 * si é do servidor e tem teste próprio no backend; o que se verifica aqui é o
 * que a pessoa LÊ — inclusive quando o campo não vem.
 */
describe('CardBuddy', () => {
  it('mostra a ação sugerida e o CTA', () => {
    render(<CardBuddy resumo={umResumo()} />);
    expect(screen.getByText(/Próxima ação:/)).toBeTruthy();
  });

  it('diz o custo diário quando o campo vem, e a frase chega na leitura de tela', () => {
    render(
      <CardBuddy
        resumo={umResumo({ custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 0 })}
      />,
    );
    expect(screen.getByText(/Hoje, sua dívida cresce R\$ 41,00 por dia\./)).toBeTruthy();
    // O card inteiro é um botão: se a frase não entrar no rótulo, ela não
    // existe para quem usa leitor de tela.
    expect(screen.getByLabelText(/cresce R\$ 41,00 por dia/)).toBeTruthy();
  });

  it('nomeia o que ficou de fora quando parte da carteira não tem taxa', () => {
    render(
      <CardBuddy
        resumo={umResumo({ custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 2 })}
      />,
    );
    expect(
      screen.getByText(/cresce pelo menos R\$ 41,00 por dia — 2 dívidas ainda estão sem a taxa cadastrada\./),
    ).toBeTruthy();
  });

  it('sem o campo, o card fica igual ao que era — e nunca inventa R$ 0,00 por dia', () => {
    const { toJSON } = render(<CardBuddy resumo={umResumo()} />);
    const texto = JSON.stringify(toJSON());

    expect(screen.getByText(/Próxima ação:/)).toBeTruthy();
    expect(texto).not.toContain('por dia');
    expect(texto).not.toContain('R$ 0,00');
  });

  it('campo zerado também não vira frase', () => {
    const { toJSON } = render(
      <CardBuddy resumo={umResumo({ custoDiarioJuros: 0, quantidadeDividasSemTaxa: 0 })} />,
    );
    expect(JSON.stringify(toJSON())).not.toContain('por dia');
  });
});

describe('copy do card do buddy', () => {
  // Gêmeo dos testes que quebram em "recomendada" (M4), "ilegal" (M6) e do
  // sweep de copy do caixa (M7). O custo diário é a frase mais concreta da
  // tela, e por isso a mais fácil de escorregar para cobrança moral.
  const PROIBIDO =
    /culpa|você (está |vem )?perdendo|jogando fora|desperdí|irresponsáv|descuid|vergonha|você deveria|não deveria|se você tivesse|cada segundo|em tempo real|agora mesmo/i;

  it('a frase do crescimento não trata a dívida como falha da pessoa', () => {
    const { toJSON } = render(
      <CardBuddy
        resumo={umResumo({ custoDiarioJuros: 4100, quantidadeDividasSemTaxa: 2 })}
      />,
    );
    expect(JSON.stringify(toJSON())).not.toMatch(PROIBIDO);
  });
});
