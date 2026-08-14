import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { FormField } from '../../../src/components/ui/FormField';
import { CurrencyInput } from '../../../src/components/ui/CurrencyInput';
import { OptionGroup } from '../../../src/components/ui/OptionGroup';
import { MoneyText } from '../../../src/components/ui/MoneyText';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { ErroDeMutacao } from '../../../src/components/ui/ErroDeMutacao';
import {
  useCriarProvisao,
  useExcluirProvisao,
  useProvisoes,
} from '../../../src/hooks/useCaixa';
import type { ProvisaoAnual } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme/theme';

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

const OPCOES_MES = MESES.map((nome, i) => ({ value: String(i + 1), label: nome }));

export default function ProvisoesCaixa() {
  const router = useRouter();
  const { provisoes, isPending, error, refetch } = useProvisoes();

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando suas provisões" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
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
          eyebrow="Caixa"
          title="O que vence de uma vez"
          description="IPVA, seguro, licenciamento. Guardando um pouco por mês, janeiro deixa de ser susto."
          onBack={() => router.back()}
        />

        {provisoes.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nenhuma provisão cadastrada"
            description="Se você tem carro ou moto, começa por IPVA e seguro. A gente divide pelo número de meses que ainda faltam até o vencimento."
          />
        ) : (
          provisoes.map((p) => <ItemProvisao key={p.id} provisao={p} />)
        )}

        <NovaProvisao />
      </ScrollView>
    </Screen>
  );
}

function ItemProvisao({ provisao }: { provisao: ProvisaoAnual }) {
  const excluir = useExcluirProvisao();
  const falta = Math.max(provisao.valorAnual - provisao.saldoAcumulado, 0);
  const mes = MESES[provisao.mesVencimento - 1] ?? '';

  return (
    <Card>
      <View style={styles.linha}>
        <View style={styles.tituloItem}>
          <Text style={styles.nome}>{provisao.descricao}</Text>
          <Text style={styles.meta}>
            Vence em {mes} · {provisao.mesesRestantes}{' '}
            {provisao.mesesRestantes === 1 ? 'mês' : 'meses'} até lá
          </Text>
        </View>
        <View style={styles.aporte}>
          <MoneyText centavos={provisao.aporteMensal} size="body" tone="accent" />
          <Text style={styles.porMes}>por mês</Text>
        </View>
      </View>

      <View style={styles.detalhe}>
        <Text style={styles.meta}>
          Total do ano: <MoneyTextInline centavos={provisao.valorAnual} />
          {provisao.saldoAcumulado > 0 ? (
            <>
              {' · já guardado: '}
              <MoneyTextInline centavos={provisao.saldoAcumulado} />
              {' · falta: '}
              <MoneyTextInline centavos={falta} />
            </>
          ) : null}
        </Text>
      </View>

      <Button
        label="Excluir"
        onPress={() => excluir.mutate(provisao.id)}
        loading={excluir.isPending}
        variant="ghost"
      />
    </Card>
  );
}

/** Dinheiro dentro de um parágrafo. Continua saindo do `formatBRL`. */
function MoneyTextInline({ centavos }: { centavos: number }) {
  return <MoneyText centavos={centavos} size="body" tone="inkSoft" />;
}

function NovaProvisao() {
  const [descricao, setDescricao] = useState('');
  const [valorAnual, setValorAnual] = useState(0);
  const [mes, setMes] = useState('1');
  const [jaGuardado, setJaGuardado] = useState(0);
  const [erro, setErro] = useState<string | undefined>();
  const criar = useCriarProvisao();

  function salvar() {
    if (!descricao.trim()) {
      setErro('Dê um nome para reconhecer esta despesa.');
      return;
    }
    setErro(undefined);
    criar.mutate(
      {
        descricao: descricao.trim(),
        valorAnual,
        mesVencimento: Number.parseInt(mes, 10),
        saldoAcumulado: jaGuardado,
        ativa: true,
      },
      {
        onSuccess: () => {
          setDescricao('');
          setValorAnual(0);
          setJaGuardado(0);
        },
      },
    );
  }

  return (
    <Card>
      <Text style={styles.tituloSecao}>Adicionar despesa anual</Text>

      <ErroDeMutacao error={criar.error} fallback={'Não deu para salvar. Tente de novo.'} />

      <View style={styles.form}>
        <FormField
          label="O que é"
          value={descricao}
          onChangeText={setDescricao}
          error={erro}
          placeholder="IPVA do carro"
        />
        <CurrencyInput
          label="Quanto custa no ano"
          value={valorAnual}
          onChangeValue={setValorAnual}
        />
        <OptionGroup label="Mês do vencimento" options={OPCOES_MES} value={mes} onChangeValue={setMes} />
        <CurrencyInput
          label="Já guardado"
          value={jaGuardado}
          onChangeValue={setJaGuardado}
          optional
          hint="Se você já separou parte, o valor mensal cai."
        />
        <Button label="Adicionar" onPress={salvar} loading={criar.isPending} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tituloItem: { flexShrink: 1, paddingRight: spacing.md },
  nome: { ...typography.bodyStrong, color: colors.ink },
  meta: { ...typography.caption, color: colors.inkSoft },
  aporte: { alignItems: 'flex-end' },
  porMes: { ...typography.caption, color: colors.inkSoft },
  detalhe: { marginTop: spacing.sm },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.md },
  form: { gap: spacing.lg },
});
