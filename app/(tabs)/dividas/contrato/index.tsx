import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { Feedback } from '../../../../src/components/ui/Feedback';
import { OptionGroup, type Option } from '../../../../src/components/ui/OptionGroup';
import { escolherArquivo } from '../../../../src/components/ui/SeletorDeArquivo';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { useEnviarContrato } from '../../../../src/hooks/useContrato';
import type { ArquivoContrato, TipoDocumento } from '../../../../src/api/contratos';
import { colors, spacing, typography } from '../../../../src/theme/theme';

// O que a gente procura em cada tipo, para a tela dizer a verdade antes do
// upload — um print de cobrança não tem taxa de juros a extrair.
const TIPOS: readonly Option<TipoDocumento>[] = [
  { value: 'contrato', label: 'Contrato', description: 'Empréstimo, consignado ou financiamento.' },
  { value: 'boleto', label: 'Boleto', description: 'Beneficiário, valor e vencimento.' },
  { value: 'carta', label: 'Carta', description: 'Aviso de cobrança em papel ou PDF.' },
  { value: 'print', label: 'Print', description: 'Captura de app, SMS ou mensagem.' },
];

export default function EnviarContrato() {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<ArquivoContrato | null>(null);
  const [tipo, setTipo] = useState<TipoDocumento>('contrato');
  const enviar = useEnviarContrato();

  async function selecionar() {
    const escolhido = await escolherArquivo();
    if (escolhido) setArquivo(escolhido);
  }

  function enviarArquivo() {
    if (!arquivo) return;
    enviar.mutate(
      { arquivo, tipo },
      { onSuccess: ({ extracao }) => router.replace(`/dividas/contrato/${extracao.id}`) },
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow="Atalho"
          title="Ler o documento"
          description="Mande o contrato, o boleto, a carta ou o print da cobrança. A gente lê e preenche o cadastro para você conferir."
          onBack={() => router.back()}
        />

        <Card>
          <OptionGroup
            label="Que documento é?"
            options={TIPOS}
            value={tipo}
            onChangeValue={setTipo}
          />
        </Card>

        <Card>
          <Text style={styles.tituloCard}>O que vamos procurar</Text>
          <Text style={styles.item}>Credor e valor cobrado, com o trecho que comprova</Text>
          <Text style={styles.item}>Data e vencimento, quando o documento traz</Text>
          <Text style={styles.item}>Só o que estiver escrito — nada é deduzido</Text>
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

        <ErroDeMutacao error={enviar.error} fallback={'Não deu para enviar o contrato. Tente de novo.'} />

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
