import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import type { BlocoScript, Canal, ScriptNegociacao } from '../../api/types';
import { OptionGroup, type Option } from '../ui/OptionGroup';
import { colors, radius, spacing, typography } from '../../theme/theme';

/**
 * A fala de negociação por canal (M12) — a base legal à vista.
 *
 * O script vem do backend em BLOCOS TIPADOS por `momento`, nunca como texto
 * único a fatiar (guardrail 1.2). Este componente não compõe nem completa
 * citação legal (guardrail 3): ele só apresenta o que o backend curou e devolveu.
 *
 * O `momento` separa VISUALMENTE segurança de contestação: o alerta de validação
 * e a regra de pagamento são blocos de segurança, com tratamento próprio; o
 * argumento leva a borda verde de "por que você pode falar isso". Texto de
 * segurança e de contestação lado a lado, mal separados, leriam como "a dívida
 * tem problema" quando ninguém disse isso.
 *
 * Nos canais escritos (`chat`, `email`) cada bloco copiável tem BOTÃO PRÓPRIO —
 * a tela nunca entrega um texto único para a pessoa recortar à mão. No
 * `telefone` o script é guia de fala, então não há botão por bloco.
 *
 * O app NÃO envia nada (guardrail 7.2): o script é sugestão copiável e editável.
 */

const CANAIS: readonly Option<Canal>[] = [
  { value: 'telefone', label: 'Telefone' },
  { value: 'chat', label: 'Chat' },
  { value: 'email', label: 'E-mail' },
];

const IDS_DE_SEGURANCA = new Set(['alerta-validacao', 'regra-pagamento']);

function ehSeguranca(bloco: BlocoScript): boolean {
  return IDS_DE_SEGURANCA.has(bloco.id);
}

export function ScriptCard({
  script,
  onSelectCanal,
}: {
  script: ScriptNegociacao;
  onSelectCanal: (canal: Canal) => void;
}) {
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  async function copiarBloco(bloco: BlocoScript) {
    await Clipboard.setStringAsync(bloco.texto);
    setCopiadoId(bloco.id);
    setTimeout(() => setCopiadoId((atual) => (atual === bloco.id ? null : atual)), 2000);
  }

  return (
    <View style={styles.card}>
      <OptionGroup
        label="Onde você vai negociar"
        options={CANAIS}
        value={script.canal}
        onChangeValue={onSelectCanal}
      />

      <View style={styles.blocos}>
        {script.blocos.map((bloco) => (
          <Bloco
            key={bloco.id}
            bloco={bloco}
            copiado={copiadoId === bloco.id}
            onCopiar={() => copiarBloco(bloco)}
          />
        ))}
      </View>

      <Text style={styles.nota}>
        É uma sugestão. Leia, ajuste com suas palavras e envie você mesmo. Depois, guarde o print
        da resposta do credor.
      </Text>
    </View>
  );
}

function Bloco({
  bloco,
  copiado,
  onCopiar,
}: {
  bloco: BlocoScript;
  copiado: boolean;
  onCopiar: () => void;
}) {
  const seguranca = ehSeguranca(bloco);
  const argumento = bloco.momento === 'argumento';

  return (
    <View
      style={[
        styles.bloco,
        seguranca && styles.blocoSeguranca,
        argumento && styles.blocoArgumento,
      ]}
    >
      {seguranca ? (
        <View style={styles.selo}>
          <Feather name="shield" size={13} color={colors.inkSoft} />
          <Text style={styles.seloTexto}>{bloco.titulo ?? 'Segurança'}</Text>
        </View>
      ) : bloco.titulo ? (
        <Text style={argumento ? styles.tituloArgumento : styles.titulo}>{bloco.titulo}</Text>
      ) : null}

      <Text style={seguranca ? styles.textoSeguranca : styles.texto} selectable>
        {seguranca ? bloco.texto : `“${bloco.texto}”`}
      </Text>

      {bloco.copiavel ? (
        <Pressable
          onPress={onCopiar}
          accessibilityRole="button"
          accessibilityLabel={`Copiar este bloco${bloco.titulo ? `: ${bloco.titulo}` : ''}`}
          style={({ pressed }) => [styles.copiar, pressed && styles.copiarPressed]}
        >
          <Feather
            name={copiado ? 'check' : 'copy'}
            size={14}
            color={copiado ? colors.primary : colors.inkSoft}
          />
          <Text style={[styles.copiarTexto, copiado && styles.copiarTextoOk]}>
            {copiado ? 'Copiado' : 'Copiar'}
          </Text>
        </Pressable>
      ) : null}
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
    gap: spacing.md,
  },
  blocos: { gap: spacing.sm },
  bloco: {
    backgroundColor: colors.neutralSurface,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  // Segurança: tom neutro e recuado, com selo — não é fala a copiar num canal.
  blocoSeguranca: { backgroundColor: colors.background },
  // "Por que você pode falar isso": borda esquerda verde de 2px (design-system).
  blocoArgumento: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
  },
  selo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  seloTexto: {
    ...typography.caption,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  titulo: { ...typography.caption, color: colors.inkSoft },
  tituloArgumento: { ...typography.bodyStrong, color: colors.ink },
  texto: { ...typography.caption, color: colors.ink, fontSize: 14, lineHeight: 20 },
  textoSeguranca: { ...typography.caption, color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  copiar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  copiarPressed: { opacity: 0.7 },
  copiarTexto: { ...typography.caption, color: colors.inkSoft },
  copiarTextoOk: { color: colors.primary },
  nota: { ...typography.caption, color: colors.inkSoft },
});
