import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Button } from '../../../../src/components/ui/Button';
import { Card } from '../../../../src/components/ui/Card';
import { MoneyText } from '../../../../src/components/ui/MoneyText';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../../src/components/ui/EmptyState';
import { AchadoCard } from '../../../../src/components/dividas/AchadoCard';
import { useRevisao } from '../../../../src/hooks/useRevisao';
import { isoParaBR } from '../../../../src/util/date';
import { colors, radius, spacing, typography } from '../../../../src/theme/theme';

/**
 * Revisão de cobrança (M6) — o que fecha o `valor_justo`.
 *
 * Nenhum número desta tela é calculado aqui. `valorJusto` vem pronto do
 * backend; a única conta é `economia = valorCobrado − valorJusto`, a subtração
 * que o guardrail 1.2 permite nominalmente por ser a diferença literal entre
 * dois valores já enviados.
 */
export default function RevisaoDeCobranca() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { revisao, isPending, error, refetch } = useRevisao(id);
  const [copiado, setCopiado] = useState(false);

  const cabecalho = (
    <PageHeader
      eyebrow="Revisão"
      title="O que vale contestar"
      description="Cada ponto abaixo vem com a fonte e o trecho do seu contrato."
      onBack={() => router.back()}
    />
  );

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        <LoadingState label="Conferindo o contrato" />
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

  // DOIS vazios diferentes, e confundi-los mentiria. Sem contrato lido não
  // sabemos nada; com contrato lido e sem achado, sabemos algo — e o que
  // sabemos é limitado ao que este produto consegue conferir.
  if (revisao.achados.length === 0) {
    return (
      <Screen>
        {cabecalho}
        <EmptyState
          icon="file-text"
          title="Ainda não dá para conferir esta cobrança"
          description={
            'A revisão lê o contrato para achar encargos como multa, tarifa de cadastro e ' +
            'seguro embutido. Envie o contrato desta dívida e a gente confere ponto a ponto.'
          }
          actionLabel="Enviar contrato"
          onAction={() => router.push('/dividas/contrato')}
          secondaryLabel="Voltar para a dívida"
          onSecondary={() => router.push(`/dividas/${id}`)}
        />
      </Screen>
    );
  }

  async function copiarScript() {
    if (!revisao?.script) return;
    await Clipboard.setStringAsync(revisao.script);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const economia =
    revisao.valorJusto != null ? revisao.valorCobrado - revisao.valorJusto : null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        {cabecalho}

        {revisao.valorJusto != null ? (
          <Card>
            <Text style={styles.eyebrow}>{revisao.credor}</Text>
            <View style={styles.comparativo}>
              <View style={styles.coluna}>
                <Text style={styles.legenda}>Cobrado</Text>
                <MoneyText centavos={revisao.valorCobrado} tone="inkSoft" strikethrough />
              </View>
              <Text style={styles.seta}>→</Text>
              <View style={styles.coluna}>
                <Text style={styles.legenda}>Se acolherem os pontos</Text>
                <MoneyText centavos={revisao.valorJusto} size="displaySm" tone="accent" />
              </View>
            </View>
            {economia && economia > 0 ? (
              <Text style={styles.economia}>
                São <MoneyText centavos={economia} size="body" tone="ink" /> em jogo nesta
                conversa com o credor.
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Text style={styles.eyebrow}>{revisao.credor}</Text>
            <Text style={styles.semNumero}>
              Os pontos abaixo valem levantar, mas nenhum deles tem um valor que a gente consiga
              apurar sozinho. Por isso não mostramos um número aqui.
            </Text>
          </Card>
        )}

        <View style={styles.achados}>
          {revisao.achados.map((achado) => (
            <AchadoCard key={achado.id} achado={achado} />
          ))}
        </View>

        {revisao.baseLegalVigenteEm ? (
          <Text style={styles.vigencia}>
            Tetos de juros vigentes em {isoParaBR(revisao.baseLegalVigenteEm)}.
          </Text>
        ) : null}

        {revisao.script ? (
          <Card style={styles.scriptCard}>
            <Text style={styles.scriptTitulo}>Mensagem para o credor</Text>
            <Text style={styles.scriptTexto} selectable>
              {revisao.script}
            </Text>
            <Text style={styles.scriptNota}>
              É uma sugestão. Leia, ajuste com suas palavras e envie você mesmo.
            </Text>
            <Button
              label={copiado ? 'Copiado ✓' : 'Copiar mensagem'}
              onPress={copiarScript}
              style={styles.botao}
            />
          </Card>
        ) : null}

        <Text style={styles.disclaimer}>
          Estimativa educacional. Não é aconselhamento jurídico.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  eyebrow: {
    ...typography.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparativo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  coluna: { gap: 2, flexShrink: 1 },
  legenda: { ...typography.caption, color: colors.inkSoft },
  seta: { ...typography.title, color: colors.inkSoft, paddingHorizontal: spacing.sm },
  economia: {
    ...typography.caption,
    color: colors.ink,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  semNumero: { ...typography.caption, color: colors.ink, fontSize: 14, lineHeight: 20 },
  achados: { gap: spacing.md },
  vigencia: { ...typography.caption, color: colors.inkSoft, fontSize: 11 },
  scriptCard: { gap: spacing.sm },
  scriptTitulo: { ...typography.bodyStrong, color: colors.ink },
  scriptTexto: { ...typography.caption, color: colors.ink, fontSize: 14, lineHeight: 20 },
  scriptNota: { ...typography.caption, color: colors.inkSoft },
  botao: { marginTop: spacing.xs },
  disclaimer: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
