import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/ui/Screen';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { FormField } from '../../src/components/ui/FormField';
import { CurrencyInput } from '../../src/components/ui/CurrencyInput';
import { DateField } from '../../src/components/ui/DateField';
import { Feedback } from '../../src/components/ui/Feedback';
import { LoadingState } from '../../src/components/ui/LoadingState';
import { Passos } from '../../src/components/onboarding/Passos';
import { CampoRevisao } from '../../src/components/dividas/CampoRevisao';
import { escolherArquivo } from '../../src/components/ui/SeletorDeArquivo';
import { tipoPorId, type TipoDeDivida } from '../../src/components/onboarding/tiposDeDivida';
import { useCriarDivida } from '../../src/hooks/useDividas';
import { useEnviarContrato, useExtracao } from '../../src/hooks/useContrato';
import { extracaoParaProposta } from '../../src/util/extracao';
import { linhasDeRevisao } from '../../src/util/revisaoExtracao';
import { ApiError } from '../../src/api/client';
import { dateParaIso } from '../../src/util/date';
import type { IsoDate, Uuid } from '../../src/api/types';
import { colors, spacing, typography } from '../../src/theme/theme';

interface Resposta {
  credor: string;
  valor: number;
  dataOrigem: IsoDate;
  /**
   * Liga a dívida à extração que a originou (ADR 0022). Presente só quando a
   * pessoa mandou o documento nesta dívida da fila. É a CHAVE da leitura, não um
   * campo lido — por isso viaja mesmo sem trecho (guardrail 8.1). No POST final,
   * ela faz a dívida nascer com achado e valor justo.
   */
  extracaoId?: Uuid;
  /**
   * Campo proposto pela extração que a fila NÃO edita em tela. Carregado por
   * fora do formulário e repassado ao POST — com trecho, senão `extracaoParaProposta`
   * já o teria descartado.
   */
  taxaJurosMensal?: number;
}

/**
 * A bifurcação, e ela decide o que a triagem vai poder dizer.
 *
 * ESTA É A TELA MAIS IMPORTANTE DO ONBOARDING, e o motivo não é óbvio: só
 * documento lido produz achado, e sem achado não há valor justo nem script
 * (backend/routers/revisao.py, `montar_script` só carrega o mínimo de segurança
 * sem achados). Quem sai daqui só pelo valor recebe uma triagem honesta e mais
 * pobre; quem manda o documento recebe o "aha" inteiro.
 *
 * DUAS VARIANTES, decididas pelo tamanho da fila:
 *
 * - UMA DÍVIDA marcada: o documento vem primeiro na tela, e não como
 *   alternativa escondida, justamente por causa do parágrafo acima. O caminho
 *   só-valor continua existindo porque exigir o papel de quem está em pânico às
 *   23h é perder a pessoa que mais precisa do app.
 * - VÁRIAS DÍVIDAS: dois campos por dívida, uma por vez, E o documento
 *   OPCIONAL por dívida, lido AQUI DENTRO (ADR 0022, que reverte o ponto 5 da
 *   ADR 0016). A extração roda inline — sem `router.push` para fora do grupo
 *   `(onboarding)`, que abandonaria o resto da fila. Quem tem o documento de
 *   uma dívida manda; quem não tem segue só pelo valor.
 *
 * NADA É GRAVADO ANTES DO FIM DA FILA — nem com documento. A extração grava uma
 * linha `extracao` (arquivo lido e descartado, ADR 0005), NUNCA uma `divida`:
 * nenhuma dívida existe antes do `enviarTudo()`. As respostas moram aqui, não no
 * servidor; o POST de todas sai junto, no último passo. A pessoa pode voltar e
 * corrigir quantas vezes quiser.
 */
