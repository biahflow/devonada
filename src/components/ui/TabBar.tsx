import { useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEstadoDaRota } from '../../hooks/useEstadoDaRota';
import { colors, radius, spacing, typography } from '../../theme/theme';

/** Curto e suave. Longo o bastante para ser percebido, curto para não atrasar. */
const DURACAO_MS = 220;
const PILULA_ALTURA = 34;

/**
 * Barra de abas com indicador que desliza.
 *
 * A barra padrão do react-navigation troca a cor e mais nada — em aparelho ela
 * lê como um rodapé estático, sem relação de causa entre o toque e a mudança. A
 * pílula que desliza dá essa relação: ela mostra DE ONDE para ONDE você foi.
 *
 * O que este componente NÃO faz, por causa do guardrail 4: nada pulsa, nada
 * chama atenção sozinho, nada se move sem o usuário ter tocado. A animação é
 * consequência de uma ação, nunca um chamariz.
 *
 * **`isReduceMotionEnabled` é respeitado**: quem pediu menos movimento no
 * sistema recebe a troca instantânea, não uma versão mais lenta. O estado
 * continua legível porque cor e peso do rótulo mudam junto — o movimento é
 * reforço, nunca o único portador da informação.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [largura, setLargura] = useState(0);
  const [semMovimento, setSemMovimento] = useState(false);
  const x = useSharedValue(0);

  // A ABA ATIVA VERMELHA É A ÚNICA EXCEÇÃO DECORATIVA DO VERMELHO NO APP, e ela
  // marca "onde estou" enquanto existe dívida. Quando a pessoa zera, a barra
  // inteira vira verde junto com o ponto do wordmark — o app muda de fase com
  // ela, sem ninguém precisar avisar. É o mesmo resumo que a Rota já buscou:
  // esta leitura não dispara requisição, sai do cache (ADR 0002).
  const estado = useEstadoDaRota();
  const corAtiva = estado === 'quitado' ? colors.primary : colors.debt;
  const corDaPilula = estado === 'quitado' ? colors.primarySurface : colors.debtSurface;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSemMovimento).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSemMovimento);
    return () => sub.remove();
  }, []);

  const larguraDaAba = largura > 0 ? largura / state.routes.length : 0;

  useEffect(() => {
    if (larguraDaAba === 0) return;
    const destino = state.index * larguraDaAba;
    x.value = semMovimento
      ? destino
      : withTiming(destino, { duration: DURACAO_MS, easing: Easing.out(Easing.cubic) });
  }, [state.index, larguraDaAba, semMovimento, x]);

  const pilula = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={[styles.barra, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
    >
      {larguraDaAba > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pilulaContainer, { width: larguraDaAba }, pilula]}
        >
          <View style={[styles.pilula, { backgroundColor: corDaPilula }]} />
        </Animated.View>
      ) : null}

      {state.routes.map((route, indice) => {
        const { options } = descriptors[route.key]!;
        const ativo = state.index === indice;
        const rotulo =
          typeof options.title === 'string' ? options.title : route.name;

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
            {options.tabBarIcon?.({
              focused: ativo,
              color: ativo ? corAtiva : colors.inkSoft,
              size: 22,
            })}
            <Text
              style={[styles.rotulo, ativo && styles.rotuloAtivo, ativo && { color: corAtiva }]}
              numberOfLines={1}
            >
              {rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: spacing.sm,
  },
  // A pílula ocupa a largura da aba e centraliza o próprio corpo: assim o
  // `translateX` é um múltiplo exato do índice, sem cálculo de offset.
  pilulaContainer: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    height: PILULA_ALTURA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A cor vem por prop, do estado da rota. O valor aqui é só o fallback do
  // primeiro quadro, antes de o resumo chegar do cache.
  pilula: {
    width: 64,
    height: PILULA_ALTURA,
    borderRadius: radius.pill,
    backgroundColor: colors.debtSurface,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    // 48pt de alvo de toque continuam sendo o piso (design-system, seção 5).
    minHeight: 52,
  },
  rotulo: { ...typography.caption, fontSize: 12, color: colors.inkSoft },
  rotuloAtivo: { fontFamily: typography.bodyStrong.fontFamily },
});
