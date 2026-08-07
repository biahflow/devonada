import { View, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { categoria, radius, type CategoriaCor } from '../../theme/theme';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  cor: CategoriaCor;
  /** Diâmetro do anel. 40 em linha de lista, 56 em cabeçalho de detalhe. */
  tamanho?: 40 | 56;
}

/**
 * Glifo de traço fino dentro de um anel colorido — o elemento mais reconhecível
 * do reference, e o que dá identidade a uma lista sem precisar de miniatura.
 *
 * A cor do anel **nunca informa sozinha**: há sempre glifo e rótulo ao lado. Por
 * isso ela é medida contra o piso de objeto gráfico (3:1) e não contra o de
 * texto, e por isso não contradiz a regra da seção 4b, que proíbe cor por
 * categoria em MARCA DE GRÁFICO, onde a cor é o único portador do significado.
 *
 * Decorativo por definição: `accessibilityElementsHidden` para o leitor de tela
 * não anunciar um ícone cujo sentido já está no texto vizinho.
 */
export function CategoriaIcon({ icon, cor, tamanho = 40 }: Props) {
  const tom = categoria[cor];
  return (
    <View
      style={[styles.anel, { width: tamanho, height: tamanho, borderColor: tom }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Feather name={icon} size={tamanho === 56 ? 24 : 18} color={tom} />
    </View>
  );
}

const styles = StyleSheet.create({
  anel: {
    borderWidth: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
