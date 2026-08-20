import { View, Text, StyleSheet } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../ui/Screen';
import { Button } from '../ui/Button';
import { MoneyText } from '../ui/MoneyText';
import type { TipoDeMarco } from '../../api/types';
import { colors, radius, spacing, typography } from '../../theme/theme';

interface Props {
  tipo: TipoDeMarco;
  /**
   * `null` é NUNCA DECLAROU RESPIRO — diferente de `0`, que é respiro declarado
   * sem nada guardado ainda. Os três casos têm copy própria, e nenhum deles
   * exibe "R$ 0,00" como se fosse conquista.
   */
  respiroSaldoAcumulado: number | null;
  /** CTA de permissão. Celebra o marco e sai. */
  onAproveitar: () => void;
  /** Manda o acumulado para aporte extra na dívida, celebra o marco e sai. */
  onGuardarProProximoMarco: () => void;
}

/**
 * A tela cheia do marco (`docs/design-system.md`, verbete `MarcoScreen`).
 *
 * MARCO CELEBRA; MARCO NÃO AVALIA (guardrail 4.1). A copy é de PERMISSÃO —
 * "Aproveita. Tá no plano." —, nunca de mérito: "você mereceu" condicionaria o
 * respiro a desempenho, e é justamente a incondicionalidade dele que faz a
 * culpa morrer. Nada aqui diz quanto a pessoa já gastou.
 *
 * O MARCO NÃO ALTERA O VALOR DO RESPIRO (ADR 0019, item 3). Ele libera o que já
 * estava acumulado. Não existe tabela de escala marco a marco — ela seria o
 * coeficiente sem fonte que a ADR 0009 proíbe, com outro nome.
 *
 * NENHUM VALOR É CALCULADO AQUI: `respiroSaldoAcumulado` chega pronto de
 * `GET /v1/caixa` (guardrail 1.2).
 */
