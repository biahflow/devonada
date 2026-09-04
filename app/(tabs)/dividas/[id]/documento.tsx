import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Screen } from '../../../../src/components/ui/Screen';
import { PageHeader } from '../../../../src/components/ui/PageHeader';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { Feedback } from '../../../../src/components/ui/Feedback';
import { LoadingState } from '../../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { ErroDeMutacao } from '../../../../src/components/ui/ErroDeMutacao';
import { OptionGroup, type Option } from '../../../../src/components/ui/OptionGroup';
import { escolherArquivo } from '../../../../src/components/ui/SeletorDeArquivo';
import { CampoRevisao } from '../../../../src/components/dividas/CampoRevisao';
import { PainelDeDocumento } from '../../../../src/components/dividas/PainelDeDocumento';
import { useEnviarContrato } from '../../../../src/hooks/useContrato';
import { useDivida, useLigarDocumento } from '../../../../src/hooks/useDividas';
import { extracaoParaProposta } from '../../../../src/util/extracao';
import {
  camposMarcados,
  linhasDeConciliacao,
  type CampoConciliavel,
  type LinhaConciliacao,
} from '../../../../src/util/conciliacao';
import type {
  ArquivoContrato,
  ExtracaoContrato,
  TipoDocumento,
} from '../../../../src/api/contratos';
import { colors, radius, spacing, typography } from '../../../../src/theme/theme';

/**
 * Documento numa dívida que JÁ EXISTE (F-019, ADR 0025).
 *
 * O fluxo de documento do M1.5 sempre terminava em CRIAÇÃO. Quem cadastrou a
 * dívida à mão ficava sem `extracaoId`, e sem ele a revisão de cobrança não acha
 * extração, não produz achado e não tem `valorJusto` — permanentemente fora da
 * razão de o produto existir. Esta tela abre o caminho que faltava.
 *
 * A REGRA QUE MANDA AQUI: o que a pessoa digitou vence. Divergência entre o
 * documento e a dívida nasce desmarcada; só campo que a dívida não tem nasce
 * marcado, porque ali não há afirmação anterior a apagar. E o vínculo acontece
 * mesmo quando nada muda — é ele que destrava os encargos na revisão.
 */

// Mesma lista de `dividas/contrato/index.tsx`, e mesma copy. Dívida existente
// não tem restrição de tipo: qualquer um dos quatro pode chegar aqui.
const TIPOS: readonly Option<TipoDocumento>[] = [
  { value: 'contrato', label: 'Contrato', description: 'Empréstimo, consignado ou financiamento.' },
  { value: 'boleto', label: 'Boleto', description: 'Beneficiário, valor e vencimento.' },
  { value: 'carta', label: 'Carta', description: 'Aviso de cobrança em papel ou PDF.' },
  { value: 'print', label: 'Print', description: 'Captura de app, SMS ou mensagem.' },
];

