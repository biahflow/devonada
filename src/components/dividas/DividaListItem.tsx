import type { Divida, CriticidadeTipo } from '../../api/types';
import { ListRow } from '../ui/ListRow';
import { MoneyText } from '../ui/MoneyText';
import type { CategoriaCor } from '../../theme/theme';
import { isoParaBR } from '../../util/date';
import type Feather from '@expo/vector-icons/Feather';

interface Props {
  divida: Divida;
  onPress: () => void;
}

/**
 * Uma dívida na lista, na anatomia de linha do design system: anel de ícone por
 * criticidade, credor e contexto embaixo, valor à direita com a legenda.
 *
 * O anel usa cor por criticidade porque há glifo e valor ao lado — a cor reforça
 * uma informação que já está escrita. É o oposto de cor por categoria em marca
 * de gráfico, que a seção 4b proíbe.
 *
 * `coral` aparece só em `juros_abusivos`, o mesmo lugar onde a família do
 * vermelho já era admitida no `CriticidadeBadge`.
 */
const porCriticidade: Record<
  CriticidadeTipo,
  { icon: keyof typeof Feather.glyphMap; cor: CategoriaCor; rotulo: string }
> = {
  essencial: { icon: 'home', cor: 'teal', rotulo: 'Essencial' },
  com_garantia: { icon: 'shield', cor: 'ambar', rotulo: 'Com garantia' },
  juros_abusivos: { icon: 'trending-up', cor: 'magenta', rotulo: 'Juros altos' },
  consumo: { icon: 'shopping-bag', cor: 'azul', rotulo: 'Consumo' },
};

export function DividaListItem({ divida, onPress }: Props) {
  const quitada = divida.situacao === 'quitada';
  const { icon, cor, rotulo } = porCriticidade[divida.tipo];

  // A criticidade continua ESCRITA na linha de subtítulo. O anel colorido só
  // reforça: ícone e cor nunca carregam significado sozinhos (guardrail 4).
  const contexto = divida.proximoVencimento
    ? `Vence em ${isoParaBR(divida.proximoVencimento)}`
    : quitada
      ? 'Quitada'
      : undefined;

  return (
    <ListRow
      titulo={divida.credor}
      subtitulo={contexto ? `${rotulo} · ${contexto}` : rotulo}
      icon={icon}
      cor={cor}
      estado={quitada ? 'concluido' : 'neutro'}
      valor={
        <MoneyText
          centavos={divida.saldoDevedor ?? divida.valorCobrado}
          size="numeric"
          tone={quitada ? 'inkSoft' : 'ink'}
        />
      }
      legenda={quitada ? 'quitada' : undefined}
      onPress={onPress}
      accessibilityHint={`${divida.credor}, ver detalhes`}
    />
  );
}
