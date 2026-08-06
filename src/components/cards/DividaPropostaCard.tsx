import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import type { DividaPropostaCardData } from '../../api/types';
import { CriticidadeBadge } from '../ui/Badge';
import { MoneyText } from '../ui/MoneyText';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { isoParaBR } from '../../util/date';
import { formatBasisPoints } from '../../util/percent';
import { propostaParaParams } from '../../util/proposta';

/**
 * O rascunho que o assistente entendeu da conversa.
 *
 * É o único card cujos valores não vêm do banco — vêm da fala do próprio
 * usuário. Por isso a copy diz duas coisas que nenhum outro card precisa dizer:
 * que aquilo é o que foi ENTENDIDO, e que **nada foi salvo**. O toque leva ao
 * formulário preenchido, e a gravação só acontece lá, com o dedo dele
 * (`docs/guardrails.md`, 7.2).
 *
 * O deep link usa campos tipados do card, nunca dado extraído do texto da
 * mensagem (guardrail 7.3) — e o destino valida tudo de novo na chegada.
 */
export function DividaPropostaCard({ data }: { data: DividaPropostaCardData }) {
  const router = useRouter();
  const alteracao = Boolean(data.dividaId);
  const params = propostaParaParams(data);

  function abrirFormulario() {
    router.push({
      pathname: alteracao ? '/dividas/[id]/editar' : '/dividas/nova',
      params: alteracao ? { ...params, id: String(data.dividaId) } : params,
    });
  }

  return (
    <Pressable
      onPress={abrirFormulario}
      accessibilityRole="button"
      accessibilityLabel={
        alteracao
          ? `Conferir a alteração proposta para ${data.dividaCredor ?? 'a dívida'}`
          : 'Conferir o cadastro proposto antes de salvar'
      }
      style={styles.card}
    >
      <Text style={styles.eyebrow}>
        {alteracao ? `Alteração · ${data.dividaCredor ?? 'dívida'}` : 'Cadastro'} · rascunho
      </Text>
      <Text style={styles.titulo}>Foi isto que eu entendi</Text>

      <View style={styles.campos}>
        {/* Na alteração, um credor proposto é a CORREÇÃO do nome — por isso o
            rótulo muda: senão pareceria repetir o que já está salvo. */}
        {data.credor ? (
          <Linha rotulo={alteracao ? 'Novo credor' : 'Credor'} valor={data.credor} />
        ) : null}

        {data.valorCobrado ? (
          <View style={styles.linha}>
            <Text style={styles.rotulo}>Valor cobrado</Text>
            <MoneyText centavos={data.valorCobrado} size="body" />
          </View>
        ) : null}

        {data.dataOrigem ? <Linha rotulo="Quando começou" valor={isoParaBR(data.dataOrigem)} /> : null}

        {data.tipo ? (
          <View style={styles.linha}>
            <Text style={styles.rotulo}>Classificação</Text>
            <View style={styles.badge}>
              <CriticidadeBadge tipo={data.tipo} />
            </View>
          </View>
        ) : null}

        {data.taxaJurosMensal ? (
          <Linha rotulo="Juros ao mês" valor={formatBasisPoints(data.taxaJurosMensal)} />
        ) : null}

        {data.totalParcelas ? (
          <Linha
            rotulo="Parcelas"
            valor={data.totalParcelas === 1 ? '1 parcela' : `${data.totalParcelas} parcelas`}
          />
        ) : null}

        {data.primeiroVencimento ? (
          <Linha rotulo="Primeiro vencimento" valor={isoParaBR(data.primeiroVencimento)} />
        ) : null}
      </View>

      <Text style={styles.aviso}>
        Nada foi salvo ainda. Confira e complete o que faltar antes de confirmar.
      </Text>

      <View style={styles.acao}>
        <Text style={styles.acaoTexto}>
          {alteracao ? 'Conferir a alteração' : 'Conferir e cadastrar'}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.linha}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    minHeight: 48,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titulo: { ...typography.bodyStrong, color: colors.ink },
  campos: { gap: spacing.sm, marginTop: spacing.sm },
  linha: { gap: 2 },
  rotulo: { ...typography.caption, color: colors.inkSoft },
  valor: { ...typography.body, color: colors.ink },
  badge: { marginTop: 2 },
  aviso: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.md },
  acao: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  acaoTexto: { ...typography.caption, color: colors.primary },
});
