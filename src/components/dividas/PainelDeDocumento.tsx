import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import type { ExtracaoContrato } from '../../api/contratos';
import type { Uuid } from '../../api/types';
import { useExtracao } from '../../hooks/useContrato';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { Feedback } from '../ui/Feedback';
import { LoadingState } from '../ui/LoadingState';
import { PageHeader } from '../ui/PageHeader';
import { spacing } from '../../theme/theme';

/**
 * A máquina de quatro estados do documento — enviando, lendo (com o teto de
 * 2 min), falhou e concluída —, extraída para servir mais de uma tela (F-019).
 *
 * ELA EXISTIA EM DUAS CÓPIAS: a tela `dividas/contrato/[id]` e a função interna
 * de `app/(onboarding)/entrada.tsx`. A conciliação de documento em dívida
 * existente seria a terceira, e é aí que três cópias começam a divergir em
 * silêncio — uma ganha uma saída nova, a outra não. Aqui ficam DUAS: `entrada`
 * segue intacta de propósito, porque a fila multi-dívida tem invariante próprio
 * ("nada gravado antes do fim", ADR 0022) e mexer nela junto seria risco sem
 * retorno. A dívida fica declarada, e não escondida.
 *
 * O QUE É DO PAINEL: qual estado está valendo, o polling, o teto de espera e o
 * "Verificar de novo" — que só o dono da query consegue oferecer.
 *
 * O QUE É DO CONSUMIDOR: o conteúdo do estado concluído (via render prop, porque
 * uma tela termina em formulário e a outra em conciliação) e as SAÍDAS de cada
 * estado — os rótulos e para onde levam diferem, e nenhum estado pode ser beco
 * sem saída.
 */

export interface SaidaDoPainel {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export interface TextosDoPainel {
  /** Enquanto a primeira consulta não voltou. */
  abrindo?: string;
  /** Título da tela enquanto a extração processa. */
  tituloLendo?: string;
  /** Legenda do spinner enquanto a extração processa. */
  lendo?: string;
  /** Aviso quando a leitura estoura o teto de 2 min. */
  demora?: string;
  /** Título da tela quando a extração falhou. */
  tituloFalhou?: string;
}

interface Props {
  extracaoId: Uuid;
  eyebrow?: string;
  textos?: TextosDoPainel;
  onBack?: () => void;
  /** Saídas além do "Verificar de novo", quando a leitura demora demais. */
  saidasNaDemora: readonly SaidaDoPainel[];
  /** Saídas quando a extração falhou. */
  saidasNaFalha: readonly SaidaDoPainel[];
  /** Saídas além do "Tentar de novo" do `ErrorState`, quando a rede falha. */
  saidasNoErro?: readonly SaidaDoPainel[];
  children: (extracao: ExtracaoContrato) => ReactNode;
}

export function PainelDeDocumento({
  extracaoId,
  eyebrow = 'Leitura',
  textos,
  onBack,
  saidasNaDemora,
  saidasNaFalha,
  saidasNoErro,
  children,
}: Props) {
  const { extracao, isPending, error, refetch, excedeuTempo } = useExtracao(extracaoId);

  if (isPending) {
    // A seta aparece aqui também, e não só nos ramos com conteúdo: é justamente
    // quando a rede pendura que a pessoa quer sair (ADR 0016). O consumidor que
    // não passa `onBack` continua renderizando só o spinner, como antes.
    return (
      <>
        {onBack ? (
          <PageHeader
            eyebrow={eyebrow}
            title={textos?.tituloLendo ?? 'Lendo o documento'}
            onBack={onBack}
          />
        ) : null}
        <LoadingState label={textos?.abrindo ?? 'Abrindo o documento'} />
      </>
    );
  }

  if (error || !extracao) {
    return (
      <>
        <ErrorState error={error} onRetry={refetch} />
        {saidasNoErro?.length ? (
          <View style={styles.acoes}>
            <Saidas saidas={saidasNoErro} />
          </View>
        ) : null}
      </>
    );
  }

  if (extracao.status === 'processando') {
    return (
      <>
        <PageHeader
          eyebrow={eyebrow}
          title={textos?.tituloLendo ?? 'Lendo o documento'}
          onBack={onBack}
        />
        {excedeuTempo ? (
          <>
            <Feedback
              tone="warning"
              message={
                textos?.demora ??
                'A leitura está demorando mais que o normal. Você pode esperar mais um pouco — nada foi perdido.'
              }
            />
            <View style={styles.acoes}>
              <Button label="Verificar de novo" onPress={refetch} variant="secondary" />
              <Saidas saidas={saidasNaDemora} />
            </View>
          </>
        ) : (
          <LoadingState label={textos?.lendo ?? 'Isso costuma levar menos de um minuto'} />
        )}
      </>
    );
  }

  if (extracao.status === 'falhou') {
    return (
      <>
        <PageHeader
          eyebrow={eyebrow}
          title={textos?.tituloFalhou ?? 'Não consegui ler'}
          onBack={onBack}
        />
        <Feedback
          tone="warning"
          message={
            extracao.erro ??
            'Não deu para extrair os dados desse arquivo. Pode ser a qualidade da imagem ou um formato inesperado.'
          }
        />
        <View style={styles.acoes}>
          <Saidas saidas={saidasNaFalha} />
        </View>
      </>
    );
  }

  return <>{children(extracao)}</>;
}

function Saidas({ saidas }: { saidas: readonly SaidaDoPainel[] }) {
  return (
    <>
      {saidas.map((saida) => (
        <Button
          key={saida.label}
          label={saida.label}
          onPress={saida.onPress}
          variant={saida.variant ?? 'ghost'}
          style={styles.saida}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  acoes: { gap: spacing.sm, marginTop: spacing.lg },
  saida: { alignSelf: 'stretch' },
});
