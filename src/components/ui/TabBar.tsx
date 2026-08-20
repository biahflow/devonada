import { useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEstadoDaRota } from '../../hooks/useEstadoDaRota';
import type { EstadoDaRota } from '../../util/estadoDaRota';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * A cor que a fase da rota dá à aba ativa.
 *
 * FUNÇÃO PURA E EXPORTADA de propósito: é ela que decide o que a pessoa vê no
 * instante em que quita a última dívida, e uma decisão dessas merece teste sem
 * depender de árvore renderizada nem de animação.
 *
 * `debtText`, não `debt`: o quadrado é objeto gráfico e passaria com o vermelho
 * da marca, mas ele encosta no rótulo, e dois vermelhos quase iguais a 4px um do
 * outro leem como defeito de renderização. Um tom só para os dois (ADR 0018). O
 * vermelho da marca segue intacto onde ele é a marca: o ponto do wordmark.
 *
 * Só `quitado` é verde. `neutro` — conta nova, sem dívida cadastrada — fica no
 * vermelho junto com `divida`, pelo mesmo motivo que o ponto do wordmark não
 * nasce verde: verde é conquista, e não se dá parabéns por corrida que não
 * houve. Ver `src/util/estadoDaRota.ts`.
 */
export function corDaFase(estado: EstadoDaRota): string {
  return estado === 'quitado' ? colors.primary : colors.debtText;
}

/** Curto e suave. Longo o bastante para ser percebido, curto para não atrasar. */
const DURACAO_MS = 220;
/** O quadrado que marca a aba. Quadrado de cantos moles, não círculo nem ícone. */
const MARCA_LADO = 26;

/**
 * Barra de abas: um quadrado por aba, e o quadrado da aba ativa carrega a cor
 * do estado da rota.
 *
 * NÃO HÁ ÍCONE AQUI, e a ausência é a decisão. Cinco pictogramas competindo no
 * rodapé pedem que a pessoa decifre metáforas — um mapa, um alvo, uma caixa de
 * entrada — justamente na hora em que ela quer só trocar de tela. O rótulo
 * escrito já diz o que cada aba é, em português, sem intermediário. O que sobra
 * para o elemento gráfico é a única coisa que o texto não diz sozinho: ONDE
 * ESTOU, e EM QUE FASE eu estou.
 *
 * Vermelho enquanto há dívida, verde quando acabou — o mesmo par do ponto do
 * wordmark (ADR 0015). Quando a pessoa zera, o rodapé inteiro muda de fase com
 * ela, sem ninguém precisar avisar. A leitura sai do cache do resumo, sem
 * requisição nova (ADR 0002).
 *
 * A cor não informa sozinha: o rótulo escrito fica ao lado, e a aba ativa também
 * muda o peso e a cor da fonte. Guardrail de acessibilidade, seção 5.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [semMovimento, setSemMovimento] = useState(false);

  const corAtiva = corDaFase(useEstadoDaRota());

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSemMovimento).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSemMovimento);
    return () => sub.remove();
  }, []);

  // ABAS ESCONDIDAS PRECISAM SER FILTRADAS AQUI, e não são de graça.
  //
  // `href: null` no `_layout.tsx` tira a aba da barra PADRÃO do expo-router.
  // Esta barra é nossa e desenha `state.routes` na mão, então não herda nada
  // disso: sem o filtro abaixo, a aba escondida aparece do mesmo jeito. Foi o
  // que aconteceu com "Metas", que deveria trocar de lugar com "Dívidas" na fase
  // verde (ADR 0017) e estava aparecendo junto com ela.
  //
  // O SINAL É `tabBarItemStyle`, NÃO `href`. O expo-router CONSOME o `href` e o
  // traduz para `tabBarItemStyle: { display: 'none' }` mais um `tabBarButton`
  // que devolve null — ver expo-router/build/layouts/TabsClient.js. Quem procura
  // `options.href` aqui não acha nada: ele já foi embora.
  const visiveis = state.routes
    .map((route, indiceOriginal) => ({ route, indiceOriginal }))
    .filter(({ route }) => {
      const estilo = descriptors[route.key]?.options?.tabBarItemStyle as
        | { display?: string }
        | undefined;
      return estilo?.display !== 'none';
    });

  return (
    <View style={[styles.barra, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {visiveis.map(({ route, indiceOriginal }) => {
        const { options } = descriptors[route.key]!;
        const ativo = state.index === indiceOriginal;
        const rotulo = typeof options.title === 'string' ? options.title : route.name;

        function aoTocar() {
          const evento = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!ativo && !evento.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable
            key={route.key}
            onPress={aoTocar}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={rotulo}
            style={styles.aba}
          >
            <MarcaDaAba ativo={ativo} corAtiva={corAtiva} semMovimento={semMovimento} />
            <Text style={[styles.rotulo, ativo && styles.rotuloAtivo]} numberOfLines={1}>
              {rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * O quadrado de uma aba, que acende na cor da fase quando ela é a ativa.
 *
 * A COR É ANIMADA NO PRÓPRIO QUADRADO, e não com um indicador que desliza por
 * cima. A versão deslizante existiu e foi trocada: um `View` em posição absoluta
 * não sabe onde o flex empilhou o quadrado e o rótulo dentro da aba, então ele
 * precisava adivinhar o deslocamento vertical — e adivinhou errado, aparecendo
 * cortado na borda da barra. Animar a cor no elemento que já está no lugar certo
 * é imune a isso: o alinhamento passa a ser consequência do layout, não de uma
 * constante que alguém mantém à mão.
 *
 * **`isReduceMotionEnabled` é respeitado**: quem pediu menos movimento recebe a
 * troca instantânea, não uma versão mais lenta.
 */
function MarcaDaAba({
  ativo,
  corAtiva,
  semMovimento,
}: {
  ativo: boolean;
  corAtiva: string;
  semMovimento: boolean;
}) {
  const progresso = useDerivedValue(() => {
    const alvo = ativo ? 1 : 0;
    return semMovimento
      ? alvo
      : withTiming(alvo, { duration: DURACAO_MS, easing: Easing.out(Easing.cubic) });
  }, [ativo, semMovimento]);

  // `corAtiva` vai nas dependências porque ela MUDA COM A BARRA JÁ MONTADA: é o
  // que acontece quando a pessoa quita a última dívida e a fase vira verde. O
  // plugin do reanimated costuma capturar isso sozinho; declarar é barato e
  // deixa a intenção escrita para quem mexer aqui depois.
  //
  // QUE A TROCA APAREÇA DE FATO NO APARELHO É ITEM DE DEVICE. O ambiente de
  // teste não reavalia este estilo quando a cor muda, então a garantia aqui vai
  // até `corDaFase` — a decisão está coberta; a pintura, não.
  const animado = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(
        progresso.value,
        [0, 1],
        [colors.neutralSurface, corAtiva],
      ),
    }),
    [corAtiva],
  );

  return <Animated.View style={[styles.marca, animado]} />;
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
  },
  marca: {
    width: MARCA_LADO,
    height: MARCA_LADO,
    borderRadius: radius.sm,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // 48pt de alvo de toque continuam sendo o piso (design-system, seção 5).
    minHeight: 52,
  },
  rotulo: { ...typography.caption, fontSize: 12, color: colors.inkSoft },
  // O ativo vira `ink`: o quadrado já carrega a cor do estado, e repeti-la no
  // texto de 12px gastaria o único elemento colorido da barra em dois lugares.
  rotuloAtivo: { fontFamily: typography.bodyStrong.fontFamily, color: colors.ink },
});
