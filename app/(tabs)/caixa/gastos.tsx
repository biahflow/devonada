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
  useAtualizarGasto,
  useCriarGasto,
  useExcluirGasto,
  useGastos,
} from '../../../src/hooks/useCaixa';
import type { CategoriaGasto, Gasto } from '../../../src/api/types';
import { ApiError } from '../../../src/api/client';
import { colors, spacing, typography } from '../../../src/theme/theme';

const CATEGORIAS: readonly { value: CategoriaGasto; label: string }[] = [
  { value: 'moradia', label: 'Moradia' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'contas', label: 'Contas' },
  { value: 'saude', label: 'Saúde' },
  { value: 'dependentes', label: 'Dependentes' },
  { value: 'outros', label: 'Outros' },
];

const ESSENCIALIDADE = [
  {
    value: 'sim' as const,
    label: 'Essencial',
    description: 'Sem isso a vida não anda. Nunca entra numa proposta de corte.',
  },
  {
    value: 'nao' as const,
    label: 'Posso cortar',
    description: 'Entra na sua margem de manobra, se você decidir acelerar.',
  },
];

export default function GastosCaixa() {
  const router = useRouter();
  const { gastos, isPending, error, refetch } = useGastos();

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando seus gastos" />
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

  const essenciais = gastos.filter((g) => g.essencial);
  const cortaveis = gastos.filter((g) => !g.essencial);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Caixa"
          title="Para onde vai"
          description="Cadastre uma vez e vale todo mês. Quem decide o que é essencial é você — não o app."
        />

        {gastos.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="Nenhum gasto cadastrado"
            description="Se estiver com pressa, some tudo que é essencial numa linha só. Detalhar por categoria pode ficar para depois."
          />
        ) : null}

        {essenciais.length > 0 ? (
          <Secao titulo="Essenciais" gastos={essenciais} />
        ) : null}
        {cortaveis.length > 0 ? (
          <Secao titulo="Posso cortar" gastos={cortaveis} />
        ) : null}

        <NovoGasto />

        <Button label="Voltar ao caixa" onPress={() => router.back()} variant="ghost" />
      </ScrollView>
    </Screen>
  );
}

function Secao({ titulo, gastos }: { titulo: string; gastos: Gasto[] }) {
  return (
    <View style={styles.secao}>
      <Text style={styles.tituloSecao}>{titulo}</Text>
      {gastos.map((g) => (
        <ItemGasto key={g.id} gasto={g} />
      ))}
    </View>
  );
}

function ItemGasto({ gasto }: { gasto: Gasto }) {
  const atualizar = useAtualizarGasto();
  const excluir = useExcluirGasto();

  return (
    <Card>
      <View style={styles.linha}>
        <View style={styles.tituloItem}>
          <Text style={styles.nome}>{gasto.descricao}</Text>
          <Text style={styles.meta}>
            {CATEGORIAS.find((c) => c.value === gasto.categoria)?.label ?? gasto.categoria}
            {gasto.ativo ? '' : ' · desativado'}
          </Text>
        </View>
        <MoneyText centavos={gasto.valorMensal} size="body" tone={gasto.ativo ? 'ink' : 'inkSoft'} />
      </View>

      <View style={styles.acoesItem}>
        {/* `ativo` preserva o histórico sem entrar na conta — é o que dispensa
            apagar e recadastrar quando um gasto some por um tempo. */}
        <Button
          label={gasto.ativo ? 'Desativar' : 'Reativar'}
          onPress={() => atualizar.mutate({ id: gasto.id, patch: { ativo: !gasto.ativo } })}
          loading={atualizar.isPending}
          variant="ghost"
        />
        <Button
          label="Excluir"
          onPress={() => excluir.mutate(gasto.id)}
          loading={excluir.isPending}
          variant="ghost"
        />
      </View>
    </Card>
  );
}

function NovoGasto() {
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<CategoriaGasto>('moradia');
  const [essencial, setEssencial] = useState<'sim' | 'nao'>('sim');
  const [valor, setValor] = useState(0);
  const [erro, setErro] = useState<string | undefined>();
  const criar = useCriarGasto();

  function salvar() {
    if (!descricao.trim()) {
      setErro('Dê um nome para reconhecer este gasto.');
      return;
    }
    setErro(undefined);
    criar.mutate(
      {
        descricao: descricao.trim(),
        categoria,
        essencial: essencial === 'sim',
        fixo: true,
        valorMensal: valor,
        ativo: true,
      },
      {
        onSuccess: () => {
          setDescricao('');
          setValor(0);
        },
      },
    );
  }

  return (
    <Card>
      <Text style={styles.tituloSecao}>Adicionar gasto</Text>

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
          label="O que é"
          value={descricao}
          onChangeText={setDescricao}
          error={erro}
          placeholder="Aluguel"
        />
        <OptionGroup
          label="Categoria"
          options={CATEGORIAS}
          value={categoria}
          onChangeValue={setCategoria}
        />
        <OptionGroup
          label="Dá para cortar?"
          options={ESSENCIALIDADE}
          value={essencial}
          onChangeValue={setEssencial}
        />
        <CurrencyInput label="Quanto por mês" value={valor} onChangeValue={setValor} />
        <Button label="Adicionar" onPress={salvar} loading={criar.isPending} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  secao: { gap: spacing.md },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tituloItem: { flexShrink: 1, paddingRight: spacing.md },
  nome: { ...typography.bodyStrong, color: colors.ink },
  meta: { ...typography.caption, color: colors.inkSoft },
  acoesItem: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  form: { gap: spacing.lg },
});
