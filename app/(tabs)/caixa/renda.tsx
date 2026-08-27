import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { FormField } from '../../../src/components/ui/FormField';
import { CurrencyInput } from '../../../src/components/ui/CurrencyInput';
import { PercentInput } from '../../../src/components/ui/PercentInput';
import { OptionGroup } from '../../../src/components/ui/OptionGroup';
import { MoneyText } from '../../../src/components/ui/MoneyText';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { EmptyState } from '../../../src/components/ui/EmptyState';
import { ErroDeMutacao } from '../../../src/components/ui/ErroDeMutacao';
import {
  useCaixa,
  useCriarEventoPrevisivel,
  useCriarFonte,
  useEventosPrevisiveis,
  useExcluirEventoPrevisivel,
  useExcluirFonte,
  useFontes,
  useRegistrarRecebimento,
} from '../../../src/hooks/useCaixa';
import { mesAtual } from '../../../src/util/mes';
import { formatBRL } from '../../../src/util/money';
import type {
  EventoPrevisivel,
  FonteRenda,
  TipoEventoPrevisivel,
  TipoFonteRenda,
} from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme/theme';

const TIPOS: readonly { value: TipoFonteRenda; label: string; description?: string }[] = [
  { value: 'pj_hora', label: 'PJ por hora', description: 'Muda de mês para mês.' },
  { value: 'clt', label: 'CLT', description: 'Líquido fixo, com 13º e férias.' },
  { value: 'autonomo', label: 'Autônomo', description: 'Oscila com o trabalho.' },
  { value: 'beneficio', label: 'Benefício', description: 'Valor fixo, data própria.' },
  { value: 'aluguel', label: 'Aluguel', description: 'Cai na vacância.' },
  { value: 'outro', label: 'Outro', description: 'Fluxo genérico.' },
];

/**
 * UM FORMULÁRIO QUE SE ADAPTA AO TIPO (F-011, ADR 0021, decisão de 20/08/2026).
 * Não são seis fluxos dedicados: é um formulário só, e o tipo escolhido decide o
 * que ele pergunta e o que ele diz. Nenhum valor é calculado no cliente — taxa,
 * imposto e renda típica chegam prontos do servidor (guardrail 1.2).
 */
interface PerfilDeTipo {
  valorLabel: string;
  valorHint: string;
  variavel: boolean;
  mostraAliquota: boolean;
  mostraDiaPagamento: boolean;
  mostraEventos: boolean;
  mostraCompromisso: boolean;
  nota: string;
}

const PERFIL_POR_TIPO: Record<TipoFonteRenda, PerfilDeTipo> = {
  pj_hora: {
    valorLabel: 'Quanto costuma entrar',
    valorHint: 'Se varia, pense num mês fraco — não no melhor.',
    variavel: true,
    mostraAliquota: true,
    mostraDiaPagamento: false,
    mostraEventos: false,
    mostraCompromisso: false,
    nota: 'Taxa por hora vira mês variável. Informe a alíquota do seu enquadramento — sem ela, nada é reservado, e a gente não estima por você.',
  },
  clt: {
    valorLabel: 'Líquido mensal',
    valorHint: 'O que cai na conta, já com os descontos.',
    variavel: false,
    mostraAliquota: false,
    mostraDiaPagamento: false,
    mostraEventos: true,
    mostraCompromisso: false,
    nota: '13º e férias existem e têm mês certo. Declare abaixo o valor e o mês de cada um: eles não entram na sua renda mensal — são munição para uma negociação à vista.',
  },
  autonomo: {
    valorLabel: 'Quanto costuma entrar',
    valorHint: 'Pense num mês fraco — é ele que o plano precisa aguentar.',
    variavel: true,
    mostraAliquota: false,
    mostraDiaPagamento: false,
    mostraEventos: false,
    mostraCompromisso: true,
    nota: 'Renda que oscila pede comprometer um percentual do que entra, não um valor fixo que o mês fraco derruba. O percentual você declara em Seus potes.',
  },
  beneficio: {
    valorLabel: 'Valor do benefício',
    valorHint: 'O valor fixo que você recebe.',
    variavel: false,
    mostraAliquota: false,
    mostraDiaPagamento: true,
    mostraEventos: false,
    mostraCompromisso: false,
    nota: 'Benefício tem data de pagamento própria — que não é o dia 5 de ninguém.',
  },
  aluguel: {
    valorLabel: 'Aluguel por mês',
    valorHint: 'Pense num mês típico; quando vagar, registre o mês como zero.',
    variavel: true,
    mostraAliquota: false,
    mostraDiaPagamento: false,
    mostraEventos: false,
    mostraCompromisso: false,
    nota: 'Aluguel varia com a vacância: um mês vago é um recebimento zero, e é assim que ele entra na conta.',
  },
  outro: {
    valorLabel: 'Quanto costuma entrar',
    valorHint: 'O que entra por mês.',
    variavel: false,
    mostraAliquota: false,
    mostraDiaPagamento: false,
    mostraEventos: false,
    mostraCompromisso: false,
    nota: 'Este é o fluxo genérico — sem regra específica de tipo. Se a sua renda se encaixar melhor numa das opções acima, ela passa a perguntar o que aquele tipo precisa.',
  },
};