export default function EntradaDaDivida() {
  const router = useRouter();
  const { fila: filaParam } = useLocalSearchParams<{ fila: string }>();
  const scroll = useRef<ScrollView>(null);

  // Param de rota é entrada não confiável: id desconhecido simplesmente cai
  // fora, em vez de virar uma dívida de tipo inventado.
  const fila = useMemo<TipoDeDivida[]>(
    () =>
      (filaParam ?? '')
        .split(',')
        .map((id) => tipoPorId(id.trim()))
        .filter((t): t is TipoDeDivida => t !== undefined),
    [filaParam],
  );

  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  /** id da opção → id da dívida já criada. Existe para o retry não duplicar. */
  const [criadas, setCriadas] = useState<Record<string, string>>({});
  const [manual, setManual] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  // Documento inline da fila (ADR 0022). `docAberto` liga o painel de leitura;
  // `extracaoIdAtual` é a extração em andamento — a fila espera o polling.
  const [docAberto, setDocAberto] = useState(false);
  const [extracaoIdAtual, setExtracaoIdAtual] = useState<Uuid | undefined>();

  const criar = useCriarDivida();
  const enviarDoc = useEnviarContrato();
  const {
    extracao,
    isPending: lendoExtracao,
    error: erroExtracao,
    refetch: reverificarExtracao,
    excedeuTempo,
  } = useExtracao(extracaoIdAtual ?? '');

  const emFila = fila.length > 1;
  const item = fila[indice];
  const ultimo = indice === fila.length - 1;

  if (!item) {
    // Fila vazia só acontece com param corrompido ou deep link à mão. Sem tela
    // de erro dramática: a escolha está a um toque.
    return (
      <Screen>
        <View style={styles.conteudo}>
          <Passos atual={2} onVoltar={() => router.back()} />
          <Feedback tone="error" message="Não entendi qual dívida você escolheu." />
          <Button label="Escolher a dívida" size="lg" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  // Data de origem pré-preenchida com hoje, no espírito "pré-preenchido, confirmar":
  // a pessoa não precisa saber a data de cabeça, mas pode corrigir com um toque.
  const hoje = dateParaIso(new Date());
  const resposta = respostas[item.id];
  const credor = resposta?.credor ?? '';
  const valor = resposta?.valor ?? 0;
  const dataOrigem = resposta?.dataOrigem ?? hoje;

  function responder(campo: keyof Resposta, novo: string | number) {
    setRespostas((atuais) => ({
      ...atuais,
      // Espalha o que já existe primeiro para não perder `extracaoId` e a taxa
      // carregados pelo documento: o formulário edita credor, valor e data; os
      // campos vindos da leitura viajam ao lado, intocados.
      [item!.id]: { ...atuais[item!.id], credor, valor, dataOrigem, [campo]: novo },
    }));
  }

  /** Abre o seletor nativo e dispara a extração inline, sem sair de `(onboarding)`. */
  async function abrirDocumento() {
    const arquivo = await escolherArquivo();
    if (!arquivo) return; // desistiu do seletor: nada muda na fila
    enviarDoc.reset();
    setExtracaoIdAtual(undefined);
    setDocAberto(true);
    enviarDoc.mutate(
      { arquivo, tipo: 'contrato' },
      { onSuccess: ({ extracao: e }) => setExtracaoIdAtual(e.id) },
    );
  }

  /** Fecha o painel de documento, preservando o que já estiver no formulário. */
  function fecharDocumento() {
    setDocAberto(false);
    setExtracaoIdAtual(undefined);
    enviarDoc.reset();
  }

  /**
   * A pessoa aceitou o que foi lido. A `Resposta` recebe os campos propostos —
   * já filtrados por trecho em `extracaoParaProposta` (guardrail 8.1) — e o
   * `extracaoId`. Nada é gravado: só entra no estado local da fila.
   */
  function confirmarDocumento() {
    if (!extracao || extracao.status !== 'concluida') return;
    const proposta = extracaoParaProposta(extracao);
    setRespostas((atuais) => ({
      ...atuais,
      [item!.id]: {
        credor: proposta.credor ?? credor,
        valor: proposta.valorCobrado ?? valor,
        dataOrigem: proposta.dataOrigem ?? dataOrigem,
        extracaoId: proposta.extracaoId,
        taxaJurosMensal: proposta.taxaJurosMensal,
      },
    }));
    setErro(undefined);
    fecharDocumento();
  }

  /** Ids das dívidas já gravadas, na ordem da fila. */
  function idsGravados(feitas: Record<string, string>) {
    return fila.map((t) => feitas[t.id]).filter((id): id is string => !!id);
  }

  function irParaTriagem(ids: string[]) {
    const primeira = ids[0];
    if (!primeira) return;
    // A triagem é da PRIMEIRA marcada — quem marca primeiro marca o que dói
    // mais. `total` só serve para a tela dizer que as outras foram salvas.
    router.replace({
      pathname: '/(onboarding)/triagem',
      params: { id: primeira, total: String(ids.length) },
    });
  }

  /** Grava a fila inteira, pulando o que já foi criado numa tentativa anterior. */
  async function enviarTudo() {
    const feitas = { ...criadas };
    try {
      for (const t of fila) {
        if (feitas[t.id]) continue;
        const r = respostas[t.id];
        if (!r) continue;
        const { divida } = await criar.mutateAsync({
          credor: r.credor.trim(),
          valorCobrado: r.valor,
          tipo: t.tipo,
          // A data que a pessoa confirmou no passo — pré-preenchida com hoje, mas
          // corrigível. A prescrição (5 anos, CC art. 206) conta a partir daqui,
          // então cravar "hoje" sem perguntar alertaria cedo demais; coletar a
          // data real acerta o cálculo já na entrada.
          dataOrigem: r.dataOrigem,
          // Só quando veio de documento: a ligação com a extração e a taxa lida.
          // É AQUI que a dívida da fila passa a nascer com achado (ADR 0022).
          ...(r.extracaoId ? { extracaoId: r.extracaoId } : {}),
          ...(r.taxaJurosMensal ? { taxaJurosMensal: r.taxaJurosMensal } : {}),
        });
        feitas[t.id] = divida.id;
        setCriadas({ ...feitas });
      }
    } catch {
      // `criar.error` já vira Feedback no topo. O que foi criado permanece: são
      // dívidas reais, e desfazê-las seria pior que a falha.
      return;
    }

    irParaTriagem(idsGravados(feitas));
  }

  function continuar() {
    if (!credor.trim()) return setErro('Diz pra quem você deve.');
    if (valor <= 0) return setErro('Quanto eles estão cobrando?');
    setErro(undefined);

    if (ultimo) return void enviarTudo();
    setIndice(indice + 1);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  function voltarNaFila() {
    setErro(undefined);
    if (indice > 0) {
      setIndice(indice - 1);
      scroll.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    router.back();
  }

  const jaGravadas = idsGravados(criadas);
  const mostrarFormulario = emFila || manual;
  // Na variante de uma dívida, a sub-tela manual já tem o ghost "Voltar" que
  // recua para a escolha do documento — duas setas ali seriam duas saídas
  // diferentes com o mesmo desenho.
  const semSeta = manual && !emFila;

  const erroDoc = enviarDoc.error ?? erroExtracao;
  const mensagemErroDoc =
    erroDoc instanceof ApiError
      ? erroDoc.message
      : 'Não deu para ler o documento agora. Você pode tentar de novo ou seguir só pelo valor.';

  return (
    <Screen>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Passos atual={2} onVoltar={semSeta ? undefined : voltarNaFila} />

        {docAberto ? (
          renderDocumento()
        ) : !mostrarFormulario ? (
          <>
            <View style={styles.chamada}>
              <Text style={styles.titulo}>Tem a fatura{'\n'}ou o contrato aí?</Text>
              <Text style={styles.ajuda}>
                {item.rotulo}. Se você tiver o documento, eu leio e procuro o que dá pra contestar —
                com o artigo de lei de cada ponto. É de lá que sai o valor justo e o script da
                negociação.
              </Text>
            </View>

            <Card>
              <Text style={styles.aviso}>
                A gente lê o arquivo e <Text style={styles.forte}>descarta</Text>. Ficam guardados
                só os campos e os trechos que os comprovam — nunca o documento.
              </Text>
            </Card>

            <View style={styles.rodape}>
              <Button
                label="Mandar a fatura ou o contrato"
                size="lg"
                onPress={() => router.push('/dividas/contrato')}
              />
              <Button label="Só sei o valor" variant="ghost" onPress={() => setManual(true)} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.chamada}>
              {emFila ? (
                <Text style={styles.contagem}>
                  {item.emoji} {item.rotulo} · {indice + 1} de {fila.length}
                </Text>
              ) : null}
              <Text style={styles.titulo}>
                {emFila ? 'Quanto é,\ne pra quem?' : 'Tudo bem.\nSó o essencial.'}
              </Text>
              <Text style={styles.ajuda}>
                {emFila
                  ? 'Dois campos por dívida. Se tiver o documento de alguma, eu leio e já preencho — inclusive o que dá pra contestar.'
                  : 'Dois campos e a gente já começa. O contrato você me manda quando tiver em mãos.'}
              </Text>
            </View>

            {criar.error ? (
              <Feedback
                tone="error"
                message={
                  criar.error instanceof ApiError
                    ? criar.error.message
                    : 'Não deu para salvar agora. Tente de novo.'
                }
              />
            ) : null}

            <View style={styles.form}>
              <FormField
                label="Pra quem você deve"
                value={credor}
                onChangeText={(t) => responder('credor', t)}
                placeholder="Nubank, Casas Bahia, seu Zé..."
                error={erro && !credor.trim() ? erro : undefined}
              />
              <CurrencyInput
                label="Quanto estão cobrando"
                value={valor}
                onChangeValue={(v) => responder('valor', v)}
                error={erro && credor.trim() ? erro : undefined}
              />
              <DateField
                label="Quando começou?"
                value={dataOrigem}
                onChangeValue={(iso) => responder('dataOrigem', iso)}
                hint="Já preenchi com hoje. Se souber a data certa, é só ajustar."
                maximumDate={new Date()}
              />
            </View>

            {/* DOCUMENTO OPCIONAL NA FILA (ADR 0022). Só na variante de várias:
                na de uma, o documento já é o caminho primário da tela anterior.
                O aviso de descarte aparece ANTES do toque (guardrail 8.3), porque
                o seletor nativo abre na hora. */}
            {emFila ? (
              <Card>
                <Text style={styles.aviso}>
                  {resposta?.extracaoId
                    ? 'Documento lido — os campos acima vieram dele. Quer trocar?'
                    : 'Tem o documento dessa dívida? Eu leio e já preencho — e procuro o que dá pra contestar.'}
                </Text>
                <Text style={styles.aviso}>
                  A gente lê o arquivo e <Text style={styles.forte}>descarta</Text>: ficam só os
                  campos e os trechos que os comprovam, nunca o documento.
                </Text>
                <Button
                  label={resposta?.extracaoId ? 'Trocar o documento' : 'Mandar o documento'}
                  variant="secondary"
                  onPress={abrirDocumento}
                  style={styles.botaoDoc}
                />
              </Card>
            ) : null}

            <View style={styles.rodape}>
              <Button
                label={ultimo && emFila ? `Cadastrar as ${fila.length} dívidas` : 'Continuar'}
                size="lg"
                onPress={continuar}
                loading={criar.isPending}
              />
              {!emFila ? (
                <Button label="Voltar" variant="ghost" onPress={() => setManual(false)} />
              ) : null}
              {/* A SAÍDA QUANDO A REDE INSISTE EM FALHAR NO MEIO DA FILA. Sem
                  ela, quem tem duas dívidas gravadas e a terceira falhando fica
                  preso num formulário sem ver o que já cadastrou — com o botão
                  de tentar de novo como única opção. Nada é desfeito: as dívidas
                  criadas são reais. */}
              {criar.error && jaGravadas.length > 0 ? (
                <Button
                  label={
                    jaGravadas.length === 1
                      ? 'Ver a dívida que já cadastrei'
                      : `Ver as ${jaGravadas.length} que já cadastrei`
                  }
                  variant="ghost"
                  onPress={() => irParaTriagem(jaGravadas)}
                />
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );

  /**
   * Os quatro estados do documento inline, ali mesmo na fila: enviando, lendo
   * (com o teto de 2min), falhou/erro e lido. O lido é a REVISÃO campo-a-campo
   * com o trecho à vista (guardrail 8.1) — espelho da tela `contrato/[id]`,
   * antes de a dívida entrar na fila.
   */
  function renderDocumento() {
    if (enviarDoc.isPending || (!extracaoIdAtual && !erroDoc)) {
      return <LoadingState label="Enviando o documento" />;
    }
    if (erroDoc) {
      return (
        <>
          <Feedback tone="error" message={mensagemErroDoc} />
          <View style={styles.rodape}>
            <Button label="Tentar de novo" variant="secondary" onPress={abrirDocumento} />
            <Button label="Seguir só pelo valor" variant="ghost" onPress={fecharDocumento} />
          </View>
        </>
      );
    }
    if (!extracao || extracao.status === 'processando' || lendoExtracao) {
      return excedeuTempo ? (
        <>
          <Feedback
            tone="warning"
            message="A leitura está demorando mais que o normal. Você pode esperar mais um pouco ou seguir só pelo valor — nada foi perdido."
          />
          <View style={styles.rodape}>
            <Button
              label="Verificar de novo"
              variant="secondary"
              onPress={() => reverificarExtracao()}
            />
            <Button label="Seguir só pelo valor" variant="ghost" onPress={fecharDocumento} />
          </View>
        </>
      ) : (
        <LoadingState label="Lendo o documento. Costuma levar menos de um minuto" />
      );
    }
    if (extracao.status === 'falhou') {
      return (
        <>
          <Feedback
            tone="warning"
            message={
              extracao.erro ??
              'Não deu para ler esse arquivo. Pode ser a qualidade da imagem ou um formato inesperado.'
            }
          />
          <View style={styles.rodape}>
            <Button label="Tentar outro arquivo" variant="secondary" onPress={abrirDocumento} />
            <Button label="Seguir só pelo valor" variant="ghost" onPress={fecharDocumento} />
          </View>
        </>
      );
    }

    const linhas = linhasDeRevisao(extracao);
    return (
      <>
        <View style={styles.chamada}>
          <Text style={styles.contagem}>
            {item!.emoji} {item!.rotulo} · {indice + 1} de {fila.length}
          </Text>
          <Text style={styles.titulo}>Confere{'\n'}o que eu li?</Text>
          <Text style={styles.ajuda}>
            Cada valor vem com o trecho do documento que o sustenta. Nada é salvo até você confirmar
            a fila inteira no fim.
          </Text>
        </View>

        {linhas.length ? (
          <Card>
            {linhas.map((linha) => (
              <CampoRevisao
                key={linha.rotulo}
                rotulo={linha.rotulo}
                campo={linha.campo}
                valorFormatado={linha.valorFormatado}
              />
            ))}
          </Card>
        ) : (
          <Feedback
            tone="warning"
            message="Não consegui extrair nada com trecho que comprove. Melhor seguir só pelo valor nessa."
          />
        )}

        <View style={styles.rodape}>
          <Button label="Usar estes dados" size="lg" onPress={confirmarDocumento} />
          <Button label="Descartar e digitar" variant="ghost" onPress={fecharDocumento} />
        </View>
      </>
    );
  }
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxl, gap: spacing.lg },
  chamada: { gap: spacing.sm },
  contagem: { ...typography.eyebrow, color: colors.primary, textTransform: 'uppercase' },
  titulo: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  ajuda: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  aviso: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  forte: { color: colors.ink, fontFamily: typography.bodyStrong.fontFamily },
  form: { gap: spacing.lg },
  rodape: { gap: spacing.sm, marginTop: spacing.md },
  botaoDoc: { marginTop: spacing.md },
});
