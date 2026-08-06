import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { StatTile } from '../../../src/components/ui/StatTile';
import { Meter } from '../../../src/components/ui/Meter';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { MoneyText } from '../../../src/components/ui/MoneyText';
import { LinhaEvolucao } from '../../../src/components/charts/LinhaEvolucao';
import { BarrasCriticidade } from '../../../src/components/charts/BarrasCriticidade';
import { SeletorDeMes } from '../../../src/components/painel/SeletorDeMes';
import { useResumo } from '../../../src/hooks/usePainel';
import { mesAtual } from '../../../src/util/mes';
import { formatBasisPoints } from '../../../src/util/percent';
import { isoParaBR } from '../../../src/util/date';
import { colors, spacing, typography } from '../../../src/theme/theme';

/** Limite saudável de comprometimento de renda, em basis points (30%). */
const LIMITE_COMPROMETIMENTO = 3000;

export default function Painel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // mesAtual() lê o relógio — por isso só na inicialização preguiçosa.
  const [hoje] = useState(() => mesAtual());
  const [mes, setMes] = useState(hoje);
  const { resumo, isPending, error, refetch } = useResumo(mes);

  const cabecalho = (
    <>
      <PageHeader
        eyebrow="Diagnóstico"
        title="Painel"
        description="Quanto pesa, para onde vai e o que muda se você agir."
      />
      <SeletorDeMes mes={mes} maximo={hoje} onChange={setMes} />
    </>
  );

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        <LoadingState label="Somando tudo" />
      </Screen>
    );
  }

  if (error || !resumo) {
    return (
      <Screen>
        {cabecalho}
        <ErrorState error={error} onRetry={refetch} />
        {/* Caminho de saída para o 401: sem token o app não fala com o
            servidor, e o ErrorState sozinho não diz o que fazer a respeito. */}
        <Button
          label="Configurar conexão"
          onPress={() => router.push('/painel/token')}
          variant="ghost"
        />
      </Screen>
    );
  }

  if (resumo.quantidadeDividas === 0) {
    return (
      <Screen>
        {cabecalho}
        <EmptyState
          icon="pie-chart"
          title={mes === hoje ? 'Nada a somar ainda' : 'Nenhuma dívida neste mês'}
          description={
            mes === hoje
              ? 'Cadastre uma dívida e o painel monta o diagnóstico sozinho.'
              : 'Escolha outro mês ou volte para o atual.'
          }
          actionLabel={mes === hoje ? 'Ir para dívidas' : 'Voltar para o mês atual'}
          onAction={() => (mes === hoje ? router.push('/dividas') : setMes(hoje))}
        />
      </Screen>
    );
  }

  const larguraGrafico = width - spacing.lg * 2 - spacing.lg * 2;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        {cabecalho}

        <Card>
          <StatTile
            rotulo="Total devido"
            centavos={resumo.totalDevido}
            destaque
            contexto={
              resumo.quantidadeDividas === 1
                ? 'em 1 dívida'
                : `em ${resumo.quantidadeDividas} dívidas`
            }
          />
        </Card>

        <View style={styles.duplo}>
          <Card style={styles.metade}>
            <StatTile
              rotulo="Juros médios"
              texto={
                resumo.custoMedioJurosMensal !== undefined
                  ? `${formatBasisPoints(resumo.custoMedioJurosMensal)} a.m.`
                  : undefined
              }
            />
          </Card>
          <Card style={styles.metade}>
            <StatTile
              rotulo="Quitado no ano"
              centavos={resumo.totalQuitadoNoAno}
              contexto="parabéns por isso"
            />
          </Card>
        </View>

        <Card>
          {resumo.comprometimentoRenda !== undefined ? (
            <>
              <Meter
                rotulo="Comprometimento da renda"
                bps={resumo.comprometimentoRenda}
                limiteBps={LIMITE_COMPROMETIMENTO}
                contexto="Dentro do limite saudável de 30%."
              />
              {resumo.margemDisponivel !== undefined ? (
                <View style={styles.margem}>
                  <Text style={styles.rotulo}>Sobra por mês</Text>
                  <MoneyText centavos={resumo.margemDisponivel} size="body" tone="accent" />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.convite}>
              <Text style={styles.conviteTitulo}>Quanto da sua renda isso ocupa?</Text>
              <Text style={styles.conviteTexto}>
                Informe sua renda e eu calculo o comprometimento e o mínimo existencial — o que não
                pode ser sacrificado para pagar dívida.
              </Text>
              <Button
                label="Informar renda"
                onPress={() => router.push('/painel/renda')}
                variant="secondary"
              />
            </View>
          )}
        </Card>

        <Card>
          <Text style={styles.tituloSecao}>Onde está concentrado</Text>
          <BarrasCriticidade itens={resumo.porCriticidade} />
        </Card>

        <Card>
          <Text style={styles.tituloSecao}>Evolução do saldo devedor</Text>
          <LinhaEvolucao pontos={resumo.evolucaoSaldo} largura={larguraGrafico} />
        </Card>

        <Card>
          <Text style={styles.tituloSecao}>Próximos vencimentos</Text>
          {resumo.proximosVencimentos.length === 0 ? (
            <Text style={styles.vazio}>Nenhum vencimento à vista.</Text>
          ) : (
            resumo.proximosVencimentos.map((v) => (
              <View key={`${v.dividaId}-${v.vencimento}`} style={styles.vencimento}>
                <View style={styles.vencimentoInfo}>
                  <Text style={styles.credor} numberOfLines={1}>
                    {v.credor}
                  </Text>
                  <Text style={v.situacao === 'atrasada' ? styles.atrasada : styles.data}>
                    {v.situacao === 'atrasada' ? 'atrasada · ' : ''}
                    {isoParaBR(v.vencimento)}
                  </Text>
                </View>
                <MoneyText centavos={v.valor} size="body" />
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxl, gap: spacing.md },
  duplo: { flexDirection: 'row', gap: spacing.md },
  metade: { flex: 1 },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.md },
  margem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  convite: { gap: spacing.sm },
  conviteTitulo: { ...typography.bodyStrong, color: colors.ink },
  conviteTexto: { ...typography.caption, color: colors.inkSoft },
  vencimento: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  vencimentoInfo: { flex: 1, gap: 2 },
  credor: { ...typography.body, color: colors.ink },
  data: { ...typography.caption, color: colors.inkSoft },
  atrasada: { ...typography.caption, color: colors.warning },
  vazio: { ...typography.caption, color: colors.inkSoft },
});
