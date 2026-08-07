import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { CategoriaIcon } from './CategoriaIcon';
import { colors, radius, spacing, typography, type CategoriaCor } from '../../theme/theme';

type Estado = 'neutro' | 'atencao' | 'concluido';

interface Props {
  titulo: string;
  subtitulo?: string;
  icon?: keyof typeof Feather.glyphMap;
  cor?: CategoriaCor;
  /** Valor à direita. Passe um `MoneyText` — esta camada não formata dinheiro. */
  valor?: ReactNode;
  /** Linha pequena abaixo do valor: "falta pagar", "vence em 3 dias". */
  legenda?: string;
  estado?: Estado;
  onPress?: () => void;
  accessibilityHint?: string;
}

/**
 * A anatomia de linha do reference: ponto de estado, ícone em anel, título com
 * subtítulo, e à direita o valor com uma legenda abaixo.
 *
 * O ponto de estado é redundante de propósito — ele acompanha a legenda em
 * texto, nunca substitui. Cor sozinha não comunica estado (guardrail 4).
 *
 * `concluido` usa `accent` e `atencao` usa `warning`. **Nenhum estado usa
 * `danger`:** atraso é fato de calendário, não erro do usuário, e o reference
 * pinta saída de dinheiro em coral justamente onde este produto não pinta.
 */
export function ListRow({
  titulo,
  subtitulo,
  icon,
  cor = 'teal',
  valor,
  legenda,
  estado = 'neutro',
  onPress,
  accessibilityHint,
}: Props) {
  const conteudo = (
    <View style={styles.linha}>
      {estado !== 'neutro' ? (
        <View
          style={[
            styles.ponto,
            { backgroundColor: estado === 'atencao' ? colors.warning : colors.accent },
          ]}
        />
      ) : (
        <View style={styles.pontoVazio} />
      )}

      {icon ? <CategoriaIcon icon={icon} cor={cor} /> : null}

      <View style={styles.texto}>
        <Text style={styles.titulo} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={styles.subtitulo} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>

      <View style={styles.direita}>
        {valor}
        {legenda ? (
          <Text style={estado === 'atencao' ? styles.legendaAtencao : styles.legenda}>
            {legenda}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return conteudo;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.tocavel, pressed && styles.pressionado]}
    >
      {conteudo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tocavel: { borderRadius: radius.md },
  pressionado: { backgroundColor: colors.neutralSurface },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  ponto: { width: 8, height: 8, borderRadius: radius.pill },
  pontoVazio: { width: 8 },
  texto: { flex: 1, gap: 2 },
  titulo: { ...typography.bodyStrong, color: colors.ink },
  subtitulo: { ...typography.caption, color: colors.inkSoft },
  direita: { alignItems: 'flex-end', gap: 2 },
  legenda: { ...typography.caption, color: colors.inkSoft, fontSize: 12 },
  legendaAtencao: { ...typography.caption, color: colors.warning, fontSize: 12 },
});
