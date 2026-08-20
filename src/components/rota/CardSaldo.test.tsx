import { render, screen } from '@testing-library/react-native';
import { CardSaldo } from './CardSaldo';
import { umResumo } from '../../test/mocks';

describe('CardSaldo', () => {
  it('sem histórico, esconde a barra e mostra só o número e a contagem', () => {
    render(
      <CardSaldo
        resumo={umResumo({
          saldoInicialDaRota: null,
          rotaPercorridaBps: null,
          quantidadeDividas: 3,
        })}
      />,
    );

    expect(screen.getByText('em 3 dívidas')).toBeTruthy();
    expect(screen.queryByTestId('rota-preenchimento')).toBeNull();
    expect(screen.queryByText(/da rota percorrida/)).toBeNull();
  });

  it('com histórico e zero percorrido, a barra aparece vazia — não escondida', () => {
    render(
      <CardSaldo
        resumo={umResumo({
          saldoInicialDaRota: 4850000,
          rotaPercorridaBps: 0,
        })}
      />,
    );

    expect(screen.getByText(/0% da rota percorrida/)).toBeTruthy();
    const preenchimento = screen.getByTestId('rota-preenchimento');
    expect(largura(preenchimento)).toBe('0%');
  });

  it('converte basis points para largura em porcentagem, sem inverter', () => {
    // 2740 bps = 27,40% já percorrido. A ETIQUETA arredonda para 27% — duas
    // casas são para taxa de juros, não para progresso —, mas a LARGURA usa a
    // fração exata. A barra enche com o que já foi andado, nunca com o que
    // falta (72,6%).
    render(
      <CardSaldo
        resumo={umResumo({
          totalDevido: 6630000,
          saldoInicialDaRota: 9100000,
          rotaPercorridaBps: 2740,
        })}
      />,
    );

    expect(screen.getByText(/27% da rota percorrida/)).toBeTruthy();
    expect(screen.getByText('R$ 91.000,00')).toBeTruthy();
    const preenchimento = screen.getByTestId('rota-preenchimento');
    expect(largura(preenchimento)).toBe('27.4%');
  });
});

function largura(elemento: ReturnType<typeof screen.getByTestId>): unknown {
  const estilo = elemento.props.style;
  for (const camada of Array.isArray(estilo) ? estilo.flat(3) : [estilo]) {
    const valor = (camada as { width?: unknown } | undefined)?.width;
    if (valor !== undefined) return valor;
  }
  return undefined;
}
