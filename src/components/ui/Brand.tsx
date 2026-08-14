import { Text, StyleSheet, type TextStyle } from 'react-native';
import { colors, typography } from '../../theme/theme';
import type { EstadoDaRota } from '../../util/estadoDaRota';

type Tamanho = 'sm' | 'md' | 'lg' | 'hero';

interface Props {
  /** `sm` topbar · `md` cabeçalho de tela · `lg` login · `hero` splash e vitória */
  size?: Tamanho;
  /** Estado da rota do usuário. Ver `src/util/estadoDaRota.ts`. */
  estado?: EstadoDaRota;
  style?: TextStyle;
}

/**
 * O wordmark `devo.nada`.
 *
 * O CONCEITO INTEIRO DA MARCA ESTÁ NESTE COMPONENTE. `devo.nada` lê-se como
 * duas frases — "Devo. Nada." —, pergunta e resposta, e o ponto entre elas é o
 * único elemento colorido. Ele não reporta a empresa: reporta o usuário.
 * Vermelho enquanto há dívida, verde quando acabou. A jornada do produto é ver
 * esse ponto mudar de cor, e é por isso que ele aparece na splash, no login, na
 * topbar e na tela de vitória — sempre o mesmo componente, sempre o mesmo
 * ponto. Ver ADR 0015.
 *
 * O texto fica em `ink`, sempre. Colorir o wordmark inteiro mataria o ponto:
 * ele só significa alguma coisa porque é a única coisa colorida ali.
 */
export function Brand({ size = 'md', estado = 'neutro', style }: Props) {
  return (
    <Text
      style={[styles.base, tamanhos[size], style]}
      // Um leitor de tela lendo "devo ponto nada" perde a marca e ganha ruído.
      accessibilityRole="header"
      accessibilityLabel="devo.nada"
      allowFontScaling={false}
    >
      devo
      <Text style={{ color: corDoPonto[estado] }}>.</Text>
      nada
    </Text>
  );
}

/**
 * A cor por estado. `neutro` é `inkSoft` de propósito: um ponto apagado diz
 * "ainda não começamos", que é a verdade de quem acabou de criar a conta —
 * verde ali daria os parabéns por uma corrida que não houve.
 */
const corDoPonto: Record<EstadoDaRota, string> = {
  divida: colors.debt,
  negociando: colors.warning,
  quitado: colors.primary,
  neutro: colors.inkSoft,
};

// Archivo Black já é densa: o tracking negativo é o que a impede de parecer
// inflada, e ele cresce com o corpo. Ver design-system.md, seção 3.
const tamanhos: Record<Tamanho, TextStyle> = {
  sm: { fontSize: 18, lineHeight: 22, letterSpacing: -0.5 },
  md: { fontSize: 24, lineHeight: 29, letterSpacing: -0.7 },
  lg: { fontSize: 30, lineHeight: 36, letterSpacing: -0.9 },
  hero: { fontSize: 44, lineHeight: 52, letterSpacing: -1.4 },
};

const styles = StyleSheet.create({
  base: {
    fontFamily: typography.display.fontFamily,
    color: colors.ink,
  },
});
