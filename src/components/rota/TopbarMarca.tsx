import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '../ui/Brand';
import { useEstadoDaRota } from '../../hooks/useEstadoDaRota';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * O topo de toda aba: o wordmark com o ponto de status, e o atalho para as
 * preferências.
 *
 * O PONTO É A RAZÃO DESTE COMPONENTE EXISTIR. Ninguém precisa ser lembrado de
 * qual app abriu; o que muda é o ponto, que reporta a rota da pessoa. Ele
 * nasceu só na Rota, por ser a tela do dia a dia — e passou a viver nas quatro
 * abas, porque a mudança de vermelho para verde é o acontecimento do produto e
 * não deveria depender de a pessoa estar na aba certa para ser vista.
 *
 * Fica FORA da área que rola, em todas elas: um wordmark que sobe junto com o
 * conteúdo leva embora o ponto justamente em lista longa e conversa longa.
 */
export function TopbarMarca() {
  const router = useRouter();
  const estado = useEstadoDaRota();

  return (
    <View style={styles.barra}>
      <Brand size="sm" estado={estado} />
      <Pressable
        onPress={() => router.push('/painel/preferencias')}
        accessibilityRole="button"
        accessibilityLabel="Preferências"
        style={({ pressed }) => [styles.avatar, pressed && styles.pressionado]}
      >
        <Text style={styles.inicial}>eu</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSurface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { opacity: 0.7 },
  inicial: { ...typography.caption, color: colors.inkSoft },
});
