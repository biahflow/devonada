import { Alert, ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { Feedback } from '../../../../src/components/ui/Feedback';
import { MoneyText } from '../../../../src/components/ui/MoneyText';
import { CriticidadeBadge } from '../../../../src/components/ui/Badge';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { useDivida, useExcluirDivida, useQuitarDivida } from '../../../../src/hooks/useDividas';
import { isoParaBR, dateParaIso } from '../../../../src/util/date';
import { formatBasisPoints } from '../../../../src/util/percent';
import { colors, spacing, typography } from '../../../../src/theme/theme';

export default function DetalheDivida() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isPending, error, refetch } = useDivida(id);
  const quitar = useQuitarDivida(id);
  const excluir = useExcluirDivida(id);

  // A SETA APARECE NOS TRÊS RAMOS, não só no de conteúdo. Sem ela, uma dívida
  // que não carrega deixa a pessoa presa numa tela de erro sem saída — e é
  // exatamente aí que ela quer sair (ADR 0016).
  const voltar = () => router.back();

  if (isPending) {
    return (
      <Screen>
        <PageHeader eyebrow="Dívida" title="Carregando" onBack={voltar} />
        <LoadingState label="Carregando a dívida" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <PageHeader eyebrow="Dívida" title="Não deu para abrir" onBack={voltar} />
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const { divida } = data;
  const quitada = divida.situacao === 'quitada';

  function confirmarQuitacao() {
    Alert.alert(
      'Marcar como quitada?',
      `${divida.credor} sai da lista de dívidas ativas. Dá para desfazer editando depois.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          onPress: () =>
            quitar.mutate({
              dataQuitacao: dateParaIso(new Date()),
              valorPago: divida.saldoDevedor ?? divida.valorCobrado,
            }),
        },
      ],
    );
  }

  function confirmarExclusao() {
    Alert.alert(
      'Excluir esta dívida?',
      'Ela some da sua lista. O histórico fica guardado, mas você não verá mais por aqui.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => excluir.mutate(undefined, { onSuccess: () => router.back() }),
        },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow={quitada ? 'Quitada' : 'Dívida ativa'}
          title={divida.credor}
          description={`Registrada desde ${isoParaBR(divida.dataOrigem)}`}
          onBack={voltar}
        />

        {divida.possivelPrescricao ? (
          <Feedback
            tone="info"
            message="Pela data de origem, esta dívida pode ter prescrito. Vale checar antes de negociar — é um sinal para investigar, não uma certeza."
          />
        ) : null}

        <Card>
          <View style={styles.linha}>
            <Text style={styles.rotulo}>Valor cobrado</Text>
            <MoneyText centavos={divida.valorCobrado} size="numeric" />
          </View>

          <Campo rotulo="Valor corrigido" centavos={divida.valorCorrigido} />
          <Campo rotulo="Saldo devedor" centavos={divida.saldoDevedor} />

          <View style={styles.linha}>
            <Text style={styles.rotulo}>Juros ao mês</Text>
            <Text style={divida.taxaJurosMensal ? styles.valor : styles.ausente}>
              {divida.taxaJurosMensal
                ? formatBasisPoints(divida.taxaJurosMensal)
                : 'ainda não calculado'}
            </Text>
          </View>

          {divida.totalParcelas ? (
            <View style={styles.linha}>
              <Text style={styles.rotulo}>Parcelas</Text>
              <Text style={styles.valor}>
                {divida.parcelasPagas ?? 0} de {divida.totalParcelas} pagas
              </Text>
            </View>
          ) : null}

          <View style={styles.linha}>
            <Text style={styles.rotulo}>Classificação</Text>
            <CriticidadeBadge tipo={divida.tipo} />
          </View>
        </Card>

        <View style={styles.acoes}>
          <Button
            label="Ver plano de pagamento"
            onPress={() => router.push(`/dividas/${divida.id}/plano`)}
          />
          <Button
            label="Revisar cobrança"
            onPress={() => router.push(`/dividas/${divida.id}/revisao`)}
            variant="secondary"
          />
          <Button
            label="Editar"
            onPress={() => router.push(`/dividas/${divida.id}/editar`)}
            variant="secondary"
          />
          {!quitada ? (
            <Button
              label="Marcar como quitada"
              onPress={confirmarQuitacao}
              variant="secondary"
              loading={quitar.isPending}
            />
          ) : null}
          <Button
            label="Excluir dívida"
            onPress={confirmarExclusao}
            variant="ghost"
            loading={excluir.isPending}
          />
        </View>

        <Text style={styles.disclaimer}>
          Estimativa educacional. Não é aconselhamento jurídico.
        </Text>
      </ScrollView>
    </Screen>
  );
}

/** Ausência não é zero: sem valor calculado, dizemos isso em vez de mostrar R$ 0,00. */
function Campo({ rotulo, centavos }: { rotulo: string; centavos?: number }) {
  return (
    <View style={styles.linha}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      {centavos === undefined ? (
        <Text style={styles.ausente}>ainda não calculado</Text>
      ) : (
        <MoneyText centavos={centavos} size="body" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  valor: { ...typography.body, color: colors.ink },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
  acoes: { gap: spacing.sm },
  disclaimer: { ...typography.caption, color: colors.inkSoft, textAlign: 'center' },
});
