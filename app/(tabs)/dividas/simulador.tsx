import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Feedback } from '../../../src/components/ui/Feedback';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { MoneyText } from '../../../src/components/ui/MoneyText';
import { LinhaEvolucao } from '../../../src/components/charts/LinhaEvolucao';
import { AporteExtra } from '../../../src/components/dividas/AporteExtra';
import { CartaoEstrategia } from '../../../src/components/dividas/CartaoEstrategia';
import { useSimulacao } from '../../../src/hooks/useSimulacao';
import { useDebounce } from '../../../src/hooks/useDebounce';
import { useResumo } from '../../../src/hooks/usePainel';
import { ApiError } from '../../../src/api/client';
import type { EstrategiaQuitacao } from '../../../src/api/types';
import { mesAtual, formatMes } from '../../../src/util/mes';
import { colors, spacing, typography } from '../../../src/theme/theme';

const NOMES: Record<EstrategiaQuitacao, string> = {
  avalanche: 'avalanche',
  bola_de_neve: 'bola de neve',
};

export default function Simulador() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [aporte, setAporte] = useState(0);
  const [estrategia, setEstrategia] = useState<EstrategiaQuitacao>('avalanche');
  // Arrastar o slider emite dezenas de valores por segundo; só o valor que
  // sobrevive ao debounce vira requisição.
  const aporteEstavel = useDebounce(aporte);

  const { simulacoes, comparacao, dividasSemTaxa, isPending, error, refetch } =
    useSimulacao(aporteEstavel);
  // Só para o teto do slider: sem renda informada o resumo não traz margem, e
  // o controle cai no teto padrão.
  const { resumo } = useResumo(mesAtual());

  const cabecalho = (
    <PageHeader
      eyebrow="Simulação"
      title="Quando você fica livre"
      description="Duas formas de atacar as dívidas. Nenhuma das duas é a certa para todo mundo."
    />
  );

  // 4xx não é falha de servidor: o backend já explicou o problema em português,
  // e trocar essa frase por "o servidor tropeçou" perderia justamente a
  // explicação. O aporte que invade o mínimo existencial cai aqui.
  const recusa = error instanceof ApiError && error.status >= 400 && error.status < 500;

  const controle = (
    <Card>
      <AporteExtra
        centavos={aporte}
        onChange={setAporte}
        margemDisponivel={resumo?.margemDisponivel}
      />
      {recusa ? (
        <View style={styles.recusa}>
          <Feedback tone="warning" message={(error as ApiError).message} />
        </View>
      ) : null}
    </Card>
  );

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        {controle}
        <LoadingState label="Montando o plano" />
      </Screen>
    );
  }

  if (error && !recusa) {
    return (
      <Screen>
        {cabecalho}
        {controle}
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (!recusa && simulacoes.length === 0) {
    return (
      <Screen>
        {cabecalho}
        <EmptyState
          icon="trending-down"
          title="Nada para simular ainda"
          description="Cadastre uma dívida ativa e eu comparo as duas estratégias de quitação."
          actionLabel="Ir para dívidas"
          onAction={() => router.push('/dividas')}
        />
      </Screen>
    );
  }

  const escolhida = simulacoes.find((s) => s.estrategia === estrategia) ?? simulacoes[0];
  const larguraGrafico = width - spacing.lg * 2 - spacing.lg * 2;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        {cabecalho}
        {controle}

        {escolhida ? (
          <Card>
            <Text style={styles.rotuloLiberdade}>Data de liberdade</Text>
            <Text style={styles.liberdade}>{formatMes(escolhida.dataLiberdade)}</Text>
            <Text style={styles.contexto}>
              Mantendo o plano da {NOMES[escolhida.estrategia]}, é o mês em que a última dívida
              fecha.
            </Text>
          </Card>
        ) : null}

        <View style={styles.duplo}>
          {simulacoes.map((s) => (
            <CartaoEstrategia
              key={s.estrategia}
              simulacao={s}
              selecionada={s.estrategia === estrategia}
              onSelecionar={() => setEstrategia(s.estrategia)}
            />
          ))}
        </View>

        {comparacao ? (
          <Card>
            <Text style={styles.tituloSecao}>A diferença entre as duas</Text>
            {/* Os dois números vêm de `comparacao`. Subtrair as simulações aqui
                seria replicar regra de negócio (guardrail 1.2). */}
            <View style={styles.linhaDiferenca}>
              <Text style={styles.rotulo}>Em juros</Text>
              <MoneyText centavos={comparacao.diferencaJuros} size="body" tone="accent" />
            </View>
            <View style={styles.linhaDiferenca}>
              <Text style={styles.rotulo}>Em tempo</Text>
              <Text style={styles.valorTexto}>
                {comparacao.diferencaMeses === 1 ? '1 mês' : `${comparacao.diferencaMeses} meses`}
              </Text>
            </View>
            <Text style={styles.nota}>
              No papel, a {NOMES[comparacao.melhorEstrategia]} paga menos juros. Na prática, vale
              mais a que você consegue manter até o fim — cada dívida encerrada é um fôlego a
              mais.
            </Text>
          </Card>
        ) : null}

        {escolhida && escolhida.ordemPagamento.length > 0 ? (
          <Card>
            <Text style={styles.tituloSecao}>Ordem sugerida</Text>
            {escolhida.ordemPagamento.map((item) => (
              <View key={item.dividaId} style={styles.item}>
                <View style={styles.posicao}>
                  <Text style={styles.posicaoTexto}>{item.posicao}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.credor} numberOfLines={1}>
                    {item.credor}
                  </Text>
                  <Text style={styles.data}>fecha em {formatMes(item.quitadaEm)}</Text>
                </View>
                <MoneyText centavos={item.jurosPagos} size="body" tone="inkSoft" />
              </View>
            ))}
            <Text style={styles.nota}>Ao lado de cada uma, os juros que ela ainda vai custar.</Text>
          </Card>
        ) : null}

        {escolhida ? (
          <Card>
            <Text style={styles.tituloSecao}>Como o saldo cai</Text>
            <LinhaEvolucao pontos={escolhida.evolucaoSaldo} largura={larguraGrafico} />
          </Card>
        ) : null}

        {dividasSemTaxa.length > 0 ? (
          <Feedback
            tone="info"
            message={`Sem a taxa de juros de ${dividasSemTaxa
              .map((d) => d.credor)
              .join(', ')}, a simulação não projeta juros sobre ${
              dividasSemTaxa.length === 1 ? 'ela' : 'elas'
            } — o prazo real pode ser maior. Informe a taxa na dívida para o plano ficar completo.`}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  rotuloLiberdade: { ...typography.caption, color: colors.inkSoft },
  // Violeta, nunca alarme: é o número emocional da tela.
  liberdade: { ...typography.display, color: colors.accent, marginTop: spacing.xs },
  contexto: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
  duplo: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  recusa: { marginTop: spacing.md },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.md },
  linhaDiferenca: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  valorTexto: { ...typography.body, color: colors.ink },
  nota: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  posicao: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posicaoTexto: { ...typography.caption, color: colors.primaryDeep },
  itemInfo: { flex: 1, gap: 2 },
  credor: { ...typography.body, color: colors.ink },
  data: { ...typography.caption, color: colors.inkSoft },
});
