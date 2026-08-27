import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { FormField } from '../../../../src/components/ui/FormField';
import { OptionGroup, type Option } from '../../../../src/components/ui/OptionGroup';
import { CurrencyInput } from '../../../../src/components/ui/CurrencyInput';
import { PercentInput } from '../../../../src/components/ui/PercentInput';
import { DateField } from '../../../../src/components/ui/DateField';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { MoneyText } from '../../../../src/components/ui/MoneyText';
import { useRenegociar } from '../../../../src/hooks/useParcelas';
import {
  useNegociacoesDaDivida,
  useRegistrarNegociacao,
} from '../../../../src/hooks/useNegociacoes';
import type { Canal, DesfechoNegociacao, IsoDate, ResultadoNegociacao } from '../../../../src/api/types';
import { isoParaBR } from '../../../../src/util/date';
import { colors, spacing, typography } from '../../../../src/theme/theme';

const CANAIS: readonly Option<Canal>[] = [
  { value: 'telefone', label: 'Telefone' },
  { value: 'chat', label: 'Chat' },
  { value: 'email', label: 'E-mail' },
];

// Tom NEUTRO, nunca de fracasso (guardrail 4): registrar uma recusa é informação
// valiosa para a próxima conversa, não um tropeço a esconder.
const DESFECHOS: readonly Option<DesfechoNegociacao>[] = [
  { value: 'acordo', label: 'Fechamos', description: 'Combinamos novas condições — vou anotar o acordo.' },
  { value: 'contraproposta', label: 'Contraproposta', description: 'Fizeram uma oferta diferente da que eu queria.' },
  { value: 'recusa', label: 'Não aceitaram', description: 'Por enquanto não houve acordo — registrar ajuda na próxima.' },
  { value: 'sem_resposta', label: 'Sem resposta', description: 'Ainda não retornaram.' },
];

const DESFECHO_LABEL: Record<DesfechoNegociacao, string> = {
  acordo: 'Acordo fechado',
  contraproposta: 'Contraproposta',
  recusa: 'Não aceitaram',
  sem_resposta: 'Sem resposta',
};

const CANAL_LABEL: Record<Canal, string> = {
  telefone: 'por telefone',
  chat: 'por chat',
  email: 'por e-mail',
};

export default function Renegociar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const renegociar = useRenegociar(id);
  const registrar = useRegistrarNegociacao(id);

  const [canal, setCanal] = useState<Canal | undefined>();
  const [desfecho, setDesfecho] = useState<DesfechoNegociacao | undefined>();

  const [novoValor, setNovoValor] = useState(0);
  const [parcelas, setParcelas] = useState('');
  const [taxa, setTaxa] = useState(0);
  const [primeiroVencimento, setPrimeiroVencimento] = useState<IsoDate | undefined>();

  const [valorProposto, setValorProposto] = useState(0);
  const [valorObtido, setValorObtido] = useState(0);
  const [observacao, setObservacao] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});

  const ehAcordo = desfecho === 'acordo';

  function confirmar() {
    const encontrados: Record<string, string> = {};
    if (!canal) encontrados.canal = 'Diga por onde você negociou.';
    if (!desfecho) encontrados.desfecho = 'Diga como a conversa terminou.';

    if (desfecho === 'acordo') {
      const total = Number.parseInt(parcelas, 10);
      if (novoValor <= 0) encontrados.valor = 'Informe o novo valor acordado.';
      if (!total || total < 1) encontrados.parcelas = 'Informe em quantas parcelas ficou.';
      if (!primeiroVencimento) encontrados.data = 'Informe quando vence a primeira.';
    }

    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    if (desfecho === 'acordo') {
      const total = Number.parseInt(parcelas, 10);
      // Confirmação explícita: as parcelas pendentes serão substituídas, e isso
      // não tem desfazer (guardrail 7.2).
      Alert.alert(
        'Registrar a renegociação?',
        'As parcelas ainda não pagas serão substituídas pelas novas. O que você já pagou continua no histórico.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Registrar',
            onPress: () =>
              renegociar.mutate(
                {
                  novoValor,
                  novoTotalParcelas: total,
                  primeiroVencimento: primeiroVencimento!,
                  ...(taxa > 0 ? { novaTaxaJurosMensal: taxa } : {}),
                  ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
                },
                {
                  onSuccess: () => {
                    // Registro ADICIONAL do desfecho para o benchmark — não é uma
                    // segunda renegociação: as parcelas foram reescritas uma vez só.
                    registrar.mutate({
                      canal: canal!,
                      desfecho: 'acordo',
                      valorObtido: novoValor,
                      ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
                    });
                    router.replace(`/dividas/${id}/plano`);
                  },
                },
              ),
          },
        ],
      );
      return;
    }

    // Sem acordo: só registra o desfecho da conversa. NÃO exige valor — obrigar
    // valor recriaria o viés que a entidade nova existe para desfazer.
    registrar.mutate(
      {
        canal: canal!,
        desfecho: desfecho!,
        ...(valorProposto > 0 ? { valorProposto } : {}),
        ...(valorObtido > 0 ? { valorObtido } : {}),
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
      },
      { onSuccess: () => router.replace(`/dividas/${id}`) },
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Negociação"
          title="Como foi a conversa"
          description="Anote o canal e o desfecho. Recusa e silêncio também contam — é o que ajuda na próxima."
          onBack={() => router.back()}
        />

        <ErroDeMutacao
          error={renegociar.error ?? registrar.error}
          fallback={'Não deu para registrar. Tente de novo.'}
        />

        <View style={styles.form}>
          <OptionGroup
            label="Por onde você negociou"
            options={CANAIS}
            value={canal}
            onChangeValue={setCanal}
            error={erros.canal}
          />

          <OptionGroup
            label="Como terminou"
            options={DESFECHOS}
            value={desfecho}
            onChangeValue={setDesfecho}
            error={erros.desfecho}
          />

          {ehAcordo ? (
            <>
              <Card>
                <Text style={styles.aviso}>
                  O que você já pagou não some. Só as parcelas pendentes são substituídas pelas
                  novas condições.
                </Text>
              </Card>

              <CurrencyInput
                label="Novo valor total"
                value={novoValor}
                onChangeValue={setNovoValor}
                error={erros.valor}
                hint="O valor combinado no acordo."
              />

              <FormField
                label="Em quantas parcelas"
                value={parcelas}
                onChangeText={setParcelas}
                keyboardType="number-pad"
                error={erros.parcelas}
                placeholder="12"
              />

              <DateField
                label="Primeiro vencimento"
                value={primeiroVencimento}
                onChangeValue={setPrimeiroVencimento}
                error={erros.data}
              />

              <PercentInput
                label="Nova taxa de juros"
                value={taxa}
                onChangeValue={setTaxa}
                optional
                hint="Se o acordo mudou a taxa."
              />
            </>
          ) : desfecho ? (
            <>
              <CurrencyInput
                label="Valor que você propôs"
                value={valorProposto}
                onChangeValue={setValorProposto}
                optional
                hint="Se você chegou a oferecer um valor."
              />
              <CurrencyInput
                label="Valor que ofereceram"
                value={valorObtido}
                onChangeValue={setValorObtido}
                optional
                hint="Se o credor apresentou um número."
              />
            </>
          ) : null}

          <FormField
            label="Observação"
            value={observacao}
            onChangeText={setObservacao}
            optional
            placeholder="Protocolo 12345, prazo para retornar…"
          />

          <Button
            label={ehAcordo ? 'Registrar acordo' : 'Registrar negociação'}
            onPress={confirmar}
            loading={renegociar.isPending || registrar.isPending}
          />
        </View>

        <HistoricoDeNegociacoes dividaId={id} />
      </ScrollView>
    </Screen>
  );
}