export default function DocumentoDaDivida() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isPending, error, refetch } = useDivida(id);

  const [tipo, setTipo] = useState<TipoDocumento>('contrato');
  const [arquivo, setArquivo] = useState<ArquivoContrato | null>(null);
  const [extracaoId, setExtracaoId] = useState<string | null>(null);
  // Só o que a pessoa TOCOU. O padrão de cada linha continua vindo da
  // conciliação, então não há `useEffect` semeando estado nem `setState` no
  // render — e trocar de arquivo volta tudo ao padrão sozinho.
  const [alterados, setAlterados] = useState<Partial<Record<CampoConciliavel, boolean>>>({});

  const enviar = useEnviarContrato();
  const ligar = useLigarDocumento(id);

  const voltar = () => router.back();
  const voltarParaDivida = () => router.replace(`/dividas/${id}`);
  const paraADivida = {
    label: 'Voltar para a dívida',
    onPress: voltarParaDivida,
    variant: 'ghost' as const,
  };

  async function selecionar() {
    const escolhido = await escolherArquivo();
    if (escolhido) setArquivo(escolhido);
  }

  function enviarArquivo() {
    if (!arquivo) return;
    enviar.mutate(
      { arquivo, tipo },
      { onSuccess: ({ extracao }) => setExtracaoId(extracao.id) },
    );
  }

  /** Volta ao começo sem ligar nada — a saída de "tentar outro arquivo". */
  function recomecar() {
    setExtracaoId(null);
    setArquivo(null);
    setAlterados({});
    enviar.reset();
    ligar.reset();
  }

  const marcada = (linha: LinhaConciliacao) =>
    alterados[linha.campo] ?? linha.marcadaPorPadrao;

  function alternar(linha: LinhaConciliacao) {
    setAlterados((atuais) => ({ ...atuais, [linha.campo]: !(atuais[linha.campo] ?? linha.marcadaPorPadrao) }));
  }

  // Nos três ramos, não só no de conteúdo: tela que não carrega sem saída é
  // tela travada (ADR 0016).
  if (isPending) {
    return (
      <Screen>
        <PageHeader eyebrow="Documento" title="Carregando" onBack={voltar} />
        <LoadingState label="Carregando a dívida" />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <PageHeader eyebrow="Documento" title="Não deu para abrir" onBack={voltar} />
        <ErrorState error={error} onRetry={refetch} />
        <View style={styles.acoes}>
          <Button label="Voltar para a dívida" onPress={voltarParaDivida} variant="ghost" />
        </View>
      </Screen>
    );
  }

  const { divida } = data;
  const jaTemDocumento = !!divida.extracaoId;

  if (!extracaoId) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
          <PageHeader
            eyebrow="Documento"
            title={jaTemDocumento ? 'Trocar o documento' : 'Mandar o documento'}
            description="A gente lê o arquivo e compara com o que você já informou, campo a campo. Nada muda sem você marcar."
            onBack={voltar}
          />

          <Card>
            <OptionGroup
              label="Que documento é?"
              options={TIPOS}
              value={tipo}
              onChangeValue={setTipo}
            />
          </Card>

          {jaTemDocumento ? (
            // A substituição é NOMEADA, nunca descoberta depois (ADR 0025,
            // decisão 6). Uma dívida tem no máximo um documento.
            <Feedback
              tone="warning"
              message="Esta dívida já tem um documento ligado. O novo entra no lugar dele, e o anterior deixa de valer."
            />
          ) : null}

          {/* Transparência ANTES do toque que abre o seletor é parte do
              consentimento, não cortesia (guardrail 8.3). */}
          <Feedback
            tone="info"
            message="Seu documento é lido e descartado: guardamos só os dados extraídos e os trechos que os comprovam, nunca o arquivo. Nada muda na dívida antes de você revisar."
          />

          {arquivo ? (
            <View style={styles.arquivo}>
              <Text style={styles.arquivoNome} numberOfLines={1}>
                {arquivo.nome}
              </Text>
              <Text style={styles.arquivoTipo}>{arquivo.mimeType}</Text>
            </View>
          ) : null}

          <ErroDeMutacao
            error={enviar.error}
            fallback={'Não deu para enviar o documento. Tente de novo.'}
          />

          <View style={styles.acoes}>
            <Button
              label={arquivo ? 'Escolher outro arquivo' : 'Escolher arquivo'}
              onPress={selecionar}
              variant={arquivo ? 'secondary' : 'primary'}
            />
            {arquivo ? (
              <Button
                label="Enviar para leitura"
                onPress={enviarArquivo}
                loading={enviar.isPending}
              />
            ) : null}
            <Button label="Voltar para a dívida" onPress={voltarParaDivida} variant="ghost" />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <PainelDeDocumento
        extracaoId={extracaoId}
        eyebrow="Documento"
        onBack={voltar}
        textos={{
          abrindo: 'Abrindo o documento',
          tituloLendo: 'Lendo o documento',
          lendo: 'Isso costuma levar menos de um minuto',
          demora:
            'A leitura está demorando mais que o normal. Você pode esperar mais um pouco ou voltar para a dívida — nada foi perdido.',
          tituloFalhou: 'Não consegui ler',
        }}
        saidasNaDemora={[paraADivida]}
        saidasNaFalha={[
          { label: 'Tentar outro arquivo', onPress: recomecar, variant: 'secondary' },
          paraADivida,
        ]}
        saidasNoErro={[paraADivida]}
      >
        {(extracao: ExtracaoContrato) => {
          // A proposta já passou pelo descarte do guardrail 8.1: campo sem
          // trecho citável não chega aqui.
          const linhas = linhasDeConciliacao(extracaoParaProposta(extracao), divida, extracao);

          if (!linhas.length) {
            return (
              <ScrollView
                contentContainerStyle={styles.conteudo}
                showsVerticalScrollIndicator={false}
              >
                <PageHeader
                  eyebrow="Documento"
                  title="Não deu para aproveitar"
                  onBack={voltar}
                />
                <Feedback
                  tone="warning"
                  message="Não consegui ler nada citável nesse arquivo. Sem o trecho que comprova, o número é palpite — e palpite não entra numa dívida. Nada foi ligado."
                />
                <View style={styles.acoes}>
                  <Button
                    label="Tentar outro arquivo"
                    onPress={recomecar}
                    variant="secondary"
                  />
                  <Button
                    label="Voltar para a dívida"
                    onPress={voltarParaDivida}
                    variant="ghost"
                  />
                </View>
              </ScrollView>
            );
          }

          const decisoes = linhas.filter((linha) => linha.situacao !== 'confere');
          const confirmadas = linhas.filter((linha) => linha.situacao === 'confere');
          const tudoConfere = decisoes.length === 0;

          // Com carnê, trocar o valor cobrado recalcula as parcelas pendentes
          // no backend (F-019 em andamento). O aviso só aparece quando a linha
          // de valor está de fato marcada — desmarcada, o valor não muda, e
          // não há o que avisar.
          const linhaDeValor = decisoes.find((linha) => linha.campo === 'valorCobrado');
          const valorVaiMudar = !!linhaDeValor && marcada(linhaDeValor);
          const temCarne = (divida.totalParcelas ?? 0) > 0;
          const avisaRecalculoDeCarne = temCarne && valorVaiMudar;

          return (
            <ScrollView
              contentContainerStyle={styles.conteudo}
              showsVerticalScrollIndicator={false}
            >
              <PageHeader
                eyebrow="Documento"
                title={tudoConfere ? 'O documento confirma' : 'O que você quer usar?'}
                description={
                  tudoConfere
                    ? 'O que o documento diz bate com o que você já tinha informado. Vou ligar os dois assim mesmo — é o vínculo que destrava a revisão dos encargos.'
                    : 'O que você digitou continua valendo. Marque só o que quiser trocar pelo que o documento diz.'
                }
                onBack={voltar}
              />

              {decisoes.length ? (
                <View style={styles.escolhas}>
                  {decisoes.map((linha) => (
                    <LinhaDeEscolha
                      key={linha.campo}
                      linha={linha}
                      marcada={marcada(linha)}
                      onToggle={() => alternar(linha)}
                    />
                  ))}
                </View>
              ) : null}

              {confirmadas.length ? (
                <View style={styles.bloco}>
                  <Text style={styles.tituloBloco}>Confere com o que você informou</Text>
                  <Card>
                    {confirmadas.map((linha) => (
                      <CampoRevisao
                        key={linha.campo}
                        rotulo={linha.rotulo}
                        campo={linha.extraido}
                        valorFormatado={linha.documentoFormatado}
                      />
                    ))}
                  </Card>
                </View>
              ) : null}

              {jaTemDocumento ? (
                <Feedback
                  tone="warning"
                  message="Ao confirmar, este documento entra no lugar do que já estava ligado a esta dívida."
                />
              ) : null}

              {avisaRecalculoDeCarne ? (
                <Feedback
                  tone="warning"
                  message="Ao confirmar, as parcelas ainda não pagas deste carnê serão recalculadas para o valor novo. As parcelas já pagas não mudam."
                />
              ) : null}

              <ErroDeMutacao
                error={ligar.error}
                fallback={'Não deu para ligar o documento. Tente de novo.'}
              />

              <View style={styles.acoes}>
                <Button
                  label="Confirmar e revisar"
                  size="lg"
                  loading={ligar.isPending}
                  onPress={() => {
                    const campos = camposMarcados(linhas, marcada);
                    const corpo = Object.keys(campos).length
                      ? { extracaoId: extracao.id, campos }
                      : { extracaoId: extracao.id };
                    ligar.mutate(corpo, {
                      onSuccess: () => router.replace(`/dividas/${id}/revisao`),
                    });
                  }}
                />
                <Button
                  label="Voltar para a dívida"
                  onPress={voltarParaDivida}
                  variant="ghost"
                />
              </View>
            </ScrollView>
          );
        }}
      </PainelDeDocumento>
    </Screen>
  );
}

