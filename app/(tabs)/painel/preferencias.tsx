import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/ui/Screen';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Button } from '../../../src/components/ui/Button';
import { FormField } from '../../../src/components/ui/FormField';
import { OptionGroup, type Option } from '../../../src/components/ui/OptionGroup';
import { LoadingState } from '../../../src/components/ui/LoadingState';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { ErroDeMutacao } from '../../../src/components/ui/ErroDeMutacao';
import { useAtualizarPerfil, usePerfil } from '../../../src/hooks/usePainel';
import { useSair } from '../../../src/hooks/useConta';
import { HORA_MAXIMA, HORA_MINIMA, horaValida, pedirPermissao } from '../../../src/notificacoes';
import type { PerfilFinanceiro } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme/theme';

/**
 * Só até 28: 29, 30 e 31 não existem em todo mês, e um lembrete que some em
 * fevereiro é pior que um lembrete um dia antes. O contrato impõe o mesmo teto.
 */
const DIAS_DE_FECHAMENTO: readonly Option<string>[] = [
  { value: 'off', label: 'Não avisar' },
  { value: '1', label: 'Dia 1', description: 'Logo no começo do mês seguinte.' },
  { value: '5', label: 'Dia 5', description: 'Depois que os recebimentos costumam cair.' },
  { value: '28', label: 'Dia 28', description: 'Antes de o mês virar.' },
];

/**
 * Dependentes e lembretes. RENDA NÃO ENTRA AQUI.
 *
 * Ela mora em `fonte_renda` desde o M7, e a tela que a edita é a do Caixa. Este
 * formulário coletava renda também, e o resultado era o produto com duas portas
 * para o mesmo dado: quem preenchia o Caixa via o painel vazio, e quem
 * preenchia aqui não aparecia no Caixa. Pior, salvar EXIGIA renda — quem só
 * queria mudar o horário do lembrete tinha de redigitá-la.
 */
export default function Preferencias() {
  const router = useRouter();
  const { perfil, isPending, error, refetch } = usePerfil();

  if (isPending) {
    return (
      <Screen>
        <PageHeader eyebrow="Seu contexto" title="Preferências" onBack={() => router.back()} />
        <LoadingState label="Carregando seu perfil" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <PageHeader eyebrow="Seu contexto" title="Preferências" onBack={() => router.back()} />
        <ErrorState error={error} onRetry={refetch} />
      </Screen>
    );
  }

  return <Formulario inicial={perfil ?? {}} onPronto={() => router.back()} />;
}

function Formulario({ inicial, onPronto }: { inicial: PerfilFinanceiro; onPronto: () => void }) {
  const router = useRouter();
  const encerrar = useSair();
  const [dependentes, setDependentes] = useState(String(inicial.dependentes ?? 0));
  const [hora, setHora] = useState(inicial.horaLembrete ?? '09:00');
  const [antecedencia, setAntecedencia] = useState(String(inicial.diasAntecedenciaLembrete ?? 3));
  const [diaFechamento, setDiaFechamento] = useState(
    inicial.fechamentoDiaDoMes ? String(inicial.fechamentoDiaDoMes) : 'off',
  );
  const [erroHora, setErroHora] = useState<string | undefined>();
  const atualizar = useAtualizarPerfil();

  async function salvar() {
    // Permissão pedida NO CONTEXTO: só quando a pessoa liga o lembrete, nunca
    // no boot. Negar não impede o salvamento — a preferência fica gravada e o
    // agendamento volta a valer se ela permitir depois.
    if (diaFechamento !== 'off') await pedirPermissao();

    // Faixa limitada de propósito: nada deve tocar de madrugada.
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora) || !horaValida(hora)) {
      setErroHora(`Escolha um horário entre ${HORA_MINIMA}:00 e ${HORA_MAXIMA}:00.`);
      return;
    }
    setErroHora(undefined);

    // `rendaMensal` fica FORA do corpo de propósito: o backend trata ausente
    // como "não mexe na renda". Mandar zero apagaria a fonte de quem só veio
    // configurar o lembrete.
    atualizar.mutate(
      {
        dependentes: Number.parseInt(dependentes, 10) || 0,
        horaLembrete: hora,
        diasAntecedenciaLembrete: Number.parseInt(antecedencia, 10) || 0,
        fechamentoDiaDoMes: diaFechamento === 'off' ? null : Number(diaFechamento),
      },
      { onSuccess: onPronto },
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
          eyebrow="Seu contexto"
          title="Preferências"
          description="Quem depende de você e quando os avisos aparecem. Sua renda fica na aba Caixa."
          onBack={() => router.back()}
        />

        <ErroDeMutacao error={atualizar.error} fallback={'Não deu para salvar. Tente de novo.'} />

        <View style={styles.form}>
          <FormField
            label="Pessoas que dependem de você"
            value={dependentes}
            onChangeText={setDependentes}
            keyboardType="number-pad"
            optional
            hint="Entra no cálculo do mínimo existencial."
          />

          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Lembretes de vencimento</Text>
            <Text style={styles.explicacao}>
              O aviso aparece no seu aparelho, no horário que você escolher. Nada dispara de
              madrugada.
            </Text>
          </View>

          <FormField
            label="Horário do aviso"
            value={hora}
            onChangeText={setHora}
            error={erroHora}
            placeholder="09:00"
            keyboardType="numbers-and-punctuation"
            hint={`Entre ${HORA_MINIMA}:00 e ${HORA_MAXIMA}:00.`}
          />

          <FormField
            label="Avisar com quantos dias de antecedência"
            value={antecedencia}
            onChangeText={setAntecedencia}
            keyboardType="number-pad"
            placeholder="3"
          />

          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Lembrete de fechamento do mês</Text>
            <Text style={styles.explicacao}>
              Um aviso por mês para conferir o que entrou e o que variou. Opcional — sem ele o
              caixa continua funcionando, só envelhece sem avisar.
            </Text>
          </View>

          <OptionGroup
            label="Quando avisar"
            value={diaFechamento}
            onChangeValue={setDiaFechamento}
            options={DIAS_DE_FECHAMENTO}
          />

          <Button label="Salvar" onPress={salvar} loading={atualizar.isPending} />

          <View style={styles.secao}>
            <Text style={styles.tituloSecao}>Sua conta</Text>
          </View>

          {/* Antes de "Sair" e de "Excluir": é a ação que a pessoa vem procurar
              aqui com mais frequência, e enterrá-la abaixo das duas destrutivas
              faria a loja considerar a assinatura escondida. */}
          <Button
            label="Assinatura"
            onPress={() => router.push('/painel/assinatura')}
            variant="secondary"
          />
          <Button
            label="Sair"
            onPress={() => encerrar.mutate(undefined, { onSuccess: () => router.replace('/login') })}
            loading={encerrar.isPending}
            variant="secondary"
          />
          <Button
            label="Excluir minha conta"
            onPress={() => router.push('/painel/excluir-conta')}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  conteudo: { paddingBottom: spacing.xxxl, gap: spacing.lg },
  explicacao: { ...typography.caption, color: colors.inkSoft },
  secao: { gap: spacing.xs, marginTop: spacing.md },
  tituloSecao: { ...typography.bodyStrong, color: colors.ink },
  form: { gap: spacing.lg },
});