function rotuloDoTipo(tipo: TipoFonteRenda): string {
  return TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
}

export default function RendaCaixa() {
  const router = useRouter();
  const { fontes, isPending, error, refetch } = useFontes();
  // A cascata só é lida pelo sinal tipado `impostoNaoDeclarado`; o número em si
  // vem todo dela, e o cliente não recalcula nada (guardrail 1.2).
  const { caixa } = useCaixa();

  if (isPending) {
    return (
      <Screen>
        <LoadingState label="Carregando suas fontes de renda" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          eyebrow="Caixa"
          title="De onde vem sua renda"
          description="Uma linha por fonte. O tipo que você escolher muda o que a gente pergunta — e o que a gente reserva."
          onBack={() => router.back()}
        />

        {fontes.length === 0 ? (
          <EmptyState
            icon="trending-up"
            title="Nenhuma fonte cadastrada"
            description="Cadastre uma vez e ela vale todo mês — não é lançamento, é registro. Quando a renda mudar, você edita."
          />
        ) : (
          fontes.map((f) => (
            <ItemFonte key={f.id} fonte={f} impostoNaoDeclarado={caixa?.impostoNaoDeclarado ?? false} />
          ))
        )}

        <NovaFonte />
      </ScrollView>
    </Screen>
  );
}

function ItemFonte({
  fonte,
  impostoNaoDeclarado,
}: {
  fonte: FonteRenda;
  impostoNaoDeclarado: boolean;
}) {
  const [mes, setMes] = useState(mesAtual());
  const [valor, setValor] = useState(0);
  const [erro, setErro] = useState<string | undefined>();
  const registrar = useRegistrarRecebimento();
  const excluir = useExcluirFonte();

  // "NÃO ESTÁ RESERVANDO IMPOSTO" — lido do sinal tipado do servidor
  // (`impostoNaoDeclarado`), NUNCA exibindo R$ 0,00 como se fosse reserva
  // (ADR 0009). Só vale para a fonte `pj_hora` sem alíquota própria: o sinal
  // global só liga quando não há fallback de perfil, então a fonte sem a sua
  // realmente não reserva.
  const semReserva =
    fonte.tipo === 'pj_hora' && fonte.impostoBps == null && impostoNaoDeclarado;

  function salvarRecebimento() {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
      setErro('Use o formato AAAA-MM.');
      return;
    }
    setErro(undefined);
    registrar.mutate({ fonteId: fonte.id, mes, valor }, { onSuccess: () => setValor(0) });
  }

  return (
    <Card>
      <View style={styles.cabecalhoItem}>
        <View style={styles.tituloItem}>
          <Text style={styles.nome}>{fonte.nome}</Text>
          <Text style={styles.meta}>
            {rotuloDoTipo(fonte.tipo)}
            {fonte.ativo ? '' : ' · desativada'}
          </Text>
        </View>
        {fonte.valorTipicoInformado != null ? (
          <MoneyText centavos={fonte.valorTipicoInformado} size="body" />
        ) : (
          <Text style={styles.ausente}>não informado</Text>
        )}
      </View>

      {fonte.diaPagamento != null ? (
        <Text style={styles.detalhe}>Cai todo dia {fonte.diaPagamento}.</Text>
      ) : null}

      {semReserva ? (
        <Text style={styles.semReserva}>
          Não está reservando imposto. Informe a alíquota desta fonte para separar o que não é seu.
        </Text>
      ) : null}

      {fonte.variavel ? (
        <View style={styles.recebimento}>
          <Text style={styles.explicacao}>
            Registre o que caiu de verdade. Com três meses ou mais, o plano passa a usar o seu
            pior mês em vez do valor que você digitou.
          </Text>
          <FormField
            label="Mês"
            value={mes}
            onChangeText={setMes}
            error={erro}
            placeholder="2026-08"
            autoCapitalize="none"
          />
          <CurrencyInput label="Quanto caiu" value={valor} onChangeValue={setValor} />
          <Button
            label="Registrar recebimento"
            onPress={salvarRecebimento}
            loading={registrar.isPending}
            variant="secondary"
          />
        </View>
      ) : null}

      <Button
        label="Excluir fonte"
        onPress={() => excluir.mutate(fonte.id)}
        loading={excluir.isPending}
        variant="ghost"
      />
    </Card>
  );
}

