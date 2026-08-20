import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CurrencyInput } from '../ui/CurrencyInput';
import { FormField } from '../ui/FormField';
import { MoneyText } from '../ui/MoneyText';
import { formatBRL } from '../../util/money';
import { colors, radius, spacing, typography } from '../../theme/theme';

interface Props {
  /** `null` é NUNCA DECLAROU — diferente de `0`, que é escolha legítima. */
  respiro: number | null;
  respiroUsadoNoMes: number | null;
  respiroDisponivelNoMes: number | null;
  respiroSaldoAcumulado: number | null;
  /** Dispara `POST /v1/caixa/respiro/uso`. Quem grava é a tela dona do hook. */
  onRegistrarUso: (valor: number, descricao?: string) => void;
  /** Leva à declaração (`/caixa/respiro`) — no vazio, para criar; no cheio, para ajustar. */
  onDeclarar: () => void;
  registrandoUso?: boolean;
}

/**
 * O card de respiro na aba Caixa (`docs/design-system.md`, verbete `RespiroCard`).
 *
 * DOIS ESTADOS, e o vazio é o que faz a feature existir para quem mais
 * precisa dela: sem respiro declarado (`respiro === null`), convida a
 * declarar e diz que o preço vem em MESES — nunca um valor, faixa ou
 * percentual sugerido (ADR 0019, item 2; ADR 0009). Com respiro declarado,
 * mostra o número.
 *
 * NENHUM VALOR É CALCULADO AQUI além da proporção visual da barra — os quatro
 * números vêm prontos de `GET /v1/caixa` (guardrail 1.2).
 *
 * Copy é sempre de PERMISSÃO, nunca de prestação de contas (guardrail 4.1):
 * "sobram R$ 70 pra usar sem culpa", nunca "você já gastou R$ 80". A barra usa
 * o molde inline de `MetaCard` — trilho em `colors.neutralSurface`,
 * preenchimento em `colors.accent` — e NUNCA o `Meter`: ali existe marca de
 * limite e virada para `warning`, e aqui não há limite a ultrapassar.
 */
export function RespiroCard({
  respiro,
  respiroUsadoNoMes,
  respiroDisponivelNoMes,
  respiroSaldoAcumulado,
  onRegistrarUso,
  onDeclarar,
  registrandoUso,
}: Props) {
  if (respiro === null) {
    return (
      <Card>
        <Text style={styles.titulo}>Respiro</Text>
        <Text style={styles.convite}>
          Reserve uma fatia da sua capacidade para viver enquanto paga — um sorvete, um cinema, o
          que fizer sentido pra você. Você escolhe o valor, e a gente mostra quanto ele custa em
          meses de quitação.
        </Text>
        <Button label="Declarar respiro" onPress={onDeclarar} />
      </Card>
    );
  }

  // Os três vêm PRONTOS do servidor — o `?? 0` é só um piso de exibição para
  // um campo que, com `respiro` declarado, nunca deveria chegar nulo; não é
  // conta nova (guardrail 1.2, AC7).
  const usado = respiroUsadoNoMes ?? 0;
  const disponivel = respiroDisponivelNoMes ?? 0;
  const saldoAcumulado = respiroSaldoAcumulado ?? 0;
  // Progresso mostra sempre QUANTO JÁ FOI PERCORRIDO, nunca quanto falta
  // (guardrail 4): aqui, quanto do respiro do mês já foi aproveitado. Encher é
  // bom — usar respiro é o comportamento desejado, não um desvio.
  const proporcao = respiro > 0 ? Math.min(100, Math.max(0, (usado / respiro) * 100)) : 0;

  return (
    <Card>
      <View style={styles.topo}>
        <Text style={styles.titulo}>Respiro deste mês</Text>
        <MoneyText centavos={respiro} size="numeric" tone="ink" />
      </View>

      <Text style={styles.usados}>usados {formatBRL(usado)}</Text>

      <View
        style={styles.trilho}
        accessibilityLabel={`${Math.round(proporcao)}% do respiro do mês já usado`}
      >
        <View style={[styles.preenchimento, { width: `${proporcao}%` }]} />
      </View>

      <Text style={styles.sobra}>sobram {formatBRL(disponivel)} pra usar sem culpa</Text>

      {/* Linha DISCRETA em `caption`, nunca uma segunda barra — duas barras no
          mesmo card leriam como progresso e meta, que é a semântica do
          MetaCard, não desta. */}
      {saldoAcumulado > 0 ? (
        <Text style={styles.guardado}>guardado: {formatBRL(saldoAcumulado)}</Text>
      ) : null}

      <UsoDeRespiro onRegistrarUso={onRegistrarUso} loading={registrandoUso} />

      <Button label="Ajustar valor" onPress={onDeclarar} variant="ghost" />
    </Card>
  );
}

function UsoDeRespiro({
  onRegistrarUso,
  loading,
}: {
  onRegistrarUso: (valor: number, descricao?: string) => void;
  loading?: boolean;
}) {
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState('');

  function registrar() {
    if (valor <= 0) return;
    onRegistrarUso(valor, descricao.trim() || undefined);
    setValor(0);
    setDescricao('');
  }

  return (
    <View style={styles.uso}>
      <CurrencyInput
        label="Usar respiro"
        value={valor}
        onChangeValue={setValor}
        placeholder="Quanto você usou"
      />
      <FormField
        label="Em quê (opcional)"
        value={descricao}
        onChangeText={setDescricao}
        optional
        placeholder="sorvete, cinema, unha…"
      />
      <Button label="Registrar uso" onPress={registrar} loading={loading} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  titulo: { ...typography.bodyStrong, color: colors.ink },
  convite: {
    ...typography.body,
    color: colors.inkSoft,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usados: { ...typography.caption, color: colors.inkSoft, marginTop: 2 },
  trilho: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSurface,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  preenchimento: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accent },
  sobra: { ...typography.bodyStrong, color: colors.accent, marginTop: spacing.sm },
  guardado: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
  uso: { gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
});
