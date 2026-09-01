import { useState } from 'react';
import { Linking, Pressable, View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius, spacing, typography } from '../../theme/theme';
import type { FonteJuridica, Trilha } from '../../api/types';

interface Props {
  trilha: Trilha;
  /** O corpus de `useFontesJuridicas`. Vazio enquanto não chegou — e tudo bem. */
  fontes: Map<string, FonteJuridica>;
}

/**
 * "Como calculamos" — a trilha de auditoria de um número, na tela (M14).
 *
 * O BACKEND SEMPRE TEVE A FONTE, em docstring. `domain/minimo_existencial.py`
 * cita o Decreto 11.150 e conta que a redação mudou; `domain/prescricao.py`
 * cita o Código Civil e avisa que o resultado é sinal, não sentença. Nada disso
 * saía do repositório: o usuário via o número e tinha de acreditar — a única
 * coisa que este produto pede em toda parte que ele NÃO faça.
 *
 * FECHADO POR PADRÃO, e é postura, não economia de espaço. Quem abre a tela do
 * caixa quer saber quanto sobra; despejar a memória de cálculo junto do número
 * transformaria a resposta em parede de texto e faria a explicação competir com
 * o que ela explica. Quem quiser conferir toca uma vez.
 *
 * AS LIMITAÇÕES NÃO SÃO RODAPÉ. Elas vêm com o mesmo peso dos passos, porque
 * são a metade que importa: é ali que o app diz o que aquela conta NÃO faz — que
 * o mínimo existencial não cresce por dependente, que a prescrição depende de
 * interrupção que ninguém aqui conhece. Uma versão desta tela que escondesse
 * esse bloco viraria propaganda da própria conta.
 *
 * O TEXTO É TODO DO SERVIDOR. O front não reescreve nem resume nada daqui — é a
 * mesma regra do achado e do script (guardrail 3): fundamento legal é curado no
 * backend, revisado por humano, e a tela só renderiza.
 */
export function ComoCalculamos({ trilha, fontes }: Props) {
  const [aberto, setAberto] = useState(false);

  return (
    <View style={styles.bloco}>
      <Pressable
        onPress={() => setAberto((a) => !a)}
        accessibilityRole="button"
        accessibilityLabel={trilha.titulo}
        // O leitor de tela precisa saber que há conteúdo escondido, e se ele
        // está aberto — sem isto o controle anuncia só o rótulo, e quem não vê
        // a seta não sabe que existe algo a expandir.
        accessibilityState={{ expanded: aberto }}
        style={({ pressed }) => [styles.gatilho, pressed && styles.pressionado]}
        // 48pt de alvo é o piso do produto para controle sem texto grande.
        hitSlop={8}
      >
        <Text style={styles.rotulo}>Como calculamos</Text>
        <Feather name={aberto ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkSoft} />
      </Pressable>

      {aberto ? (
        <View style={styles.corpo}>
          <Text style={styles.titulo}>{trilha.titulo}</Text>

          {/* A fórmula em uma linha, antes dos passos: quem entende de conta
              resolve aqui e não precisa ler o resto. */}
          <Text style={styles.formula}>{trilha.formula}</Text>

          <View style={styles.lista}>
            {trilha.passos.map((passo) => (
              <Text key={passo} style={styles.passo}>
                • {passo}
              </Text>
            ))}
          </View>

          <Text style={styles.subtitulo}>O que esta conta não faz</Text>
          <View style={styles.lista}>
            {trilha.limitacoes.map((limitacao) => (
              <Text key={limitacao} style={styles.limitacao}>
                • {limitacao}
              </Text>
            ))}
          </View>

          {trilha.fonteIds.length > 0 ? (
            <>
              <Text style={styles.subtitulo}>Em que isso se apoia</Text>
              <View style={styles.lista}>
                {trilha.fonteIds.map((id) => {
                  const fonte = fontes.get(id);
                  // Corpus ainda não chegou (ou id que o servidor não conhece):
                  // some em vez de virar linha vazia. O número que a trilha
                  // explica continua na tela, e o disclosure volta a ter a norma
                  // assim que a requisição responder.
                  return fonte ? <FonteLinha key={id} fonte={fonte} /> : null;
                })}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Uma norma: título, a nossa frase sobre ela, e o texto literal quando existe.
 *
 * A EMENTA E O TEXTO TÊM PESOS DIFERENTES de propósito. `ementa` é paráfrase
 * nossa, em pt-BR para leigo; `texto` é o dispositivo como a lei o escreveu, e
 * vem entre aspas, recuado. Renderizar os dois iguais faria a nossa frase ser
 * lida como se fosse a lei — que é o erro que este componente inteiro existe
 * para não cometer.
 */
function FonteLinha({ fonte }: { fonte: FonteJuridica }) {
  return (
    <View style={styles.fonte}>
      <Text style={styles.fonteTitulo}>
        {fonte.norma}, {fonte.dispositivo}
      </Text>
      <Text style={styles.fonteEmenta}>{fonte.ementa}</Text>
      {fonte.texto ? <Text style={styles.fonteTexto}>“{fonte.texto}”</Text> : null}
      <Pressable
        onPress={() => Linking.openURL(fonte.url)}
        accessibilityRole="link"
        accessibilityLabel={`Abrir ${fonte.norma}, ${fonte.dispositivo} na fonte oficial`}
        hitSlop={8}
      >
        {/* A VIGÊNCIA FICA JUNTO DO LINK, e não escondida: é ela que diz a
            IDADE do fundamento. O mínimo existencial já foi 25% do salário
            mínimo, e usar a redação velha custava R$ 220,50 de piso a quem
            estava negociando — o usuário merece ver de quando é o número. */}
        <Text style={styles.fonteLink}>Ler na fonte oficial · vigente desde {fonte.vigencia}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: spacing.sm },
  gatilho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  pressionado: { opacity: 0.7 },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  corpo: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.neutralSurface,
  },
  titulo: { ...typography.bodyStrong, color: colors.ink },
  formula: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic', lineHeight: 19 },
  subtitulo: { ...typography.caption, color: colors.ink, fontFamily: typography.bodyStrong.fontFamily },
  lista: { gap: spacing.xs },
  passo: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  limitacao: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  fonte: { gap: 2, paddingTop: spacing.xs },
  fonteTitulo: { ...typography.caption, color: colors.ink },
  fonteEmenta: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  fonteTexto: {
    ...typography.caption,
    color: colors.inkSoft,
    fontStyle: 'italic',
    lineHeight: 19,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    marginTop: spacing.xs,
  },
  fonteLink: { ...typography.caption, color: colors.primaryDeep, marginTop: spacing.xs },
});