function NovaFonte() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoFonteRenda>('pj_hora');
  const [valor, setValor] = useState(0);
  const [aliquota, setAliquota] = useState(0);
  const [diaPagamento, setDiaPagamento] = useState('');
  const [erro, setErro] = useState<string | undefined>();
  const criar = useCriarFonte();

  const perfil = PERFIL_POR_TIPO[tipo];

  function salvar() {
    if (!nome.trim()) {
      setErro('Dê um nome para reconhecer esta fonte.');
      return;
    }
    setErro(undefined);
    const dia = Number.parseInt(diaPagamento, 10);
    criar.mutate(
      {
        nome: nome.trim(),
        tipo,
        valorTipicoInformado: valor > 0 ? valor : null,
        variavel: perfil.variavel,
        ativo: true,
        // Zero vira ausência: campo não preenchido sobrevive como ausente, e é o
        // que faz o fallback do perfil valer (ADR 0021).
        impostoBps: perfil.mostraAliquota && aliquota > 0 ? aliquota : null,
        diaPagamento:
          perfil.mostraDiaPagamento && Number.isFinite(dia) && dia >= 1 && dia <= 31 ? dia : null,
      },
      {
        onSuccess: () => {
          setNome('');
          setValor(0);
          setAliquota(0);
          setDiaPagamento('');
        },
      },
    );
  }

  return (
    <Card>
      <Text style={styles.tituloSecao}>Adicionar fonte</Text>

      <ErroDeMutacao error={criar.error} fallback={'Não deu para salvar. Tente de novo.'} />

      <View style={styles.form}>
        <FormField
          label="Nome"
          value={nome}
          onChangeText={setNome}
          error={erro}
          placeholder="Contrato PJ"
        />
        <OptionGroup label="Tipo" options={TIPOS} value={tipo} onChangeValue={setTipo} />

        <Text style={styles.nota}>{perfil.nota}</Text>

        <CurrencyInput
          label={perfil.valorLabel}
          value={valor}
          onChangeValue={setValor}
          optional
          hint={perfil.valorHint}
        />

        {perfil.mostraAliquota ? (
          <PercentInput
            label="Percentual reservado para imposto"
            value={aliquota}
            onChangeValue={setAliquota}
            optional
            hint="Seu contador sabe o número exato. Sem ele, nada é reservado."
          />
        ) : null}

        {perfil.mostraDiaPagamento ? (
          <FormField
            label="Dia do pagamento"
            value={diaPagamento}
            onChangeText={setDiaPagamento}
            keyboardType="number-pad"
            optional
            placeholder="5"
            hint="De 1 a 31. É a data em que o dinheiro cai."
          />
        ) : null}

        {perfil.mostraCompromisso ? (
          <Button
            label="Declarar compromisso percentual"
            onPress={() => router.push('/caixa/metas')}
            variant="secondary"
          />
        ) : null}

        <Button label="Adicionar" onPress={salvar} loading={criar.isPending} />
      </View>

      {perfil.mostraEventos ? <EventosPrevisiveis /> : null}
    </Card>
  );
}

