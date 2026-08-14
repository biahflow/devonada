import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Badge } from '../ui/Badge';
import { MoneyText } from '../ui/MoneyText';
import { formatBRL } from '../../util/money';
import { formatMesCurto } from '../../util/mes';
import type { IsoMes, Meta, StatusMeta } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * Os rótulos e os tons das três situações.
 *
 * `aporte_baixo` é ÂMBAR E NUNCA VERMELHO. O vermelho deste app é status de
 * dívida — é o ponto do wordmark, o número que a jornada existe para fazer sumir
 * (ADR 0015). Gastá-lo em "você está guardando pouco para a viagem" apagaria o
 * significado que a marca inteira depende que ele tenha, e transformaria uma tela
 * de conquista em repreensão.
 */
const SITUACOES: Record<StatusMeta, { label: string; tone: 'primario' | 'atencao' | 'progresso' }> = {
  atingida: { label: 'Alcançada', tone: 'progresso' },
  em_dia: { label: 'Em dia', tone: 'primario' },
  aporte_baixo: { label: 'Aporte baixo', tone: 'atencao' },
};

const COR_DA_BARRA: Record<StatusMeta, string> = {
  atingida: colors.accent,
  em_dia: colors.primaryBright,
  aporte_baixo: colors.warning,
};

/**
 * Um card da aba Metas — a tela 09 da concepção.
 *
 * O ÚNICO CÁLCULO AQUI É A LARGURA DA BARRA, e ela é proporção visual, não
 * dinheiro: `saldo / valorAlvo`. Todo número que a pessoa lê vem do servidor,
 * inclusive o aporte sugerido — que depende do mês em que a pergunta é feita e
 * por isso nem sequer é persistido (ADR 0003).
 *
 * SEM STATUS, SEM PILL. Meta sem prazo ou sem aporte declarado não recebe
 * selo nenhum, porque o app não tem base para dizer se ela está em dia. Um
 * "aporte baixo" ali seria opinião disfarçada de cálculo.
 */
export function MetaCard({ meta, onPress }: { meta: Meta; onPress?: () => void }) {
  const situacao = meta.status ? SITUACOES[meta.status] : undefined;
  const alvo = meta.valorAlvo;
  const saldo = meta.saldo ?? 0;
  const proporcao = alvo > 0 ? Math.min(100, Math.max(0, (saldo / alvo) * 100)) : 0;
  const corBarra = meta.status ? COR_DA_BARRA[meta.status] : colors.inkSoft;

  const contexto = [
    meta.dataAlvo ? formatMesCurto(meta.dataAlvo as IsoMes) : 'sem prazo',
    `meta ${formatBRL(alvo)}`,
  ].join(' · ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${meta.nome}, ${contexto}` : undefined}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressionado]}
    >
      <View style={styles.topo}>
        <View style={styles.identidade}>
          <Text style={styles.nome}>
            {meta.emoji ? `${meta.emoji} ` : ''}
            {meta.nome}
          </Text>
          <Text style={styles.contexto}>{contexto}</Text>
        </View>
        {situacao ? <Badge label={situacao.label} tone={situacao.tone} /> : null}
      </View>

      <View style={styles.valores}>
        <View style={styles.valor}>
          <Text style={styles.rotulo}>Guardado</Text>
          <MoneyText centavos={saldo} size="numeric" tone="ink" />
        </View>
        {/* APORTE DECLARADO OU SUGERIDO, e a tela diz qual dos dois está
            mostrando. Chamar de "aporte" um número que a pessoa não escolheu
            faria ela achar que já está separando aquilo. */}
        {meta.aporteMensal != null ? (
          <View style={styles.valor}>
            <Text style={styles.rotulo}>Aporte</Text>
            <MoneyText centavos={meta.aporteMensal} size="numeric" tone="ink" />
          </View>
        ) : meta.aporteSugerido != null ? (
          <View style={styles.valor}>
            <Text style={styles.rotulo}>Sugerido</Text>
            <MoneyText centavos={meta.aporteSugerido} size="numeric" tone="inkSoft" />
          </View>
        ) : null}
      </View>

      <View style={styles.trilho} accessibilityLabel={`${Math.round(proporcao)}% do caminho`}>
        <View
          style={[styles.preenchimento, { width: `${proporcao}%`, backgroundColor: corBarra }]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressionado: { opacity: 0.85 },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  identidade: { flex: 1, gap: 2 },
  nome: { ...typography.bodyStrong, color: colors.ink },
  contexto: { ...typography.caption, color: colors.inkSoft },
  valores: { flexDirection: 'row', gap: spacing.xl },
  valor: { gap: 2 },
  rotulo: { ...typography.caption, color: colors.inkSoft, fontSize: 12 },
  trilho: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSurface,
    overflow: 'hidden',
  },
  preenchimento: { height: '100%', borderRadius: radius.pill },
});
