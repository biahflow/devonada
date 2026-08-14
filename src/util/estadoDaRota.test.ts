import { estadoDaRota } from './estadoDaRota';
import type { ResumoDividas } from '../api/types';

function resumo(parcial: Partial<ResumoDividas>): ResumoDividas {
  return {
    totalDevido: 0,
    totalQuitadoNoAno: 0,
    quantidadeDividas: 0,
    porCriticidade: [],
    proximosVencimentos: [],
    evolucaoSaldo: [],
    ...parcial,
  };
}

describe('estadoDaRota', () => {
  it('há saldo devedor ⇒ vermelho', () => {
    expect(estadoDaRota(resumo({ quantidadeDividas: 3, totalDevido: 1834000 }))).toBe('divida');
  });

  it('teve dívida e zerou ⇒ verde', () => {
    expect(estadoDaRota(resumo({ quantidadeDividas: 3, totalDevido: 0 }))).toBe('quitado');
  });

  // O caso que existe para impedir o ponto de nascer verde. Conta nova não é
  // vitória, e dar os parabéns por uma corrida que a pessoa não começou
  // esvaziaria o verde justamente para quem um dia vai merecê-lo.
  it('conta nova, sem dívida cadastrada ⇒ neutro, NUNCA verde', () => {
    expect(estadoDaRota(resumo({ quantidadeDividas: 0, totalDevido: 0 }))).toBe('neutro');
  });

  it('resumo ainda não carregado ⇒ neutro', () => {
    expect(estadoDaRota(undefined)).toBe('neutro');
  });

  // Enquanto o M12 não trouxer o registro de negociação, nada produz âmbar.
  // Este teste falha no dia em que alguém derivar `negociando` de
  // `renegociada` — que é uma dívida com condições novas, não uma dívida em
  // acordo aberto.
  it('não produz âmbar a partir de dado que não afirma negociação', () => {
    const estados = [
      estadoDaRota(resumo({ quantidadeDividas: 1, totalDevido: 500000 })),
      estadoDaRota(resumo({ quantidadeDividas: 1, totalDevido: 0 })),
      estadoDaRota(resumo({})),
    ];
    expect(estados).not.toContain('negociando');
  });
});