function HistoricoDeNegociacoes({ dividaId }: { dividaId: string }) {
  const { resultados, isPending, error, refetch } = useNegociacoesDaDivida(dividaId);

  return (
    <View style={styles.historico}>
      <Text style={styles.historicoTitulo}>Negociações registradas</Text>

      {isPending ? (
        <LoadingState label="Carregando o histórico" />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : resultados.length === 0 ? (
        <Card>
          <Text style={styles.vazio}>
            Nenhuma negociação registrada ainda. Quando você anotar a primeira, ela aparece aqui.
          </Text>
        </Card>
      ) : (
        <View style={styles.lista}>
          {resultados.map((r) => (
            <LinhaDeResultado key={r.id} resultado={r} />
          ))}
        </View>
      )}
    </View>
  );
}

function LinhaDeResultado({ resultado }: { resultado: ResultadoNegociacao }) {
  return (
    <Card>
      <Text style={styles.linhaTitulo}>
        {DESFECHO_LABEL[resultado.desfecho]} {CANAL_LABEL[resultado.canal]}
      </Text>
      {resultado.valorObtido != null ? (
        <View style={styles.linhaValor}>
          <Text style={styles.linhaLegenda}>Ofereceram</Text>
          <MoneyText centavos={resultado.valorObtido} tone="ink" />
        </View>
      ) : null}
      {resultado.valorProposto != null ? (
        <View style={styles.linhaValor}>
          <Text style={styles.linhaLegenda}>Você propôs</Text>
          <MoneyText centavos={resultado.valorProposto} tone="inkSoft" />
        </View>
      ) : null}
      {resultado.observacao ? (
        <Text style={styles.linhaObs}>{resultado.observacao}</Text>
      ) : null}
      <Text style={styles.linhaData}>{isoParaBR(resultado.registradoEm.slice(0, 10))}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  aviso: { ...typography.caption, color: colors.inkSoft },
  form: { gap: spacing.lg },
  historico: { gap: spacing.md, marginTop: spacing.md },
  historicoTitulo: { ...typography.bodyStrong, color: colors.ink },
  vazio: { ...typography.caption, color: colors.inkSoft },
  lista: { gap: spacing.sm },
  linhaTitulo: { ...typography.bodyStrong, color: colors.ink },
  linhaValor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  linhaLegenda: { ...typography.caption, color: colors.inkSoft },
  linhaObs: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
  linhaData: {
    ...typography.caption,
    color: colors.inkSoft,
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
