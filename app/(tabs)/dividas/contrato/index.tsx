import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { Feedback } from '../../../../src/components/ui/Feedback';
import { escolherArquivo } from '../../../../src/components/ui/SeletorDeArquivo';
import { useEnviarContrato } from '../../../../src/hooks/useContrato';
import { ApiError } from '../../../../src/api/client';
import type { ArquivoContrato } from '../../../../src/api/contratos';
import { colors, spacing, typography } from '../../../../src/theme/theme';

export default function EnviarContrato() {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<ArquivoContrato | null>(null);
  const enviar = useEnviarContrato();

  async function selecionar() {
    const escolhido = await escolherArquivo();
    if (escolhido) setArquivo(escolhido);
  }

  function enviarArquivo() {
    if (!arquivo) return;
    enviar.mutate(arquivo, {
      onSuccess: ({ extracao }) => router.replace(`/dividas/contrato/${extracao.id}`),
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Atalho"
          title="Ler o contrato"
          description="Mande o contrato do empréstimo, consignado ou financiamento. A gente lê e preenche o cadastro para você conferir."
        />

        <Card>
          <Text style={styles.tituloCard}>O que vamos procurar</Text>
          <Text style={styles.item}>Credor, valor, data e número de parcelas</Text>
          <Text style={styles.item}>Taxa de juros e Custo Efetivo Total</Text>
          <Text style={styles.item}>Tarifas e seguros embutidos que passam batido</Text>
        </Card>

        {/* Transparência antes do upload é parte do consentimento, não cortesia. */}
        <Feedback
          tone="info"
          message="Seu contrato é lido e descartado: guardamos só os dados extraídos e os trechos que os comprovam, nunca o arquivo. Nada é salvo antes de você revisar."
        />

        {arquivo ? (
          <View style={styles.arquivo}>
            <Text style={styles.arquivoNome} numberOfLines={1}>
              {arquivo.nome}
            </Text>
            <Text style={styles.arquivoTipo}>{arquivo.mimeType}</Text>
          </View>
        ) : null}

        {enviar.error ? (
          <Feedback
            tone="error"
            message={
              enviar.error instanceof ApiError
                ? enviar.error.message
                : 'Não deu para enviar o contrato. Tente de novo.'
            }
          />
        ) : null}

        <View style={styles.acoes}>
          <Button
            label={arquivo ? 'Escolher outro arquivo' : 'Escolher arquivo'}
            onPress={selecionar}
            variant={arquivo ? 'secondary' : 'primary'}
          />
          {arquivo ? (
            <Button
              label="Enviar para leitura"
              onPress={enviarArquivo}
              loading={enviar.isPending}
            />
          ) : null}
          <Button
            label="Prefiro digitar à mão"
            onPress={() => router.replace('/dividas/nova')}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  tituloCard: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  item: { ...typography.caption, color: colors.inkSoft, paddingVertical: 2 },
  arquivo: { gap: 2 },
  arquivoNome: { ...typography.bodyStrong, color: colors.ink },
  arquivoTipo: { ...typography.caption, color: colors.inkSoft },
  acoes: { gap: spacing.sm },
});
