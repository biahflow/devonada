import type { CriticidadeTipo, Divida } from '../api/types';
import { ordenarDividas } from './dividas';

function divida(
  id: string,
  tipo: CriticidadeTipo,
  valorCobrado: number,
  proximoVencimento?: string,
): Divida {
  return {
    id,
    credor: `Credor ${id}`,
    valorCobrado,
    dataOrigem: '2021-06-01',
    tipo,
    proximoVencimento,
  };
}

describe('ordenarDividas', () => {
  it('não muta o array recebido', () => {
    const original = [divida('a', 'consumo', 100), divida('b', 'juros_abusivos', 200)];
    const copia = [...original];
    ordenarDividas(original, 'criticidade');
    expect(original).toEqual(copia);
  });

  describe('por criticidade', () => {
    it('ataca primeiro o que cresce mais rápido', () => {
      const lista = [
        divida('consumo', 'consumo', 100),
        divida('essencial', 'essencial', 100),
        divida('garantia', 'com_garantia', 100),
        divida('juros', 'juros_abusivos', 100),
      ];
      expect(ordenarDividas(lista, 'criticidade').map((d) => d.id)).toEqual([
        'juros',
        'garantia',
        'essencial',
        'consumo',
      ]);
    });

    it('desempata por maior valor, para a ordem ser estável', () => {
      const lista = [
        divida('menor', 'juros_abusivos', 5000),
        divida('maior', 'juros_abusivos', 90000),
      ];
      expect(ordenarDividas(lista, 'criticidade').map((d) => d.id)).toEqual(['maior', 'menor']);
    });
  });

  describe('por valor', () => {
    it('coloca o maior primeiro', () => {
      const lista = [
        divida('medio', 'consumo', 50000),
        divida('alto', 'consumo', 150000),
        divida('baixo', 'consumo', 1000),
      ];
      expect(ordenarDividas(lista, 'valor').map((d) => d.id)).toEqual(['alto', 'medio', 'baixo']);
    });
  });

  describe('por vencimento', () => {
    it('ordena do mais próximo ao mais distante', () => {
      const lista = [
        divida('depois', 'consumo', 100, '2024-12-01'),
        divida('antes', 'consumo', 100, '2024-03-01'),
      ];
      expect(ordenarDividas(lista, 'vencimento').map((d) => d.id)).toEqual(['antes', 'depois']);
    });

    it('joga para o fim quem não tem vencimento, sem quebrar a lista', () => {
      const lista = [
        divida('sem', 'consumo', 100),
        divida('com', 'consumo', 100, '2024-03-01'),
        divida('outroSem', 'consumo', 100),
      ];
      const ids = ordenarDividas(lista, 'vencimento').map((d) => d.id);
      expect(ids[0]).toBe('com');
      expect(ids.slice(1).sort()).toEqual(['outroSem', 'sem']);
    });

    it('sobrevive a uma lista inteira sem vencimento — o caso do backend atual', () => {
      const lista = [divida('a', 'consumo', 100), divida('b', 'consumo', 200)];
      expect(ordenarDividas(lista, 'vencimento')).toHaveLength(2);
    });
  });

  it('lida com lista vazia', () => {
    expect(ordenarDividas([], 'criticidade')).toEqual([]);
  });
});
