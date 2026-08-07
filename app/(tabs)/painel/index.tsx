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
import { ListRow } from '../../../src/components/ui/ListRow';
import { LinhaEvolucao } from '../../../src/components/charts/LinhaEvolucao';
import { BarrasCriticidade } from '../../../src/components/charts/BarrasCriticidade';
import { SeletorDeMes } from '../../../src/components/painel/SeletorDeMes';
import { CardLembretes } from '../../../src/components/painel/CardLembretes';
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
        titleLead="Seu"
        title="painel"
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
        {/* A saída para o 401 mora no próprio ErrorState desde que deixou de
            existir só aqui — no chat ela faltava, e era lá que o 401 aparecia. */}
        <ErrorState error={error} onRetry={refetch} />
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
          <Text style={styles.tituloSecao}>E se você pagar um pouco a mais?</Text>
          <Text style={styles.conviteTexto}>
            Duas formas de atacar as dívidas, com a data de liberdade de cada uma.
          </Text>
          <Button
            label="Simular quitação"
            onPress={() => router.push('/dividas/simulador')}
            variant="secondary"
            style={styles.acaoSimulador}
          />
        </Card>

        <Card>
          <Text style={styles.tituloSecao}>Onde está concentrado</Text>
          <BarrasCriticidade itens={resumo.porCriticidade} />
        </Card>

        <Card>
          <Text style={styles.tituloSecao}>Evolução do saldo devedor</Text>
          <LinhaEvolucao pontos={resumo.evolucaoSaldo} largura={larguraGrafico} />
        </Card>

        <CardLembretes onConfigurar={() => router.push('/painel/renda')} />

        <Card>
          <Text style={styles.tituloSecao}>Próximos vencimentos</Text>
          {resumo.proximosVencimentos.length === 0 ? (
            <Text style={styles.vazio}>Nenhum vencimento à vista.</Text>
          ) : (
            resumo.proximosVencimentos.map((v) => (
              <ListRow
                key={`${v.dividaId}-${v.vencimento}`}
                titulo={v.credor}
                subtitulo={isoParaBR(v.vencimento)}
                icon="calendar"
                cor={v.situacao === 'atrasada' ? 'ambar' : 'teal'}
                estado={v.situacao === 'atrasada' ? 'atencao' : 'neutro'}
                valor={<MoneyText centavos={v.valor} size="body" />}
                legenda={v.situacao === 'atrasada' ? 'atrasada' : undefined}
              />
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
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
  acaoSimulador: { marginTop: spacing.md },
  vazio: { ...typography.caption, color: colors.inkSoft },
});
