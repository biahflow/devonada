import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { CurrencyInput } from '../../../src/components/ui/CurrencyInput';
import { MoneyText } from '../../../src/components/ui/MoneyText';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { ErroDeMutacao } from '../../../src/components/ui/ErroDeMutacao';
import { useAtualizarGasto, useCaixa, useDeclararRespiro, useGastos } from '../../../src/hooks/useCaixa';
import { colors, spacing, typography } from '../../../src/theme/theme';

/**
 * Declaração do respiro (`docs/features/F-010-respiro/tasks/T5.md`).
 *
 * SEM DEFAULT, SEM FAIXA E SEM SUGESTÃO DE VALOR (ADR 0019, item 2) — o campo
 * nasce vazio ou com o que já foi declarado, nunca com um número que o app
 * escolheu. O preço da escolha — `custoEmMeses` — vem pronto do `PUT`; esta
 * tela não estima nada.
 *
 * Nomeia o RISCO DE DUPLA CONTAGEM com `gasto` não essencial (ADR 0019, item
 * 7): quem já lançou "lazer" como gasto e declara respiro vê a capacidade cair
 * duas vezes sem entender por quê. O caminho de desativar o gasto fica aqui
 * mesmo, sem precisar sair da tela.
 */
export default function RespiroScreen() {
  const router = useRouter();
  const { caixa, isPending, error, refetch } = useCaixa();

  if (isPending) {
    return (
      <Screen>
        <PageHeader eyebrow="Caixa" title="Seu respiro" onBack={() => router.back()} />
        <LoadingState label="Carregando seu respiro" />
      </Screen>
    );
  }

  if (error || !caixa) {
    return (
      <Screen>
        <PageHeader eyebrow="Caixa" title="Seu respiro" onBack={() => router.back()} />
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return <Formulario caixa={caixa} onVoltar={() => router.back()} />;
}

function Formulario({
  caixa,
  onVoltar,
}: {
  caixa: { respiro: number | null; respiroAtivo: boolean | null };
  onVoltar: () => void;
}) {
  const [valor, setValor] = useState(caixa.respiro ?? 0);
  const declarar = useDeclararRespiro();
  const { gastos } = useGastos();
  const atualizarGasto = useAtualizarGasto();

  // Só o que é NÃO ESSENCIAL e está ATIVO participa do risco: gasto essencial
  // não é lazer, e gasto já desativado não entra mais na conta.
  const gastosDeRisco = gastos.filter((g) => !g.essencial && g.ativo);

  function salvar() {
    declarar.mutate({ valorMensal: valor, ativo: caixa.respiroAtivo ?? true });
  }

  if (declarar.isSuccess) {
    const custoEmMeses = declarar.data.custoEmMeses;
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
          <PageHeader eyebrow="Caixa" title="Respiro guardado" onBack={onVoltar} />
          <Card>
            <Text style={styles.tituloSecao}>Respiro deste mês</Text>
            <MoneyText centavos={declarar.data.respiro.valorMensal} size="displaySm" tone="accent" />
            {/* `null` = não há dívida com dado suficiente para simular. A tela
                grava sem preço, em vez de exibir palpite (ADR 0019, item 2).
                ZERO É DIFERENTE DE NULO, e é um estado real: respiro pequeno
                pode não mover o mês da quitação. "Soma 0 meses" seria verdade
                dita de um jeito que ninguém fala. */}
            {custoEmMeses === 0 ? (
              <Text style={styles.custo}>
                Isso não muda o prazo da sua quitação.
              </Text>
            ) : custoEmMeses != null ? (
              <Text style={styles.custo}>
                Isso soma {custoEmMeses === 1 ? '1 mês' : `${custoEmMeses} meses`} à sua quitação —
                o preço da sua escolha, não uma cobrança.
              </Text>
            ) : null}
          </Card>
          <Button label="Concluir" onPress={onVoltar} size="lg" />
        </ScrollView>
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
          title="Seu respiro"
          description="Uma fatia pra viver enquanto paga — você decide o valor, a gente mostra o que ele custa em meses de quitação."
          onBack={onVoltar}
        />

        <Card>
          <CurrencyInput label="Respiro por mês" value={valor} onChangeValue={setValor} />
          <ErroDeMutacao error={declarar.error} fallback="Não deu para salvar. Tente de novo." />
          <View style={styles.botaoSalvar}>
            <Button
              label={caixa.respiro != null ? 'Atualizar respiro' : 'Declarar respiro'}
              onPress={salvar}
              loading={declarar.isPending}
              size="lg"
            />
          </View>
        </Card>

        {gastosDeRisco.length > 0 ? (
          <Card>
            <Text style={styles.tituloSecao}>Cuidado com a dupla contagem</Text>
            <Text style={styles.risco}>
              Você já tem {gastosDeRisco.length === 1 ? 'um gasto não essencial' : 'gastos não essenciais'}{' '}
              cadastrado{gastosDeRisco.length === 1 ? '' : 's'}. Se algum deles já é o mesmo lazer que você
              quer cobrir com o respiro, sua capacidade cai duas vezes sem você entender por quê. Desative
              o que fizer sentido — o respiro já cobre esse espaço.
            </Text>
            {gastosDeRisco.map((g) => (
              <View key={g.id} style={styles.linhaGasto}>
                <View style={styles.gastoInfo}>
                  <Text style={styles.gastoNome}>{g.descricao}</Text>
                  <MoneyText centavos={g.valorMensal} size="body" tone="inkSoft" />
                </View>
                <Button
                  label="Desativar"
                  onPress={() => atualizarGasto.mutate({ id: g.id, patch: { ativo: false } })}
                  loading={atualizarGasto.isPending}
                  variant="ghost"
                />
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  custo: { ...typography.body, color: colors.inkSoft, marginTop: spacing.sm },
  botaoSalvar: { marginTop: spacing.md },
  risco: { ...typography.body, color: colors.inkSoft, marginBottom: spacing.md },
  linhaGasto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gastoInfo: { gap: 2 },
  gastoNome: { ...typography.body, color: colors.ink },
});
