import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Brand } from './ui/Brand';
import { colors, spacing, typography } from '../theme/theme';

const CICLO_MS = 1400;

/**
 * A abertura do app.
 *
 * O ponto respira em vermelho, e ISSO É UMA EXCEÇÃO DECLARADA AO GUARDRAIL 4,
 * que proíbe qualquer coisa pulsar. A regra existe contra alarme fabricado —
 * contador de juros correndo, badge de urgência, gamificação que pune atraso.
 * Aqui não há nada em jogo: é a marca se apresentando, uma vez, numa tela onde
 * o usuário não tem decisão nenhuma a tomar. Se um dia esta animação aparecer
 * numa tela com dado ou botão, ela virou o que a regra proíbe.
 *
 * `isReduceMotionEnabled` é respeitado, e quem pediu menos movimento vê o ponto
 * PARADO, não uma versão mais lenta — pulsar devagar continua pulsando. A marca
 * não perde nada: o ponto vermelho já diz o que precisa dizer estático.
 */
export function SplashDevoNada() {
  const [semMovimento, setSemMovimento] = useState(false);
  const opacidade = useSharedValue(1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSemMovimento).catch(() => {});
  }, []);

  useEffect(() => {
    if (semMovimento) {
      opacidade.value = 1;
      return;
    }
    opacidade.value = withRepeat(
      withTiming(0.35, { duration: CICLO_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [semMovimento, opacidade]);

  const brilho = useAnimatedStyle(() => ({ opacity: opacidade.value }));

  return (
    <View style={styles.tela}>
      <View style={styles.marca}>
        {/* O halo mora atrás do ponto e é só ele que anima: animar o wordmark
            inteiro faria a palavra piscar, e a palavra é o nome do produto. */}
        <Animated.View style={[styles.halo, brilho]} pointerEvents="none" />
        <Brand size="hero" estado="divida" />
      </View>
      <Text style={styles.tagline}>Sua rota de saída das dívidas</Text>

      {/* O pé da tela 10. Existe para a espera ter explicação: sem ele, uma
          conexão ruim faz a marca parada parecer app travado. Minúsculo e em
          `inkSoft` porque é informação de estado, não convite. */}
      <Text style={styles.rodape}>carregando...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  marca: { alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.debt,
    // Difuso o bastante para ler como brilho, não como uma bola vermelha atrás
    // do texto — e é o único lugar do app onde o vermelho vira superfície.
    opacity: 0.3,
  },
  tagline: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 220,
  },
  rodape: {
    ...typography.caption,
    color: colors.inkSoft,
    position: 'absolute',
    bottom: spacing.xxxl,
    opacity: 0.7,
  },
});
