import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { MoneyText } from '../../../../src/components/ui/MoneyText';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { AchadoCard } from '../../../../src/components/dividas/AchadoCard';
import { ScriptCard } from '../../../../src/components/cards/ScriptCard';
import { useRevisao } from '../../../../src/hooks/useRevisao';
import { useDivida } from '../../../../src/hooks/useDividas';
import type { Canal } from '../../../../src/api/types';
import { isoParaBR } from '../../../../src/util/date';
import { ComoCalculamos } from '../../../../src/components/ui/ComoCalculamos';
import { useFontesJuridicas } from '../../../../src/hooks/useJuridico';
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
  const [canal, setCanal] = useState<Canal>('email');
  // Não bloqueia a tela: o número e a citação legível já vieram na revisão.
  const { porId: fontes } = useFontesJuridicas();
  const { revisao, isPending, error, refetch } = useRevisao(id, canal);
  // Só para saber se JÁ existe documento ligado. A revisão não devolve esse
  // fato, e sem ele o vazio abaixo manda enviar um documento que a pessoa
  // talvez já tenha enviado — contrato lido e limpo também cai ali, porque
  // "sem achado" não distingue "não conferimos" de "conferimos e estava certo".
  // A query é a mesma do detalhe, então quase sempre vem do cache.
  const { data: dadosDaDivida } = useDivida(id);
  const jaTemDocumento = !!dadosDaDivida?.divida?.extracaoId;

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

  // DOIS vazios diferentes, e confundi-los mentiria. Sem achado não há número
  // nem ponto a contestar — mas o SCRIPT DE SEGURANÇA continua aparecendo: quem
  // cadastrou a dívida na mão é o alvo preferencial do golpe, e é exatamente
  // quem receberia tela vazia antes (ADR 0021, decisão 2). O alerta anti-golpe
  // não pode ficar amarrado à existência de achado por nenhum caminho lateral.
  const temAchados = revisao.achados.length > 0;
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
        ) : temAchados ? (
          <Card>
            <Text style={styles.eyebrow}>{revisao.credor}</Text>
            <Text style={styles.semNumero}>
              Os pontos abaixo valem levantar, mas nenhum deles tem um valor que a gente consiga
              apurar sozinho. Por isso não mostramos um número aqui.
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={styles.eyebrow}>{revisao.credor}</Text>
            <Text style={styles.semNumero}>
              {jaTemDocumento
                ? 'Conferimos o documento desta dívida e não achamos encargo que dê para contestar com fonte. Isso é notícia boa, não falha da leitura. Se você tem outro documento — o contrato, quando o que mandou foi um boleto —, vale trocar. Enquanto isso, use o roteiro abaixo para negociar com segurança.'
                : 'Ainda não dá para conferir os encargos desta cobrança — para isso, envie o contrato e a gente revisa ponto a ponto. Enquanto isso, use o roteiro abaixo para negociar com segurança.'}
            </Text>
            {/* O CONVITE VIRA PORTA. A frase acima prometia "envie o contrato" e
                não tinha botão nenhum — convite para uma porta que não existia
                (F-019, RF-010). E o rótulo NOMEIA a troca quando já há documento:
                mandar quem já mandou de volta ao mesmo lugar, com o mesmo texto,
                é o convite mentindo de outro jeito. */}
            <Button
              label={jaTemDocumento ? 'Trocar o documento' : 'Mandar o documento'}
              onPress={() => router.push(`/dividas/${id}/documento`)}
              variant="secondary"
              style={styles.acaoSemNumero}
            />
          </Card>
        )}

        {temAchados ? (
          <View style={styles.achados}>
            {revisao.achados.map((achado) => (
              <AchadoCard key={achado.id} achado={achado} />
            ))}
          </View>
        ) : null}

        {revisao.baseLegalVigenteEm ? (
          <Text style={styles.vigencia}>
            Tetos de juros vigentes em {isoParaBR(revisao.baseLegalVigenteEm)}.
          </Text>
        ) : null}

        {/* DEPOIS dos achados e ANTES do script (M14): a explicação vem quando a
            pessoa já viu o número e os pontos que o sustentam, e antes de ela
            levar o roteiro para o credor. Aparece nos TRÊS casos da tela acima —
            inclusive sem achado nenhum, que é quando explicar por que não há
            número importa mais: ele seria uma subtração de achados, não uma
            estimativa que deixamos de fazer. */}
        {revisao.trilha ? <ComoCalculamos trilha={revisao.trilha} fontes={fontes} /> : null}

        <ScriptCard script={revisao.script} onSelectCanal={setCanal} />

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
  acaoSemNumero: { marginTop: spacing.md, alignSelf: 'stretch' },
  achados: { gap: spacing.md },
  vigencia: { ...typography.caption, color: colors.inkSoft, fontSize: 11 },
  disclaimer: {
    ...typography.caption,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
