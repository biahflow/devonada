import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { CampoRevisao } from '../../../../src/components/dividas/CampoRevisao';
import { AlertaCard } from '../../../../src/components/dividas/AlertaCard';
import { DividaForm } from '../../../../src/components/dividas/DividaForm';
import { PainelDeDocumento } from '../../../../src/components/dividas/PainelDeDocumento';
import { useCriarDivida } from '../../../../src/hooks/useDividas';
import { extracaoParaProposta } from '../../../../src/util/extracao';
import { linhasDeRevisao } from '../../../../src/util/revisaoExtracao';
import { colors, spacing, typography } from '../../../../src/theme/theme';

export default function RevisarExtracao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const criar = useCriarDivida();

  const cadastrarAMao = {
    label: 'Cadastrar à mão',
    onPress: () => router.replace('/dividas/nova'),
    variant: 'ghost' as const,
  };

  return (
    <Screen>
      <PainelDeDocumento
        extracaoId={id}
        textos={{
          abrindo: 'Abrindo o contrato',
          tituloLendo: 'Lendo o contrato',
          lendo: 'Isso costuma levar menos de um minuto',
          demora:
            'A leitura está demorando mais que o normal. Você pode esperar mais um pouco ou cadastrar à mão — nada foi perdido.',
          tituloFalhou: 'Não consegui ler',
        }}
        saidasNaDemora={[cadastrarAMao]}
        saidasNaFalha={[
          {
            label: 'Tentar outro arquivo',
            onPress: () => router.replace('/dividas/contrato'),
            variant: 'secondary',
          },
          cadastrarAMao,
        ]}
      >
        {(extracao) => {
          const linhas = linhasDeRevisao(extracao);
          const proposta = extracaoParaProposta(extracao);

          return (
            <ScrollView
              contentContainerStyle={styles.conteudo}
              showsVerticalScrollIndicator={false}
            >
              <PageHeader
                eyebrow="Revisão"
                title="Confira o que li"
                description="Nada é salvo até você confirmar. Cada valor vem com o trecho do documento que o sustenta."
              />

              {linhas.length ? (
                <Card>
                  {linhas.map((linha) => (
                    <CampoRevisao
                      key={linha.rotulo}
                      rotulo={linha.rotulo}
                      campo={linha.campo}
                      valorFormatado={linha.valorFormatado}
                    />
                  ))}
                </Card>
              ) : null}

              {extracao.alertas?.length ? (
                <View style={styles.alertas}>
                  <Text style={styles.tituloAlertas}>Pontos que merecem atenção</Text>
                  {extracao.alertas.map((alerta) => (
                    <AlertaCard key={alerta.id} alerta={alerta} />
                  ))}
                </View>
              ) : null}

              <View>
                <Text style={styles.tituloForm}>Confirme os dados</Text>
                <Text style={styles.subtituloForm}>
                  Preenchi o que consegui comprovar. Ajuste o que estiver errado antes de salvar.
                </Text>
              </View>

              <ErroDeMutacao
                error={criar.error}
                fallback={'Não deu para salvar. Tente de novo.'}
              />

              <DividaForm
                inicial={proposta}
                submitLabel="Salvar dívida"
                submitting={criar.isPending}
                onSubmit={(input) =>
                  criar.mutate(input, { onSuccess: () => router.replace('/dividas') })
                }
              />
            </ScrollView>
          );
        }}
      </PainelDeDocumento>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  alertas: { gap: spacing.md },
  tituloAlertas: { ...typography.title, color: colors.ink },
  tituloForm: { ...typography.title, color: colors.ink },
  subtituloForm: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
});
