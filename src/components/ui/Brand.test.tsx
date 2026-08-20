import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Brand, RESPIRO_EM } from './Brand';
import { colors } from '../../theme/theme';

/**
 * O wordmark é a marca inteira, e as regras dele vêm do brand board — não de
 * gosto. Este arquivo existe porque três delas some sem nada acusar numa
 * refatoração de estilo: o tracking, a área de respiro e a cor do ponto.
 */

/** O que o brand board especifica, para o teste não repetir o que o código diz. */
const TRACKING_ALVO = -0.03;
const TAMANHOS = ['sm', 'md', 'lg', 'hero'] as const;

function estiloDe(size: (typeof TAMANHOS)[number]) {
  render(<Brand size={size} />);
  return StyleSheet.flatten(screen.getByLabelText('devo.nada').props.style);
}

describe('o wordmark', () => {
  it('é lido como "devo.nada", e não como "devo ponto nada"', () => {
    render(<Brand />);
    // O leitor de tela recebe o nome da marca; o ponto é visual, não fonético.
    expect(screen.getByLabelText('devo.nada')).toBeTruthy();
  });

  describe('tracking de −3%, em todos os tamanhos', () => {
    it.each(TAMANHOS)('%s', (size) => {
      const { fontSize, letterSpacing } = estiloDe(size);
      expect(letterSpacing / fontSize).toBeCloseTo(TRACKING_ALVO, 2);
    });
  });

  describe('área de respiro', () => {
    it('vale a altura da letra "d" de Archivo Black, medida da fonte', () => {
      // 737 de 1000 unidades de em — ver `scripts/fonte.js`, `medirGlifo`.
      expect(RESPIRO_EM).toBeCloseTo(0.737, 3);
    });

    it.each(TAMANHOS)('%s reserva a zona morta proporcional ao corpo', (size) => {
      const { fontSize, padding } = estiloDe(size);
      expect(padding).toBe(Math.round(fontSize * RESPIRO_EM));
    });

    it.each(TAMANHOS)('%s devolve a borda esquerda à coluna do conteúdo', (size) => {
      // Sem esta compensação o logo recua para dentro e perde o prumo com o
      // título da tela — área de proteção é restrição sobre os vizinhos, não
      // deslocamento do logo.
      const { padding, marginLeft } = estiloDe(size);
      expect(marginLeft).toBe(-padding);
    });
  });

  describe('o ponto, e só ele, carrega a cor', () => {
    it('o texto do wordmark fica em `ink` sempre', () => {
      expect(estiloDe('md').color).toBe(colors.ink);
    });

    it.each([
      ['divida', colors.debt],
      ['negociando', colors.warning],
      ['quitado', colors.primary],
      ['neutro', colors.inkSoft],
    ] as const)('estado %s pinta o ponto de %s', (estado, esperado) => {
      render(<Brand estado={estado} />);
      const ponto = screen
        .getByLabelText('devo.nada')
        .props.children.find(
          (filho: unknown) =>
            typeof filho === 'object' && filho !== null && 'props' in filho,
        );
      expect(StyleSheet.flatten(ponto.props.style).color).toBe(esperado);
    });

    it('`neutro` NÃO é verde: conta nova não recebe parabéns', () => {
      render(<Brand estado="neutro" />);
      const ponto = screen
        .getByLabelText('devo.nada')
        .props.children.find(
          (filho: unknown) =>
            typeof filho === 'object' && filho !== null && 'props' in filho,
        );
      expect(StyleSheet.flatten(ponto.props.style).color).not.toBe(colors.primary);
    });
  });
});
