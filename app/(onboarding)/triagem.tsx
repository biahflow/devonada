import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { MoneyText } from '../../src/components/ui/MoneyText';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { ErrorState } from '../../src/components/ui/ErrorState';
import { Passos } from '../../src/components/onboarding/Passos';
import { useRevisao } from '../../src/hooks/useRevisao';
import { colors, radius, spacing, typography } from '../../src/theme/theme';

/**
 * O primeiro valor entregue — e a tela onde o produto mais teria tentação de
 * mentir.
 *
 * DUAS VERSÕES DA MESMA TELA, decididas por `valorJusto != null`:
 *
 * - COM CONTRATO LIDO: cobrado × justo lado a lado, com a economia em destaque,
 *   e os achados que a sustentam — cada um com a fonte legal.
 * - SEM CONTRATO: o cobrado sozinho, e no lugar do justo a frase
 *   "ainda não calculado". Não um zero, não uma estimativa, não uma média de
 *   mercado.
 *
 * O MOCKUP DA CONCEPÇÃO PROMETIA "você pode economizar R$ 3.970 com base nas
 * taxas médias do Banco Central" para qualquer dívida. Isso foi abandonado na
 * ADR 0008 e não volta aqui: não existe lei que diga quanto uma dívida deveria
 * custar, e esse número iria com o usuário para uma negociação real. O que a
 * tela pode fazer sem contrato é dizer a verdade e apontar o caminho — que é
 * mandar o documento.
 */
export default function Triagem() {
  const router = useRouter();
  const { id, total } = useLocalSearchParams<{ id: string; total?: string }>();
  const { revisao, isPending, error, refetch } = useRevisao(id ?? '');

  // Quantas dívidas a fila do passo 2 gravou. A triagem é sempre de UMA — a
  // primeira que a pessoa marcou —, então as outras precisam ser nomeadas em
  // algum lugar, ou o app parece ter perdido o que ela acabou de digitar.
  const outras = Math.max(0, Number.parseInt(total ?? '1', 10) - 1) || 0;

  const cabecalho = <Passos atual={3} />;

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        <LoadingState label="Olhando sua dívida" />
      </Screen>
    );
  }

  if (error || !revisao) {
    return (
      <Screen>
        {cabecalho}
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const temJusto = revisao.valorJusto != null;
  const economia = temJusto ? revisao.valorCobrado - revisao.valorJusto! : undefined;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        {cabecalho}

        <View style={styles.chamada}>
          <Text style={styles.microlabel}>{revisao.credor}</Text>
          <Text style={styles.titulo}>
            {temJusto ? 'Essa dívida dá\npra resolver.' : 'Já dá pra\ncomeçar.'}
          </Text>
          {outras > 0 ? (
            <Text style={styles.legenda}>
              {outras === 1
                ? 'A outra que você marcou já está na sua rota.'
                : `As outras ${outras} que você marcou já estão na sua rota.`}
            </Text>
          ) : null}
        </View>

        <View style={styles.duplo}>
          <Card style={styles.metade}>
            <Text style={styles.microlabel}>Estão cobrando</Text>
            <MoneyText centavos={revisao.valorCobrado} size="displaySm" tone="debt" />
          </Card>
          <Card style={styles.metade}>
            <Text style={styles.microlabel}>Valor justo</Text>
            {temJusto ? (
              <MoneyText centavos={revisao.valorJusto!} size="displaySm" tone="accent" />
            ) : (
              <Text style={styles.ausente}>ainda não calculado</Text>
            )}
          </Card>
        </View>

        {temJusto && economia !== undefined ? (
          <>
            <View style={styles.economia}>
              <Text style={styles.microlabel}>Dá pra contestar</Text>
              <MoneyText centavos={economia} size="display" tone="accent" />
              <Text style={styles.legenda}>
                Soma dos pontos que têm fonte legal — não é estimativa nem média de mercado.
              </Text>
            </View>

            <Card>
              <Text style={styles.tituloSecao}>Por quê</Text>
              {revisao.achados.map((a) => (
                <View key={a.id} style={styles.achado}>
                  <Text style={styles.achadoTitulo}>{a.titulo}</Text>
                  <Text style={styles.achadoFonte}>{a.fonte}</Text>
                </View>
              ))}
            </Card>
          </>
        ) : (
          <Card>
            <Text style={styles.tituloSecao}>Pra eu achar o que dá pra contestar</Text>
            <Text style={styles.corpo}>
              Preciso ler a fatura ou o contrato. É de lá que saem os pontos com artigo de lei, o
              valor justo e o script da negociação — e é isso que muda a conversa com o credor.
            </Text>
          </Card>
        )}

        {/* O PERFIL DE MUITOS CREDORES, nomeado sem diagnóstico nenhum (M14).
            Duas ou mais dívidas na fila é o caso em que o script individual não
            resolve — a lei prevê renegociar todas de uma vez, com todos os
            credores juntos.

            AQUI O APP AINDA NÃO SABE SE OS NÚMEROS FECHAM, e não finge que
            sabe: a renda só é informada no Caixa, depois do onboarding. Sem os
            dois lados da conta, a única frase honesta é o CONVITE — "informe a
            renda e eu mostro se cabem" —, jamais uma afirmação sobre a situação
            de quem acabou de cadastrar duas dívidas.

            A palavra que a lei usa para o instituto não aparece: a definição
            legal exige boa-fé e dívida de consumo, e software não apura nenhuma
            das duas (CDC, art. 54-A, § 1º). Quem apura é a conciliação. */}
        {outras > 0 ? (
          <Card>
            <Text style={styles.tituloSecao}>Você marcou mais de uma</Text>
            <Text style={styles.corpo}>
              Quando são várias, negociar uma de cada vez costuma não resolver — e existe um
              caminho previsto em lei para renegociar todas de uma vez, com todos os credores
              na mesma conversa.
            </Text>
            <Text style={styles.corpo}>
              Informe sua renda no Caixa e eu mostro se as parcelas cabem no que sobra. É essa
              conta que diz se vale procurar o Procon ou a Defensoria.
            </Text>
          </Card>
        ) : null}

        <View style={styles.rodape}>
          {temJusto ? (
            <Button
              label="Ver meu script"
              size="lg"
              onPress={() => router.replace(`/dividas/${revisao.dividaId}/revisao` as never)}
            />
          ) : (
            <Button
              label="Mandar a fatura"
              size="lg"
              onPress={() => router.replace('/dividas/contrato')}
            />
          )}
          <Button
            label="Ir pra minha rota"
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
  chamada: { gap: spacing.xs },
  microlabel: {
    ...typography.eyebrow,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  titulo: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  duplo: { flexDirection: 'row', gap: spacing.md },
  metade: { flex: 1 },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
  economia: {
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  legenda: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.sm, lineHeight: 18 },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.md },
  corpo: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  achado: { marginBottom: spacing.md },
  achadoTitulo: { ...typography.caption, color: colors.ink },
  achadoFonte: { ...typography.caption, color: colors.inkSoft, marginTop: 2 },
  rodape: { gap: spacing.sm, marginTop: spacing.md },
});
