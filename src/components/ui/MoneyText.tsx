import { Text, StyleSheet, type TextStyle } from 'react-native';
import { colors, typography } from '../../theme/theme';
import { formatBRL } from '../../util/money';

type Size = 'body' | 'numeric' | 'displaySm' | 'display';
type Tone = 'ink' | 'inkSoft' | 'accent' | 'onPrimary' | 'warning';

interface Props {
  /** Valor em CENTAVOS inteiros. Nunca reais, nunca float. */
  centavos: number;
  size?: Size;
  tone?: Tone;
  /** Risca o valor — usado para "cobrado" ao lado do "justo". */
  strikethrough?: boolean;
  style?: TextStyle;
}

const sizes: Record<Size, TextStyle> = {
  body: typography.body,
  numeric: typography.numeric,
  displaySm: typography.displaySm,
  display: typography.display,
};

const tones: Record<Tone, string> = {
  ink: colors.ink,
  inkSoft: colors.inkSoft,
  accent: colors.accent,
  onPrimary: colors.onPrimary,
  // Para valor negativo que o usuário precisa notar — capacidade que não fecha.
  // `warning`, nunca `danger`: quem chega nesse número já está com medo, e o
  // vermelho de alarme é o que os apps tradicionais fazem (guardrail 4).
  warning: colors.warning,
};

/** Só os tamanhos grandes recuam o símbolo; em corpo de texto ficaria ruidoso. */
const simboloRecuado: Record<Size, boolean> = {
  body: false,
  numeric: false,
  displaySm: true,
  display: true,
};

/**
 * Única superfície de exibição de dinheiro. Centraliza `formatBRL` para que uma
 * mudança de formatação aconteça num arquivo só.
 *
 * Nos tamanhos grandes o "R$" sai menor que os dígitos, como no reference: o
 * símbolo é constante em todas as linhas e não precisa competir com o número.
 *
 * **Não há `fontVariant: ['tabular-nums']` aqui de propósito.** A garantia de
 * dígito tabular vem da FONTE — Nunito Sans tem largura fixa por padrão (ver
 * `theme.ts`) — e pedir um recurso OpenType que a família não declara é um
 * caminho conhecido para o texto cair em fonte de sistema no Android. Trocar a
 * fonte por uma proporcional quebra as colunas de valor: meça antes.
 */
export function MoneyText({
  centavos,
  size = 'numeric',
  tone = 'ink',
  strikethrough,
  style,
}: Props) {
  const texto = formatBRL(centavos);
  const corpo = [
    sizes[size],
    { color: tones[tone] },
    strikethrough && styles.strike,
    style,
  ];

  if (!simboloRecuado[size]) {
    return <Text style={corpo}>{texto}</Text>;
  }

  // "-R$ 1.234,56" → sinal + símbolo + dígitos, preservando o menos à esquerda.
  const partes = /^(-?)(R\$)\s*(.*)$/.exec(texto);
  if (!partes) return <Text style={corpo}>{texto}</Text>;
  const [, sinal, simbolo, digitos] = partes;

  return (
    <Text style={corpo}>
      <Text style={[styles.simbolo, { fontSize: Math.round(0.62 * sizes[size].fontSize!) }]}>
        {sinal}
        {simbolo}{' '}
      </Text>
      {digitos}
    </Text>
  );
}

const styles = StyleSheet.create({
  simbolo: { fontFamily: typography.body.fontFamily },
  strike: { textDecorationLine: 'line-through' },
});
