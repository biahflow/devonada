import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../src/components/ui/Screen';
import { Button } from '../../src/components/ui/Button';
import { Passos } from '../../src/components/onboarding/Passos';
import { TIPOS_DE_DIVIDA } from '../../src/components/onboarding/tiposDeDivida';
import { colors, radius, spacing, typography } from '../../src/theme/theme';

/**
 * A primeira pergunta do app, e ela não é sobre renda nem sobre CPF.
 *
 * ESCOLHA MÚLTIPLA, e isso mudou na ADR 0016. A concepção pedia uma dívida por
 * vez ("Começa por uma só"), e a intenção era boa: não afogar quem chega em
 * pânico. Só que a carteira real não é assim — cartão E empréstimo é o caso
 * comum, não a exceção —, e quem marcava cartão terminava o onboarding sem
 * caminho óbvio para a segunda dívida. O alívio prometido virava trabalho pela
 * metade.
 *
 * O que segura o susto agora não é limitar a marcação, é o passo 2: a fila pede
 * dois campos por dívida, uma por uma, com a contagem à vista ("1 de 2"). A
 * ordem em que a pessoa marca é a ordem da fila, e a primeira é a que ganha a
 * triagem — porque quem marca primeiro marca o que dói mais.
 */
export default function EscolhaDaDivida() {
  const router = useRouter();
  // Array e não Set: a ORDEM é informação. Ela decide a fila do passo 2 e qual
  // dívida recebe a triagem no fim.
  const [escolhidas, setEscolhidas] = useState<string[]>([]);

  function alternar(id: string) {
    setEscolhidas((atuais) =>
      atuais.includes(id) ? atuais.filter((i) => i !== id) : [...atuais, id],
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <Passos atual={1} />

        <View style={styles.chamada}>
          <Text style={styles.titulo}>Qual dívida tira{'\n'}seu sono?</Text>
          <Text style={styles.ajuda}>
            Marca todas que estão pesando. A gente cadastra uma por uma, rapidinho, e começa pela
            que dói mais — sem pressa e sem sermão.
          </Text>
        </View>

        <View style={styles.opcoes}>
          {TIPOS_DE_DIVIDA.map((o) => {
            const ativa = escolhidas.includes(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => alternar(o.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ativa }}
                style={[styles.opcao, ativa && styles.opcaoAtiva]}
              >
                <Text style={styles.emoji}>{o.emoji}</Text>
                <Text style={styles.rotulo}>{o.rotulo}</Text>
                {/* A borda sozinha bastava para uma escolha só. Com várias
                    marcadas ela fica ambígua — o check diz quais são. */}
                {ativa ? <Feather name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rodape}>
          <Button
            label={escolhidas.length > 1 ? `Continuar com ${escolhidas.length} dívidas` : 'Continuar'}
            size="lg"
            disabled={escolhidas.length === 0}
            onPress={() =>
              router.push({
                pathname: '/(onboarding)/entrada',
                params: { fila: escolhidas.join(',') },
              })
            }
          />
          {/* A SAÍDA IMPORTA TANTO QUANTO A ENTRADA. Obrigar alguém em pânico a
              cadastrar dívida antes de ver o app é o jeito mais rápido de
              perder essa pessoa — e ela volta quando estiver pronta. */}
          <Button
            label="Prefiro só dar uma olhada primeiro"
            variant="ghost"
            onPress={() => router.replace('/painel')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxl, gap: spacing.lg },
  chamada: { gap: spacing.sm },
  titulo: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  ajuda: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  opcoes: { gap: spacing.sm },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 56,
  },
  opcaoAtiva: { borderColor: colors.primary },
  emoji: { fontSize: 18 },
  rotulo: { ...typography.bodyStrong, color: colors.ink, flex: 1 },
  rodape: { gap: spacing.sm, marginTop: spacing.md },
});
