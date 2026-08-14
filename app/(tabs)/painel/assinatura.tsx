import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Feedback } from '../../../src/components/ui/Feedback';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { useAssinatura, useComprar, useProdutos } from '../../../src/hooks/useAssinatura';
import { abrirGerenciamento } from '../../../src/compras';
import type { SituacaoAssinatura } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme/theme';

/**
 * O que a assinatura paga. Escrito como o usuário vê o produto, e não como o
 * servidor o implementa: ele não sabe o que é "rota de escrita".
 */
const O_QUE_DESTRAVA = [
  'Cadastrar e alterar dívidas, parcelas e renegociações',
  'Registrar sua renda, seus gastos e o fechamento do mês',
  'Ler contratos e revisar cobrança',
  'Conversar com o assistente e simular a quitação',
];

export default function Assinatura() {
  const { situacao, isPending, error, refetch } = useAssinatura();

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando sua assinatura" />
      </Screen>
    );
  }

  if (error || !situacao) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return <Conteudo situacao={situacao} />;
}

function Conteudo({ situacao }: { situacao: SituacaoAssinatura }) {
  const router = useRouter();
  const { produtos, carregando, erro: erroDaLoja } = useProdutos();
  const { iniciar, restaurar, processando, erro } = useComprar();

  const plano = produtos[0];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Sua conta"
          title="Assinatura"
          description={descricaoDe(situacao)}
          onBack={() => router.back()}
        />

        {erro ? <Feedback tone="error" message={erro} /> : null}
        {erroDaLoja ? <Feedback tone="warning" message={erroDaLoja} /> : null}

        <Card>
          <Text style={styles.status}>{tituloDe(situacao)}</Text>
          <Text style={styles.detalhe}>{detalheDe(situacao)}</Text>
        </Card>

        {situacao.status !== 'ativa' ? (
          <Card>
            <Text style={styles.tituloLista}>O que a assinatura destrava</Text>
            <View style={styles.lista}>
              {O_QUE_DESTRAVA.map((item) => (
                <Text key={item} style={styles.item}>
                  • {item}
                </Text>
              ))}
            </View>
            {/* A promessa que sustenta o paywall, dita na própria tela de venda:
                nada do que já está lá some por falta de pagamento. */}
            <Text style={styles.nota}>
              Ver o que você já cadastrou é livre, com ou sem assinatura — suas dívidas, seu caixa
              e seu histórico continuam à vista.
            </Text>
          </Card>
        ) : null}

        <View style={styles.acoes}>
          {situacao.status === 'ativa' ? (
            <Button
              label="Gerenciar no sistema"
              onPress={() => void abrirGerenciamento()}
              variant="ghost"
            />
          ) : (
            <Button
              // O PREÇO VEM DA LOJA, já formatado na moeda do usuário. Sem
              // plano carregado o botão não inventa número nenhum.
              label={plano ? `Assinar por ${plano.precoLocalizado}` : 'Assinar'}
              onPress={() => void iniciar()}
              loading={processando || carregando}
              disabled={!plano}
            />
          )}

          <Button
            label="Restaurar compras"
            onPress={() => void restaurar()}
            loading={processando}
            variant="ghost"
          />
        </View>

        <Text style={styles.rodape}>
          A cobrança é feita pela loja do seu aparelho e renova sozinha até você cancelar. Cancelar
          desliga a renovação: o período já pago continua valendo até o fim.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function tituloDe(s: SituacaoAssinatura): string {
  if (s.status === 'ativa') return 'Assinatura ativa';
  if (s.status === 'em_teste') return 'Período de teste';
  return 'Somente leitura';
}

function descricaoDe(s: SituacaoAssinatura): string {
  if (s.status === 'expirada') return 'Assine para voltar a registrar e alterar seus dados.';
  return 'Como está seu acesso hoje.';
}

function detalheDe(s: SituacaoAssinatura): string {
  if (s.status === 'expirada') {
    return 'Seu período de teste terminou. Você continua vendo tudo o que já cadastrou; para registrar ou alterar, é preciso assinar.';
  }

  const dias = s.diasRestantes === 1 ? '1 dia' : `${s.diasRestantes} dias`;

  if (s.status === 'em_teste') {
    return `Faltam ${dias} de teste. Depois disso o app fica somente leitura até você assinar.`;
  }

  return s.renovacaoAutomatica
    ? `Renova em ${dias}.`
    : `Vale por mais ${dias}. A renovação está desligada.`;
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  status: { ...typography.bodyStrong, color: colors.ink },
  detalhe: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
  tituloLista: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  lista: { gap: spacing.xs },
  item: { ...typography.caption, color: colors.inkSoft },
  nota: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.md },
  acoes: { gap: spacing.md },
  rodape: { ...typography.caption, color: colors.inkSoft },
});
