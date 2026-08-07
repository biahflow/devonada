import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Feedback } from '../../../src/components/ui/Feedback';
import { FormField } from '../../../src/components/ui/FormField';
import { CurrencyInput } from '../../../src/components/ui/CurrencyInput';
import { OptionGroup } from '../../../src/components/ui/OptionGroup';
import { MoneyText } from '../../../src/components/ui/MoneyText';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import {
  useCriarFonte,
  useExcluirFonte,
  useFontes,
  useRegistrarRecebimento,
} from '../../../src/hooks/useCaixa';
import { mesAtual } from '../../../src/util/mes';
import type { FonteRenda, TipoFonteRenda } from '../../../src/api/types';
import { ApiError } from '../../../src/api/client';
import { colors, spacing, typography } from '../../../src/theme/theme';

const TIPOS: readonly { value: TipoFonteRenda; label: string; description?: string }[] = [
  { value: 'pj_hora', label: 'PJ por hora', description: 'Muda de mês para mês.' },
  { value: 'clt', label: 'CLT' },
  { value: 'autonomo', label: 'Autônomo' },
  { value: 'beneficio', label: 'Benefício' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'outro', label: 'Outro' },
];

/** Tipos em que a renda muda mês a mês — o registro de recebimento vale a pena. */
const VARIAVEIS: readonly TipoFonteRenda[] = ['pj_hora', 'autonomo'];

export default function RendaCaixa() {
  const router = useRouter();
  const { fontes, isPending, error, refetch } = useFontes();

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando suas fontes de renda" />
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
          title="De onde vem sua renda"
          description="Uma linha por fonte. Renda que muda de mês para mês ganha um registro do que caiu."
        />

        {fontes.length === 0 ? (
          <EmptyState
            icon="trending-up"
            title="Nenhuma fonte cadastrada"
            description="Cadastre uma vez e ela vale todo mês — não é lançamento, é registro. Quando a renda mudar, você edita."
          />
        ) : (
          fontes.map((f) => <ItemFonte key={f.id} fonte={f} />)
        )}

        <NovaFonte />

        <Button label="Voltar ao caixa" onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </Screen>
  );
}

function ItemFonte({ fonte }: { fonte: FonteRenda }) {
  const [mes, setMes] = useState(mesAtual());
  const [valor, setValor] = useState(0);
  const [erro, setErro] = useState<string | undefined>();
  const registrar = useRegistrarRecebimento();
  const excluir = useExcluirFonte();

  function salvarRecebimento() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      setErro('Use o formato AAAA-MM.');
      return;
    }
    setErro(undefined);
    registrar.mutate({ fonteId: fonte.id, mes, valor }, { onSuccess: () => setValor(0) });
  }

  return (
    <Card>
      <View style={styles.cabecalhoItem}>
        <View style={styles.tituloItem}>
          <Text style={styles.nome}>{fonte.nome}</Text>
          <Text style={styles.meta}>
            {TIPOS.find((t) => t.value === fonte.tipo)?.label ?? fonte.tipo}
            {fonte.ativo ? '' : ' · desativada'}
          </Text>
        </View>
        {fonte.valorTipicoInformado != null ? (
          <MoneyText centavos={fonte.valorTipicoInformado} size="body" />
        ) : (
          <Text style={styles.ausente}>não informado</Text>
        )}
      </View>

      {fonte.variavel ? (
        <View style={styles.recebimento}>
          <Text style={styles.explicacao}>
            Registre o que caiu de verdade. Com três meses ou mais, o plano passa a usar o seu
            pior mês em vez do valor que você digitou.
          </Text>
          <FormField
            label="Mês"
            value={mes}
            onChangeText={setMes}
            error={erro}
            placeholder="2026-08"
            autoCapitalize="none"
          />
          <CurrencyInput label="Quanto caiu" value={valor} onChangeValue={setValor} />
          <Button
            label="Registrar recebimento"
            onPress={salvarRecebimento}
            loading={registrar.isPending}
            variant="secondary"
          />
        </View>
      ) : null}

      <Button
        label="Excluir fonte"
        onPress={() => excluir.mutate(fonte.id)}
        loading={excluir.isPending}
        variant="ghost"
      />
    </Card>
  );
}

function NovaFonte() {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoFonteRenda>('pj_hora');
  const [valor, setValor] = useState(0);
  const [erro, setErro] = useState<string | undefined>();
  const criar = useCriarFonte();

  function salvar() {
    if (!nome.trim()) {
      setErro('Dê um nome para reconhecer esta fonte.');
      return;
    }
    setErro(undefined);
    criar.mutate(
      {
        nome: nome.trim(),
        tipo,
        valorTipicoInformado: valor > 0 ? valor : null,
        variavel: VARIAVEIS.includes(tipo),
        ativo: true,
      },
      {
        onSuccess: () => {
          setNome('');
          setValor(0);
        },
      },
    );
  }

  return (
    <Card>
      <Text style={styles.tituloSecao}>Adicionar fonte</Text>

      {criar.error ? (
        <Feedback
          tone="error"
          message={
            criar.error instanceof ApiError
              ? criar.error.message
              : 'Não deu para salvar. Tente de novo.'
          }
        />
      ) : null}

      <View style={styles.form}>
        <FormField
          label="Nome"
          value={nome}
          onChangeText={setNome}
          error={erro}
          placeholder="Contrato PJ"
        />
        <OptionGroup label="Tipo" options={TIPOS} value={tipo} onChangeValue={setTipo} />
        <CurrencyInput
          label="Quanto costuma entrar"
          value={valor}
          onChangeValue={setValor}
          optional
          hint={
            VARIAVEIS.includes(tipo)
              ? 'Se varia, pense num mês fraco — não no melhor.'
              : 'O que entra por mês.'
          }
        />
        <Button label="Adicionar" onPress={salvar} loading={criar.isPending} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  cabecalhoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tituloItem: { flexShrink: 1, paddingRight: spacing.md },
  nome: { ...typography.bodyStrong, color: colors.ink },
  meta: { ...typography.caption, color: colors.inkSoft },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
  recebimento: { gap: spacing.md, marginTop: spacing.md },
  explicacao: { ...typography.caption, color: colors.inkSoft },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.md },
  form: { gap: spacing.lg },
});