/**
 * Uma decisão da conciliação: o que a pessoa informou de um lado, o que o
 * documento diz do outro — com o trecho à vista, em texto puro (guardrail 8.2),
 * que é o `CampoRevisao` fazendo o que já sabia fazer.
 */
function LinhaDeEscolha({
  linha,
  marcada,
  onToggle,
}: {
  linha: LinhaConciliacao;
  marcada: boolean;
  onToggle: () => void;
}) {
  const oQueVoceInformou =
    linha.situacao === 'diverge'
      ? `Você informou ${linha.atualFormatado}`
      : 'Você ainda não tinha informado isso';

  // A LINHA INTEIRA é o controle, então ela também é o que o leitor de tela
  // anuncia — e o rótulo precisa carregar a decisão completa, incluindo o
  // trecho. Anunciar só "usar valor cobrado" esconderia a evidência de quem não
  // enxerga a tela, que é o oposto do guardrail 8.1. O que fazer com o controle
  // já vem do `accessibilityRole` e do estado, não do texto.
  const trecho = linha.extraido?.trecho;
  const rotuloAcessivel = [
    `${linha.rotulo}.`,
    `${oQueVoceInformou}.`,
    `O documento diz ${linha.documentoFormatado}.`,
    trecho ? `Trecho do documento: ${trecho}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      accessibilityLabel={rotuloAcessivel}
      style={[styles.escolha, marcada && styles.escolhaMarcada]}
    >
      <View style={styles.escolhaTexto}>
        <Text style={styles.campoRotulo}>{linha.rotulo}</Text>
        <Text style={styles.atual}>{oQueVoceInformou}</Text>
        <CampoRevisao
          rotulo="O documento diz"
          campo={linha.extraido}
          valorFormatado={linha.documentoFormatado}
        />
      </View>

      {/* Cor sozinha não comunica estado: o quadrado muda de GLIFO, não só de
          tom, e o `accessibilityState` diz o mesmo ao leitor de tela. */}
      <Feather
        name={marcada ? 'check-square' : 'square'}
        size={22}
        color={marcada ? colors.primary : colors.inkSoft}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  acoes: { gap: spacing.sm, marginTop: spacing.lg },
  arquivo: { gap: 2 },
  arquivoNome: { ...typography.bodyStrong, color: colors.ink },
  arquivoTipo: { ...typography.caption, color: colors.inkSoft },
  escolhas: { gap: spacing.sm },
  escolha: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 56,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  escolhaMarcada: { borderColor: colors.primary },
  escolhaTexto: { flex: 1, gap: spacing.xs },
  campoRotulo: { ...typography.bodyStrong, color: colors.ink },
  atual: { ...typography.caption, color: colors.inkSoft },
  bloco: { gap: spacing.sm },
  tituloBloco: { ...typography.title, color: colors.ink },
});
