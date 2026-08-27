import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { PercentInput } from '../../../src/components/ui/PercentInput';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { ErroDeMutacao } from '../../../src/components/ui/ErroDeMutacao';
import { useAtualizarMetas, useMetas } from '../../../src/hooks/useCaixa';
import type { MetasCaixa } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme/theme';

/**
 * Declaração do compromisso percentual (F-011, ADR 0021, decisão 4).
 *
 * SEM DEFAULT, SEM FAIXA E SEM SUGESTÃO (ADR 0009, ADR 0019): o campo nasce
 * vazio ou com o que já foi declarado, nunca com um percentual que o app
 * escolheu. Incide sobre a renda LÍQUIDA típica; o valor em centavos é calculado
 * no servidor e volta em `GET /v1/caixa`, esta tela não estima nada.
 *
 * Grava pela mesma rota dos potes (`PUT /v1/caixa/metas`), então precisa MANDAR
 * DE VOLTA as outras metas: a rota sobrescreve tudo, e enviar só o percentual
 * apagaria imposto, reserva e aposentadoria. O `422` do piso legal vem pronto do
 * servidor, em pt-BR — a tela exibe, nunca reescreve.
 */
export default function CompromissoScreen() {
  const router = useRouter();
  const { metas, isPending, error, refetch } = useMetas();

  if (isPending) {
    return (
      <Screen>
        <PageHeader eyebrow="Caixa" title="Compromisso percentual" onBack={() => router.back()} />
        <LoadingState label="Carregando seu compromisso" />
      </Screen>
    );
  }

  if (error || !metas) {
    return (
      <Screen>
        <PageHeader eyebrow="Caixa" title="Compromisso percentual" onBack={() => router.back()} />
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return <Formulario metas={metas} onVoltar={() => router.back()} />;
}

function Formulario({ metas, onVoltar }: { metas: MetasCaixa; onVoltar: () => void }) {
  const [bps, setBps] = useState(metas.compromissoPercentualBps ?? 0);
  const atualizar = useAtualizarMetas();

  function salvar() {
    // Manda TODAS as metas de volta — a rota sobrescreve tudo; enviar só o
    // percentual apagaria os outros potes. Zero vira ausência, como nos demais.
    atualizar.mutate(
      { ...metas, compromissoPercentualBps: bps > 0 ? bps : null },
      { onSuccess: onVoltar },
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
          title="Compromisso percentual"
          description="Um percentual do que entra, reservado antes de sobrar — você decide quanto. Ele incide sobre o que sobra depois do imposto."
          onBack={onVoltar}
        />

        <Card>
          <PercentInput
            label="Percentual do que entra"
            value={bps}
            onChangeValue={setBps}
            hint="Você escolhe o número. Não sugerimos faixa — o percentual é seu."
          />
          <ErroDeMutacao error={atualizar.error} fallback="Não deu para salvar. Tente de novo." />
          <View style={styles.botaoSalvar}>
            <Button
              label={metas.compromissoPercentualBps != null ? 'Atualizar' : 'Declarar compromisso'}
              onPress={salvar}
              loading={atualizar.isPending}
              size="lg"
            />
          </View>
        </Card>

        <Text style={styles.nota}>
          O piso é da lei: se o percentual empurrar o que sobra abaixo do mínimo existencial, a gente
          não grava e explica por quê. A escolha acima do piso continua sendo sua.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  botaoSalvar: { marginTop: spacing.md },
  nota: { ...typography.caption, color: colors.inkSoft },
});
