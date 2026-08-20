import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  title: string;
  /**
   * Palavra átona antes do título, em peso regular: "Suas **dívidas**".
   * É a assinatura tipográfica do reference — o peso misto na mesma linha faz o
   * cabeçalho falar em vez de rotular. Prefira isto ao `eyebrow`.
   */
  titleLead?: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  /**
   * A seta de voltar. Presente em toda tela empilhada, ausente em raiz de aba.
   *
   * O APP INTEIRO ESCONDE O HEADER NATIVO (`headerShown: false` nos seis
   * layouts), e até a ADR 0016 não havia substituto: a saída era um ghost no fim
   * do scroll, que existia em oito telas e faltava em onze. Quem chegasse ao
   * detalhe de uma dívida por `push` ficava sem caminho de volta que não fosse o
   * gesto — e no Android, sem nada.
   *
   * Passe também nos ramos de carregando e de erro da mesma tela. É justamente
   * quando a rede falha que a pessoa quer sair, e um `ErrorState` sem seta é uma
   * tela sem saída.
   */
  onBack?: () => void;
}

export function PageHeader({
  title,
  titleLead,
  eyebrow,
  description,
  action,
  onBack,
}: Props) {
  return (
    <View style={styles.container}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          // Sem borda nem fundo, ao contrário do `SeletorDeMes`: ali a seta é o
          // controle principal da faixa, aqui ela não pode competir com o
          // título que vem embaixo.
          style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}
        >
          <Feather name="chevron-left" size={24} color={colors.ink} />
        </Pressable>
      ) : null}

      <View style={styles.linha}>
        <View style={styles.texts}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} accessibilityRole="header">
            {titleLead ? <Text style={styles.lead}>{titleLead} </Text> : null}
            {title}
          </Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.xl, paddingBottom: spacing.lg },
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  voltar: {
    // 48pt de alvo de toque são o piso do design system, seção 5.
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    // `alignSelf` NÃO É OPCIONAL AQUI. O container é uma coluna, e numa coluna o
    // `alignItems` padrão é `stretch`: sem esta linha o Pressable estica pela
    // largura inteira da tela, e o `alignItems: 'center'` de cima — que existe
    // para centralizar o ícone DENTRO do alvo de 48pt — passa a centralizá-lo na
    // tela. A seta aparecia no meio do topo, e o alvo de toque cobria a linha
    // toda. As duas propriedades parecem redundantes e fazem coisas diferentes.
    alignSelf: 'flex-start',
    // O recuo cancela o `paddingHorizontal` do `Screen`: sem ele o ícone fica
    // um passo à direita do título e a coluna do cabeçalho perde o prumo.
    marginLeft: -spacing.lg,
    marginBottom: spacing.xs,
  },
  pressionado: { opacity: 0.6 },
  texts: { flex: 1, gap: spacing.xs },
  eyebrow: { ...typography.eyebrow, color: colors.primary, textTransform: 'uppercase' },
  title: { ...typography.displaySm, color: colors.ink },
  lead: { fontFamily: typography.body.fontFamily },
  description: { ...typography.caption, color: colors.inkSoft },
  action: { paddingTop: spacing.xs },
});