export function MarcoScreen({
  tipo,
  respiroSaldoAcumulado,
  onAproveitar,
  onGuardarProProximoMarco,
}: Props) {
  const { titulo, legenda } = CONQUISTAS[tipo];
  const temSaldo = respiroSaldoAcumulado !== null && respiroSaldoAcumulado > 0;

  return (
    <Screen>
      <View style={styles.conteudo}>
        <View style={styles.centro}>
          {/*
            O GLOW VERDE — a exceção declarada de sombra da marca
            (docs/design-system.md, "Sombras — não existem"). Ele vive AQUI, na
            tela, e não em `theme.shadow`: é celebração pontual, não hierarquia
            de superfície.

            INTENSIDADE MENOR que a da tela de vitória, como o verbete pede: a
            referência é `0 0 60px rgba(31,193,107,.35)` e esta fica em 34px a
            20% — celebração inflacionada aqui esvaziaria a de lá.

            DUAS CAMADAS PORQUE SÃO DUAS PLATAFORMAS. `shadow*` pinta o halo
            colorido no iOS; no Android `elevation` não pinta sombra COLORIDA
            (e no escuro só sujaria a borda), então quem faz o brilho lá é o
            próprio disco em `accentSurface`. O efeito é mais forte no iOS, e
            isso está aceito: ele é decorativo, e nenhuma informação depende de
            alguém enxergá-lo.
          */}
          <View style={styles.halo}>
            <Feather name="award" size={30} color={colors.accent} />
          </View>

          <Text style={styles.eyebrow}>Conquista</Text>
          <Text style={styles.titulo} accessibilityRole="header">
            {titulo}
          </Text>
          <Text style={styles.legenda}>{legenda}</Text>

          <View style={styles.respiro}>
            {temSaldo ? (
              <>
                <Text style={styles.microlabel}>Respiro liberado</Text>
                <MoneyText centavos={respiroSaldoAcumulado} size="display" tone="accent" />
                {/*
                  SUGESTÃO CONTEXTUAL: TEXTO, NUNCA NÚMERO. Se ela produzisse um
                  valor — "que tal um jantar de R$ 120?" —, seria o app dizendo
                  quanto a pessoa deve gastar em lazer, que é o coeficiente sem
                  fonte que a ADR 0019 recusou.
                */}
                <Text style={styles.sugestao}>{sugestaoPara(respiroSaldoAcumulado)}</Text>
              </>
            ) : (
              <>
                <Text style={styles.microlabel}>Seu respiro</Text>
                {/*
                  ZERO E NULO SÃO COISAS DIFERENTES, e nenhum dos dois vira
                  "R$ 0,00" na tela: exibir zero como se fosse conquista seria
                  celebrar uma quantia que não existe, e prometer respiro a quem
                  nunca declarou seria inventar o default que a ADR 0019 recusa.
                */}
                <Text style={styles.semSaldo}>
                  {respiroSaldoAcumulado === null
                    ? 'Você ainda não declarou seu respiro — a fatia que fica reservada pra você viver enquanto paga. Quando declarar, o que não for usado te espera no próximo marco.'
                    : 'Ainda não tem nada guardado de meses anteriores. O respiro deste mês continua todo seu, pra usar sem culpa.'}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.rodape}>
          <Button label="Aproveita. Tá no plano." size="lg" onPress={onAproveitar} />
          <Button
            label="Guardar pro próximo marco"
            variant="ghost"
            onPress={onGuardarProProximoMarco}
          />
        </View>
      </View>
    </Screen>
  );
}

/**
 * O que cada marco diz. Só copy — nenhuma escala de valor, nenhum número.
 */
const CONQUISTAS: Record<TipoDeMarco, { titulo: string; legenda: string }> = {
  primeira_negociacao: {
    titulo: 'Primeira negociação\nfechada.',
    legenda: 'Você sentou com um credor e mudou o acordo. Essa era a parte difícil.',
  },
  primeira_quitacao: {
    titulo: 'Primeira dívida\nquitada.',
    legenda: 'Uma a menos. Essa não volta.',
  },
  rota_25: {
    titulo: 'Um quarto\nda rota.',
    legenda: 'Você já andou 25% do caminho até o devo nada.',
  },
  rota_50: {
    titulo: 'Metade\nda rota.',
    legenda: 'Daqui pra frente falta menos do que você já andou.',
  },
  rota_75: {
    titulo: 'Três quartos\nda rota.',
    legenda: 'Já dá pra ver o fim daqui.',
  },
};

/**
 * A tabela de copy, indexada pela FAIXA DE VALOR — nunca pelo marco, que não
 * escala nada (ADR 0019, item 3).
 *
 * OS LIMIARES SÃO ESCOLHA DE COPY, NÃO COEFICIENTE FINANCEIRO: eles não entram
 * em conta nenhuma, não saem da tela e produzem só texto. Nenhum valor em reais
 * aparece na frase — a pessoa lê o próprio número acima e decide o que fazer
 * com ele.
 */
const SUGESTOES: readonly { abaixoDe: number; texto: string }[] = [
  { abaixoDe: 10_000, texto: 'Dá pra um sorvete, um café sentado, sem pensar no preço.' },
  { abaixoDe: 30_000, texto: 'Dá pra fazer as unhas, cortar o cabelo, um jantar fora.' },
  { abaixoDe: Infinity, texto: 'Dá pra uma viagem curta, um fim de semana fora daqui.' },
];

function sugestaoPara(centavos: number): string {
  return SUGESTOES.find((f) => centavos < f.abaixoDe)?.texto ?? '';
}

const styles = StyleSheet.create({
  conteudo: { flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xl },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  halo: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  titulo: { ...typography.display, color: colors.ink, textAlign: 'center' },
  legenda: {
    ...typography.body,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  respiro: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.neutralSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  microlabel: {
    ...typography.eyebrow,
    color: colors.inkSoft,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  sugestao: {
    ...typography.body,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  semSaldo: { ...typography.body, color: colors.inkSoft, textAlign: 'center' },
  rodape: { gap: spacing.sm },
});
