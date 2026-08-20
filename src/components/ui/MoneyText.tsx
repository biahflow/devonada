import { Text, StyleSheet, type TextStyle } from 'react-native';
import { colors, typography } from '../../theme/theme';
import { formatBRL } from '../../util/money';

type Size = 'body' | 'numeric' | 'displaySm' | 'display';
type Tone = 'ink' | 'inkSoft' | 'accent' | 'onPrimary' | 'warning' | 'debt';

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
  // SALDO DEVEDOR, e só ele — o número que a jornada do produto existe para
  // fazer sumir (ADR 0015). Não use em erro: erro é `danger`, e a tela precisa
  // saber dizer qual dos dois quis dizer.
  //
  // O VALOR AQUI É O DO CORPO DE TEXTO; o tamanho grande usa o outro. Ver
  // `corDoTom` abaixo.
  debt: colors.debtText,
};

/**
 * O `debt` é o único tom que muda de valor com o TAMANHO, e a razão é a WCAG,
 * não estética: `#E5352B` mede 4,35:1 sobre `background` — reprova o piso de
 * 4,5 de texto de corpo e passa o de 3:1, que a WCAG aplica a texto grande.
 *
 * Então `display` e `displaySm` — o número protagonista, 36px e 26px em Archivo
 * Black — ficam no vermelho DA MARCA, o mesmo do ponto do wordmark. `body` e
 * `numeric` (16px e 18px, a coluna de valores) ficam em `debtText`, o mesmo
 * matiz clareado até passar 4,5:1.
 *
 * O efeito é o que a marca quer: o saldo devedor grande, que é a coisa que tem
 * de sumir da tela, é exatamente o vermelho do ponto.
 *
 * A tabela coincide com `simboloRecuado` hoje, e mesmo assim são duas: uma é
 * "onde a WCAG deixa de exigir 4,5", a outra é "onde o R$ recuado fica bonito".
 * Unificá-las amarraria contraste a decisão tipográfica.
 */
const tamanhoGrande: Record<Size, boolean> = {
  body: false,
  numeric: false,
  displaySm: true,
  display: true,
};

function corDoTom(tone: Tone, size: Size): string {
  if (tone === 'debt' && tamanhoGrande[size]) return colors.debt;
  return tones[tone];
}

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
 * **A garantia de dígito tabular não mora aqui, e sim na escala.** Ela vem da
 * FONTE, e a medição está em `theme.ts`: a Archivo Black de `display` e
 * `displaySm` já é tabular (os dez dígitos avançam 667 de 1000), e a Inter de
 * `numeric` não é (1381 contra 883 entre "0" e "1"), por isso `numeric` pede
 * `fontVariant: ['tabular-nums']` — que a Inter atende porque declara `tnum`.
 * Pedir um recurso OpenType que a família NÃO declara é caminho conhecido para
 * o texto cair em fonte de sistema no Android; é por isso que o pedido depende
 * de medição, e é `npm run digits:check` que a refaz.
 *
 * `size="body"` continua sem tabular: ele usa `typography.body`, que é texto
 * corrido, e figura tabular em meio a frase é justamente o que `tnum` não é
 * para fazer. Onde `body` aparece em COLUNA — lista de parcelas, de gastos, de
 * provisões — o alinhamento ainda depende do layout, não da fonte.
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
    { color: corDoTom(tone, size) },
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
