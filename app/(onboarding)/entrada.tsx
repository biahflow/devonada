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
import { Passos } from '../../src/components/onboarding/Passos';
import { tipoPorId, type TipoDeDivida } from '../../src/components/onboarding/tiposDeDivida';
import { useCriarDivida } from '../../src/hooks/useDividas';
import { ApiError } from '../../src/api/client';
import { dateParaIso } from '../../src/util/date';
import type { IsoDate } from '../../src/api/types';
import { colors, spacing, typography } from '../../src/theme/theme';

interface Resposta {
  credor: string;
  valor: number;
  dataOrigem: IsoDate;
}

/**
 * A bifurcação, e ela decide o que a triagem vai poder dizer.
 *
 * ESTA É A TELA MAIS IMPORTANTE DO ONBOARDING, e o motivo não é óbvio: só
 * contrato lido produz achado, e sem achado não há valor justo nem script
 * (backend/routers/revisao.py, `montar_script` devolve None sem achados). Quem
 * sai daqui pelo caminho manual recebe uma triagem honesta e mais pobre; quem
 * manda o documento recebe o "aha" inteiro.
 *
 * DUAS VARIANTES, decididas pelo tamanho da fila (ADR 0016):
 *
 * - UMA DÍVIDA marcada: o documento vem primeiro na tela, e não como
 *   alternativa escondida, justamente por causa do parágrafo acima. O caminho
 *   manual continua existindo porque exigir o papel de quem está em pânico às
 *   23h é perder a pessoa que mais precisa do app.
 * - VÁRIAS DÍVIDAS: dois campos por dívida, uma por vez. O upload NÃO aparece
 *   aqui, e a razão é mecânica: `/dividas/contrato` vive fora do grupo
 *   `(onboarding)` e sair para lá abandonaria o resto da fila no meio. Em troca,
 *   a triagem no fim oferece "Mandar a fatura" para a primeira dívida — o "aha"
 *   é adiado, não perdido.
 *
 * NADA É GRAVADO ANTES DO FIM DA FILA. A pessoa pode voltar e corrigir quantas
 * vezes quiser porque as respostas moram aqui, não no servidor; o POST de todas
 * sai junto, no último passo. Criar dívida a cada passo faria o botão de voltar
 * produzir dívida duplicada ou valor desatualizado — e é dado real do usuário,
 * não rascunho.
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
  const criar = useCriarDivida();

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
      [item!.id]: { credor, valor, dataOrigem, [campo]: novo },
    }));
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

  return (
    <Screen>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Passos atual={2} onVoltar={semSeta ? undefined : voltarNaFila} />

        {!mostrarFormulario ? (
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
                  ? 'Dois campos por dívida. O contrato de cada uma você me manda depois, quando tiver em mãos.'
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

            <View style={styles.rodape}>
              <Button
                label={
                  ultimo && emFila ? `Cadastrar as ${fila.length} dívidas` : 'Continuar'
                }
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
});