const TIPOS_EVENTO: readonly { value: TipoEventoPrevisivel; label: string }[] = [
  { value: 'decimo_terceiro', label: '13º' },
  { value: 'ferias', label: 'Férias' },
  { value: 'outro', label: 'Outro' },
];

function rotuloDoEvento(tipo: TipoEventoPrevisivel): string {
  return TIPOS_EVENTO.find((t) => t.value === tipo)?.label ?? tipo;
}

/**
 * 13º e férias — declarados pelo usuário, valor e mês. NÃO entram na cascata
 * (ADR 0021, decisão 2): o app reconhece que existem e quando caem, e nada mais.
 */
function EventosPrevisiveis() {
  const { eventos } = useEventosPrevisiveis();
  const [tipo, setTipo] = useState<TipoEventoPrevisivel>('decimo_terceiro');
  const [mes, setMes] = useState('');
  const [valor, setValor] = useState(0);
  const criar = useCriarEventoPrevisivel();
  const excluir = useExcluirEventoPrevisivel();

  function salvar() {
    const mesNum = Number.parseInt(mes, 10);
    if (!Number.isFinite(mesNum) || mesNum < 1 || mesNum > 12) return;
    criar.mutate(
      { tipo, mesPrevisto: mesNum, valor, fonteId: null },
      {
        onSuccess: () => {
          setMes('');
          setValor(0);
        },
      },
    );
  }

  return (
    <View style={styles.eventos}>
      <Text style={styles.tituloSecao}>13º e férias</Text>
      {eventos.map((e: EventoPrevisivel) => (
        <View key={e.id} style={styles.linhaEvento}>
          <View style={styles.eventoInfo}>
            <Text style={styles.nome}>
              {rotuloDoEvento(e.tipo)} · mês {e.mesPrevisto}
            </Text>
            <Text style={styles.meta}>{formatBRL(e.valor)}</Text>
          </View>
          <Button
            label="Remover"
            onPress={() => excluir.mutate(e.id)}
            loading={excluir.isPending}
            variant="ghost"
          />
        </View>
      ))}

      <OptionGroup label="Evento" options={TIPOS_EVENTO} value={tipo} onChangeValue={setTipo} />
      <FormField
        label="Mês previsto"
        value={mes}
        onChangeText={setMes}
        keyboardType="number-pad"
        placeholder="12"
        hint="De 1 a 12."
      />
      <CurrencyInput label="Valor" value={valor} onChangeValue={setValor} />
      <Button
        label="Adicionar evento"
        onPress={salvar}
        loading={criar.isPending}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  cabecalhoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tituloItem: { flexShrink: 1, paddingRight: spacing.md },
  nome: { ...typography.bodyStrong, color: colors.ink },
  meta: { ...typography.caption, color: colors.inkSoft },
  ausente: { ...typography.caption, color: colors.inkSoft, fontStyle: 'italic' },
  detalhe: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.xs },
  semReserva: { ...typography.caption, color: colors.inkSoft, marginTop: spacing.sm },
  recebimento: { gap: spacing.md, marginTop: spacing.md },
  explicacao: { ...typography.caption, color: colors.inkSoft },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink, marginBottom: spacing.md },
  nota: { ...typography.caption, color: colors.inkSoft },
  form: { gap: spacing.lg },
  eventos: { gap: spacing.md, marginTop: spacing.lg },
  linhaEvento: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  eventoInfo: { gap: 2 },
});
