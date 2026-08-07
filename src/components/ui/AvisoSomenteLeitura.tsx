import { Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useAssinatura } from '../../hooks/useAssinatura';
import { colors, spacing, typography } from '../../theme/theme';

/**
 * A faixa que aparece quando o teste acabou.
 *
 * É a metade HONESTA do paywall. A outra é o 402 que o servidor devolve — essa
 * é a garantia, e nenhuma tela pode esquecê-la. Esta aqui existe para a pessoa
 * entender ANTES de tentar, em vez de descobrir errando: um app que aceita o
 * toque, abre o formulário, deixa preencher e só então recusa desperdiça o
 * trabalho de quem já está sem dinheiro.
 *
 * `warning` e nunca `danger` (guardrail 4). Assinatura vencida não é uma
 * emergência financeira do usuário, e pintar de vermelho a barra inteira do app
 * de alguém endividado é exatamente a ansiedade que este produto existe para
 * não produzir.
 *
 * NÃO ESCONDE NADA. Ela é uma faixa acima do conteúdo, não um bloqueio: tudo o
 * que já está cadastrado continua à vista e rolável por baixo dela.
 */
export function AvisoSomenteLeitura() {
  const router = useRouter();
  const { situacao } = useAssinatura();

  // Enquanto carrega, nada. Piscar "somente leitura" para quem está em dia, no
  // instante entre montar e responder, seria mentir por um quadro.
  if (!situacao || situacao.podeEscrever) return null;

  return (
    <Pressable
      onPress={() => router.push('/painel/assinatura')}
      style={styles.faixa}
      accessibilityRole="button"
      accessibilityLabel="Modo somente leitura. Toque para ver a assinatura."
    >
      <Feather name="lock" size={16} color={colors.warning} />
      <Text style={styles.texto}>
        <Text style={styles.forte}>Somente leitura.</Text> Você continua vendo tudo; para registrar
        ou alterar, assine.
      </Text>
      <Feather name="chevron-right" size={16} color={colors.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.warningSurface,
    // Borda em CIMA: a faixa mora logo acima da barra de abas, então é do
    // conteúdo que ela precisa se separar, não do que vem depois.
    borderTopWidth: 1,
    borderTopColor: colors.warningBorder,
  },
  texto: { ...typography.caption, color: colors.ink, flex: 1 },
  forte: { ...typography.bodyStrong, fontSize: 13, lineHeight: 18, color: colors.ink },
});
