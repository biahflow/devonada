import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand } from '../ui/Brand';
import { useEstadoDaRota } from '../../hooks/useEstadoDaRota';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * O topo da Rota: o wordmark com o ponto de status, e o atalho para as
 * preferências.
 *
 * O PONTO É A RAZÃO DESTE COMPONENTE EXISTIR. Uma tela de painel não precisa
 * exibir o nome do próprio app — todo mundo sabe qual app abriu. Ele está aqui
 * porque o ponto reporta a rota da pessoa, e a Rota é onde ela olha todo dia:
 * é aqui que a mudança de vermelho para verde vai ser vista.
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
