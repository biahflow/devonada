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
 *
 * O componente carrega a própria ÁREA DE RESPIRO (ver `RESPIRO_EM` abaixo), então
 * quem o usa não precisa lembrar de afastá-lo dos vizinhos.
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

/**
 * A ÁREA DE RESPIRO DA MARCA, em unidades de em.
 *
 * O brand board define a margem mínima ao redor do logo como "a altura da letra
 * d". Isso é regra, não número — e virou número por MEDIÇÃO, não por estimativa:
 * `node -e "require('./scripts/fonte.js').medirGlifo(...)"` lê a caixa do glifo
 * 'd' direto de ArchivoBlack_400Regular e devolve 737 de 1000 unidades de em.
 *
 * Fica como padding do próprio componente para a regra valer POR CONSTRUÇÃO: se
 * dependesse de quem monta cada tela, ela seria respeitada nas telas que alguém
 * lembrou e violada nas outras, sem nada acusar.
 *
 * O `marginLeft` negativo que acompanha o padding NÃO é gambiarra — é o que
 * separa as duas coisas que a regra mistura. Área de proteção é restrição sobre
 * os VIZINHOS, não deslocamento do logo: com padding sozinho o wordmark recuava
 * para dentro e perdia o prumo com o título da tela, que é o alinhamento de
 * coluna que o design system inteiro persegue (o `PageHeader` faz o mesmo recuo
 * pela mesma razão, na seta de voltar). Com a compensação, a borda esquerda do
 * texto volta à coluna e a zona morta à esquerda cai sobre a margem da tela, que
 * já é vazia. Em cima, embaixo e à direita ela continua valendo de verdade.
 */
export const RESPIRO_EM = 0.737;

const respiro = (fontSize: number) => Math.round(fontSize * RESPIRO_EM);

/** Padding de proteção com a borda esquerda devolvida à coluna do conteúdo. */
function comRespiro(fontSize: number): TextStyle {
  const r = respiro(fontSize);
  return { padding: r, marginLeft: -r };
}

// Archivo Black já é densa: o tracking negativo é o que a impede de parecer
// inflada, e ele cresce com o corpo — fica em −3% em todos os tamanhos, que é o
// que o brand board especifica. Ver design-system.md, seção 3.
const tamanhos: Record<Tamanho, TextStyle> = {
  sm: { fontSize: 18, lineHeight: 22, letterSpacing: -0.5, ...comRespiro(18) },
  md: { fontSize: 24, lineHeight: 29, letterSpacing: -0.7, ...comRespiro(24) },
  lg: { fontSize: 30, lineHeight: 36, letterSpacing: -0.9, ...comRespiro(30) },
  hero: { fontSize: 44, lineHeight: 52, letterSpacing: -1.4, ...comRespiro(44) },
};

const styles = StyleSheet.create({
  base: {
    fontFamily: typography.display.fontFamily,
    color: colors.ink,
  },
});
