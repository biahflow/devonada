import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { TopbarMarca } from '../../../src/components/rota/TopbarMarca';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Feedback } from '../../../src/components/ui/Feedback';
import { StatTile } from '../../../src/components/ui/StatTile';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { Cascata, type Degrau } from '../../../src/components/caixa/Cascata';
import { RespiroCard } from '../../../src/components/caixa/RespiroCard';
import { CompromissoCard } from '../../../src/components/caixa/CompromissoCard';
import { ErroDeMutacao } from '../../../src/components/ui/ErroDeMutacao';
import {
  useCaixa,
  useLembreteFechamento,
  useRegistrarUsoDeRespiro,
} from '../../../src/hooks/useCaixa';
import { isoParaBR } from '../../../src/util/date';
import { formatMesCurto } from '../../../src/util/mes';
import { ComoCalculamos } from '../../../src/components/ui/ComoCalculamos';
import { trilhaDe, useFontesJuridicas } from '../../../src/hooks/useJuridico';
import { colors, spacing, typography } from '../../../src/theme/theme';

export default function CaixaScreen() {
  const router = useRouter();
  // O corpus jurídico. NÃO bloqueia a tela: os números vêm da resposta do
  // caixa, e o disclosure só precisa dele para abrir a norma citada.
  const { porId: fontes } = useFontesJuridicas();
  const { caixa, isPending, error, refetch, isRefetching } = useCaixa();
  const registrarUso = useRegistrarUsoDeRespiro();
  useLembreteFechamento();

  const cabecalho = (
    <>
      <TopbarMarca />
      <PageHeader
        titleLead="Seu"
        title="caixa"
        description="Quanto entra, quanto sai e o que sobra de verdade para pagar dívida."
      />
    </>
  );

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        <LoadingState label="Somando seu mês" />
      </Screen>
    );
  }

  if (error || !caixa) {
    return (
      <Screen>
        {cabecalho}
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  // O vazio convida ao Nível 0 — dois campos e o número aparece. Quem está
  // endividado e com medo não preenche formulário, então o valor tem de vir
  // antes do esforço, não depois.
  if (caixa.preenchimento === 'vazio') {
    return (
      <Screen>
        {cabecalho}
        <EmptyState
          icon="inbox"
          title="Leva 20 segundos"
          description="Diga o que você ganha e quanto gasta com o essencial. Já dá para ver quanto sobra por mês — e é esse número que define o plano que você consegue manter."
          actionLabel="Informar renda"
          onAction={() => router.push('/caixa/renda')}
          secondaryLabel="Informar gastos"
          onSecondary={() => router.push('/caixa/gastos')}
        />
      </Screen>
    );
  }

  // Por CHAVE, e não por posição na lista: um campo novo no meio não pode mudar
  // a explicação que aparece ao lado da cascata.
  const trilhaCapacidade = trilhaDe(caixa.trilhas, 'capacidadeHoje');
  const trilhaNaoFecha = trilhaDe(caixa.trilhas, 'naoFecha');

  const degraus: Degrau[] = [];
  if (caixa.impostoReservado > 0) {
    degraus.push({
      rotulo: 'Imposto reservado',
      centavos: caixa.impostoReservado,
      contexto: 'Sai antes de tudo: essa parte nunca foi sua.',
    });
  }
  degraus.push({ rotulo: 'Contas essenciais', centavos: caixa.essenciais });
  if (caixa.provisaoMensal > 0) {
    degraus.push({
      rotulo: 'Provisões do ano',
      centavos: caixa.provisaoMensal,
      contexto: 'IPVA, seguro e o que mais vence de uma vez.',
    });
  }
  if (caixa.aporteReserva > 0) {
    degraus.push({ rotulo: 'Reserva de emergência', centavos: caixa.aporteReserva });
  }
  if (caixa.aporteAposentadoria > 0) {
    degraus.push({ rotulo: 'Aposentadoria', centavos: caixa.aporteAposentadoria });
  }
  if (caixa.naoEssenciais > 0) {
    degraus.push({
      rotulo: 'Gastos não essenciais',
      centavos: caixa.naoEssenciais,
      contexto: 'O que você pode cortar se decidir acelerar.',
    });
  }

  const folgaCortando = caixa.capacidadeMaxima - caixa.capacidadeHoje;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        refreshControl={undefined}
      >
        {cabecalho}

        {caixa.abaixoDoPiso ? (
          <Feedback
            tone="warning"
            message="O que sobra depois das contas está abaixo do mínimo existencial que a lei protege. Enquanto for assim, não sugerimos nenhum plano de pagamento."
          />
        ) : null}

        {/* Defasagem: FATO, não repreensão. O backend decide o que é velho
            (domain/caixa.caixa_defasado); a tela só escreve o número de meses.
            `caixaDefasado` ausente significa que nunca houve fechamento — e
            isso não é atraso, é convite. */}
        {caixa.caixaDefasado ? (
          <Feedback
            tone="warning"
            message={`Seus números são de ${
              caixa.ultimoFechamentoMes ? formatMesCurto(caixa.ultimoFechamentoMes) : 'antes'
            }. A capacidade abaixo está calculada sobre eles.`}
          />
        ) : null}

        {caixa.naoFecha ? (
          <View style={styles.blocoNaoFecha}>
            <Feedback
              tone="warning"
              message="As parcelas que você já paga não cabem no que sobra, nem cortando o não essencial. Vale procurar o Procon ou a Defensoria para conhecer a repactuação de dívidas — é um caminho previsto em lei."
            />
            {/* A LEI QUE SUSTENTA A FRASE, ao alcance de um toque (M14). Sem
                isto, "é um caminho previsto em lei" seria exatamente o tipo de
                afirmação sem procedência que o produto recusa no resto da tela.
                Aqui ela ganha artigo, ementa e link — e, no mesmo lugar, o que
                a conta NÃO faz. */}
            {trilhaNaoFecha ? <ComoCalculamos trilha={trilhaNaoFecha} fontes={fontes} /> : null}
          </View>
        ) : null}

        <Card>
          <Cascata
            bruta={caixa.rendaBrutaTipica}
            degraus={degraus}
            totalRotulo="Sobra por mês"
            total={caixa.capacidadeHoje}
          />
          {/* DENTRO do card da cascata, e não solto embaixo: a explicação
              pertence ao número que ela explica. Fechado por padrão — quem abre
              esta tela quer saber quanto sobra, e despejar a memória de cálculo
              junto faria a explicação competir com a resposta. */}
          {trilhaCapacidade ? (
            <ComoCalculamos trilha={trilhaCapacidade} fontes={fontes} />
          ) : null}
        </Card>

        <RespiroCard
          respiro={caixa.respiro}
          respiroUsadoNoMes={caixa.respiroUsadoNoMes}
          respiroDisponivelNoMes={caixa.respiroDisponivelNoMes}
          respiroSaldoAcumulado={caixa.respiroSaldoAcumulado}
          onDeclarar={() => router.push('/caixa/respiro')}
          onRegistrarUso={(valor, descricao) => registrarUso.mutate({ valor, descricao })}
          registrandoUso={registrarUso.isPending}
        />
        <ErroDeMutacao error={registrarUso.error} fallback="Não deu para registrar o uso. Tente de novo." />

        <CompromissoCard
          compromissoPercentualBps={caixa.compromissoPercentualBps ?? null}
          compromissoPercentual={caixa.compromissoPercentual ?? null}
          onDeclarar={() => router.push('/caixa/compromisso')}
        />

        {caixa.origemRenda === 'pior_mes_registrado' ? (
          <Feedback
            tone="info"
            message={`Sua renda aqui é a do seu pior mês registrado${
              caixa.mesAncoraRenda ? `, que foi ${formatMesCurto(caixa.mesAncoraRenda)}` : ''
            }, não a média. Um plano dimensionado pela média quebra justamente no mês fraco.`}
          />
        ) : null}

        <View style={styles.tiles}>
          <StatTile
            rotulo="Cabe no aporte extra"
            centavos={caixa.aporteMaximo}
            contexto="Depois das parcelas que você já paga."
          />
          {folgaCortando > 0 ? (
            <StatTile
              rotulo="Cortando o não essencial"
              centavos={caixa.capacidadeMaxima}
              contexto="É a sua alavanca — a escolha é sua, não do app."
            />
          ) : null}
        </View>

        {caixa.minimoExistencial != null ? (
          <Card>
            <Text style={styles.notaTitulo}>Piso protegido por lei</Text>
            <Text style={styles.nota}>
              Nenhum plano que sugerimos invade o mínimo existencial. O valor vigente vem do
              Decreto 11.150/2022, na redação de{' '}
              {caixa.minimoExistencialVigenteEm
                ? isoParaBR(caixa.minimoExistencialVigenteEm)
                : 'decreto posterior'}
              .
            </Text>
          </Card>
        ) : null}

        <View style={styles.acoes}>
          <Button
            label={caixa.caixaDefasado ? 'Atualizar o mês' : 'Fechar o mês'}
            onPress={() => router.push('/caixa/fechamento')}
            size="lg"
          />
          <Button
            label="Renda"
            onPress={() => router.push('/caixa/renda')}
            variant="secondary"
          />
          <Button
            label="Gastos"
            onPress={() => router.push('/caixa/gastos')}
            variant="secondary"
          />
          <Button
            label="Provisões do ano"
            onPress={() => router.push('/caixa/provisoes')}
            variant="secondary"
          />
          <Button
            label="Reserva, aposentadoria e imposto"
            onPress={() => router.push('/caixa/metas')}
            variant="secondary"
          />
          <Button
            label="Atualizar"
            onPress={refetch}
            variant="ghost"
            loading={isRefetching}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  blocoNaoFecha: { gap: spacing.sm },
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  tiles: { gap: spacing.lg },
  notaTitulo: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.xs },
  nota: { ...typography.caption, color: colors.inkSoft },
  acoes: { gap: spacing.md },
});
