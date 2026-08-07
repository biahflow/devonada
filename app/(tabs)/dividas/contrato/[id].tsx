import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { Feedback } from '../../../../src/components/ui/Feedback';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { Button } from '../../../../src/components/ui/Button';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { CampoRevisao } from '../../../../src/components/dividas/CampoRevisao';
import { AlertaCard } from '../../../../src/components/dividas/AlertaCard';
import { DividaForm } from '../../../../src/components/dividas/DividaForm';
import { useExtracao } from '../../../../src/hooks/useContrato';
import { useCriarDivida } from '../../../../src/hooks/useDividas';
import { extracaoParaProposta } from '../../../../src/util/extracao';
import { formatBRL } from '../../../../src/util/money';
import { formatBasisPoints } from '../../../../src/util/percent';
import { isoParaBR } from '../../../../src/util/date';
import { colors, spacing, typography } from '../../../../src/theme/theme';

export default function RevisarExtracao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { extracao, isPending, error, refetch, excedeuTempo } = useExtracao(id);
  const criar = useCriarDivida();

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Abrindo o contrato" />
      </Screen>
    );
  }

  if (error || !extracao) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (extracao.status === 'processando') {
    return (
      <Screen>
        <PageHeader eyebrow="Leitura" title="Lendo o contrato" />
        {excedeuTempo ? (
          <>
            <Feedback
              tone="warning"
              message="A leitura está demorando mais que o normal. Você pode esperar mais um pouco ou cadastrar à mão — nada foi perdido."
            />
            <View style={styles.acoes}>
              <Button label="Verificar de novo" onPress={refetch} variant="secondary" />
              <Button
                label="Cadastrar à mão"
                onPress={() => router.replace('/dividas/nova')}
                variant="ghost"
              />
            </View>
          </>
        ) : (
          <LoadingState label="Isso costuma levar menos de um minuto" />
        )}
      </Screen>
    );
  }

  if (extracao.status === 'falhou') {
    return (
      <Screen>
        <PageHeader eyebrow="Leitura" title="Não consegui ler" />
        <Feedback
          tone="warning"
          message={
            extracao.erro ??
            'Não deu para extrair os dados desse arquivo. Pode ser a qualidade da imagem ou um formato inesperado.'
          }
        />
        <View style={styles.acoes}>
          <Button
            label="Tentar outro arquivo"
            onPress={() => router.replace('/dividas/contrato')}
            variant="secondary"
          />
          <Button
            label="Cadastrar à mão"
            onPress={() => router.replace('/dividas/nova')}
            variant="ghost"
          />
        </View>
      </Screen>
    );
  }

  const campos = extracao.campos;
  const proposta = extracaoParaProposta(extracao);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Revisão"
          title="Confira o que li"
          description="Nada é salvo até você confirmar. Cada valor vem com o trecho do contrato que o sustenta."
        />

        {campos ? (
          <Card>
            <CampoRevisao
              rotulo="Credor"
              campo={campos.credor}
              valorFormatado={campos.credor.valor ?? undefined}
            />
            <CampoRevisao
              rotulo="Valor"
              campo={campos.valorCobrado}
              valorFormatado={
                campos.valorCobrado.valor !== null
                  ? formatBRL(campos.valorCobrado.valor)
                  : undefined
              }
            />
            <CampoRevisao
              rotulo="Data de origem"
              campo={campos.dataOrigem}
              valorFormatado={isoParaBR(campos.dataOrigem.valor ?? undefined)}
            />
            <CampoRevisao
              rotulo="Juros ao mês"
              campo={campos.taxaJurosMensal}
              valorFormatado={
                campos.taxaJurosMensal.valor !== null
                  ? formatBasisPoints(campos.taxaJurosMensal.valor)
                  : undefined
              }
            />
            <CampoRevisao
              rotulo="Custo Efetivo Total"
              campo={campos.cet}
              valorFormatado={
                campos.cet.valor !== null ? formatBasisPoints(campos.cet.valor) : undefined
              }
            />
            <CampoRevisao
              rotulo="Parcelas"
              campo={campos.totalParcelas}
              valorFormatado={campos.totalParcelas.valor?.toString()}
            />
          </Card>
        ) : null}

        {extracao.alertas?.length ? (
          <View style={styles.alertas}>
            <Text style={styles.tituloAlertas}>Pontos que merecem atenção</Text>
            {extracao.alertas.map((alerta) => (
              <AlertaCard key={alerta.id} alerta={alerta} />
            ))}
          </View>
        ) : null}

        <View>
          <Text style={styles.tituloForm}>Confirme os dados</Text>
          <Text style={styles.subtituloForm}>
            Preenchi o que consegui comprovar. Ajuste o que estiver errado antes de salvar.
          </Text>
        </View>

        <ErroDeMutacao error={criar.error} fallback={'Não deu para salvar. Tente de novo.'} />

        <DividaForm
          inicial={proposta}
          submitLabel="Salvar dívida"
          submitting={criar.isPending}
          onSubmit={(input) => criar.mutate(input, { onSuccess: () => router.replace('/dividas') })}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  acoes: { gap: spacing.sm, marginTop: spacing.lg },
  alertas: { gap: spacing.md },
  tituloAlertas: { ...typography.title, color: colors.ink },
  tituloForm: { ...typography.title, color: colors.ink },
  subtituloForm: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
});
