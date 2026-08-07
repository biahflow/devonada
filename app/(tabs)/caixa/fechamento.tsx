import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { CurrencyInput } from '../../../src/components/ui/CurrencyInput';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { CategoriaIcon } from '../../../src/components/ui/CategoriaIcon';
import { ErroDeMutacao } from '../../../src/components/ui/ErroDeMutacao';
import { useConfirmarFechamento, useFechamento } from '../../../src/hooks/useCaixa';
import type { ItemConfirmado, ItemFechamento } from '../../../src/api/types';
import { formatMesCurto } from '../../../src/util/mes';
import { colors, spacing, typography } from '../../../src/theme/theme';

/**
 * Fechamento do mês (M7.1).
 *
 * O que esta tela resolve: gasto fixo, fonte e provisão são registros
 * permanentes e não se redigitam — é a forma do modelo que cuida disso. Sobram
 * o recebimento de renda variável e o gasto que muda de valor, e é só isso que
 * aparece aqui.
 *
 * A REGRA QUE ORGANIZA A TELA: pré-preencher não é confirmar. O backend propõe
 * um valor e diz de onde ele veio; nada é gravado até o usuário confirmar.
 * Replicar em silêncio faria um número que ninguém conferiu entrar na
 * capacidade — e a capacidade vira o aporte do simulador, que vira o plano que
 * a pessoa leva a um credor (guardrail 8.1).
 *
 * Por isso cada linha mostra a PROCEDÊNCIA do número. Valor pré-preenchido sem
 * origem visível é indistinguível de valor inventado.
 */
export default function FechamentoDoMes() {
  const router = useRouter();
  const { proposta, isPending, error, refetch } = useFechamento();

  const cabecalho = (
    <PageHeader
      titleLead="Fechar"
      title="o mês"
      description="Confira o que mudou. O que é fixo já está na conta e não precisa ser digitado de novo."
    />
  );

  if (isPending) {
    return (
      <Screen>
        {cabecalho}
        <LoadingState label="Montando o que mudou" />
      </Screen>
    );
  }

  if (error || !proposta) {
    return (
      <Screen>
        {cabecalho}
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  if (proposta.itens.length === 0) {
    return (
      <Screen>
        {cabecalho}
        <EmptyState
          icon="check-circle"
          title="Nada para confirmar"
          description="Suas fontes e gastos são todos fixos — eles já valem para este mês sem redigitar nada. Só renda variável e gasto que muda de valor aparecem aqui."
          actionLabel="Voltar para o caixa"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return <Formulario proposta={proposta} onPronto={() => router.back()} />;
}

function Formulario({
  proposta,
  onPronto,
}: {
  proposta: { mes: string; itens: ItemFechamento[] };
  onPronto: () => void;
}) {
  // O estado começa com a sugestão; item sem referência começa VAZIO, e é o
  // `tocado` que separa "o usuário confirmou zero" de "o usuário não mexeu".
  const [valores, setValores] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      proposta.itens
        .filter((i) => i.valorSugerido !== undefined)
        .map((i) => [chave(i), i.valorSugerido as number]),
    ),
  );
  const confirmar = useConfirmarFechamento();

  const recebimentos = proposta.itens.filter((i) => i.tipo === 'recebimento');
  const gastos = proposta.itens.filter((i) => i.tipo === 'gasto');

  function salvar() {
    // Só vai o que tem valor. Linha que o usuário deixou vazia não é enviada —
    // não confirmar não é o mesmo que declarar zero.
    const itens: ItemConfirmado[] = proposta.itens
      .filter((i) => valores[chave(i)] !== undefined)
      .map((i) => ({ tipo: i.tipo, id: i.id, valor: valores[chave(i)] as number }));

    confirmar.mutate({ mes: proposta.mes, itens }, { onSuccess: onPronto });
  }

  const confirmados = proposta.itens.filter((i) => valores[chave(i)] !== undefined).length;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          titleLead="Fechar"
          title={formatMesCurto(proposta.mes)}
          description="Confira o que mudou. O que é fixo já está na conta e não precisa ser digitado de novo."
        />

        {recebimentos.length > 0 ? (
          <Card>
            <Text style={styles.secao}>O que entrou</Text>
            {recebimentos.map((item) => (
              <Linha
                key={chave(item)}
                item={item}
                valor={valores[chave(item)]}
                onChange={(v) => setValores((atual) => ({ ...atual, [chave(item)]: v }))}
              />
            ))}
          </Card>
        ) : null}

        {gastos.length > 0 ? (
          <Card>
            <Text style={styles.secao}>O que variou</Text>
            {gastos.map((item) => (
              <Linha
                key={chave(item)}
                item={item}
                valor={valores[chave(item)]}
                onChange={(v) => setValores((atual) => ({ ...atual, [chave(item)]: v }))}
              />
            ))}
          </Card>
        ) : null}

        <ErroDeMutacao error={confirmar.error} fallback={'Não deu certo agora. Tente de novo.'} />

        <Text style={styles.rodape}>
          Só o que estiver preenchido é gravado. Campo que você deixar em branco continua como
          estava.
        </Text>

        <Button
          label={confirmados === 1 ? 'Confirmar 1 valor' : `Confirmar ${confirmados} valores`}
          onPress={salvar}
          size="lg"
          loading={confirmar.isPending}
          disabled={confirmados === 0}
        />
      </ScrollView>
    </Screen>
  );
}

/** `tipo` e `id` juntos: um gasto e uma fonte podem ter o mesmo id. */
function chave(item: ItemFechamento): string {
  return `${item.tipo}:${item.id}`;
}

/** A procedência em português. É o que impede o número de parecer inventado. */
function procedencia(item: ItemFechamento): string {
  if (item.origem === 'mes_anterior' && item.mesDeReferencia) {
    return `sugerido a partir de ${formatMesCurto(item.mesDeReferencia)}`;
  }
  if (item.origem === 'valor_atual') return 'valor atual, confirme ou ajuste';
  return 'sem referência anterior — informe o valor';
}

function Linha({
  item,
  valor,
  onChange,
}: {
  item: ItemFechamento;
  valor: number | undefined;
  onChange: (valor: number) => void;
}) {
  return (
    <View style={styles.linha}>
      <View style={styles.topo}>
        <CategoriaIcon
          icon={item.tipo === 'recebimento' ? 'trending-up' : 'shopping-bag'}
          cor={item.tipo === 'recebimento' ? 'teal' : 'ambar'}
        />
        <View style={styles.texto}>
          <Text style={styles.descricao} numberOfLines={1}>
            {item.descricao}
          </Text>
        </View>
      </View>

      {/* O rótulo é genérico de propósito: a descrição já está na linha acima,
          e repeti-la aqui faria o leitor de tela anunciar o mesmo texto duas
          vezes — o mesmo cuidado do `AporteExtra` com seus dois controles. */}
      <CurrencyInput
        label="Valor"
        value={valor ?? 0}
        onChangeValue={onChange}
        hint={procedencia(item)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  secao: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  linha: { gap: spacing.sm, paddingVertical: spacing.sm },
  topo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texto: { flex: 1, gap: 2 },
  descricao: { ...typography.bodyStrong, color: colors.ink },
  rodape: { ...typography.caption, color: colors.inkSoft },
});
