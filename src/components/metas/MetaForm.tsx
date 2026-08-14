import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { FormField } from '../ui/FormField';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DateField } from '../ui/DateField';
import type { IsoDate, NovaMeta } from '../../api/types';
import { colors, spacing, typography } from '../../theme/theme';

interface Props {
  inicial?: Partial<NovaMeta>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (input: NovaMeta) => void;
  /** Ação destrutiva, quando existe. Fica em ghost, nunca em botão vermelho. */
  onExcluir?: () => void;
  excluindo?: boolean;
}

/**
 * O formulário das duas telas de meta — criar e editar.
 *
 * PRAZO E APORTE SÃO OPCIONAIS, e o campo diz isso. Não é frouxidão de
 * validação: meta sem prazo é meta legítima ("quero trocar de carro, um dia"), e
 * o backend devolve `aporteSugerido: null` e `status: null` para ela em vez de
 * inventar um horizonte. Obrigar a data forçaria a pessoa a chutar um prazo que
 * viraria um aporte sugerido falso.
 *
 * O MÊS VEM DE UM SELETOR DE DATA e é truncado para `AAAA-MM`, que é o que o
 * contrato guarda. Digitar "2027-08" à mão num teclado numérico é onde se erra;
 * o dia escolhido é descartado porque meta não vence num dia, vence num mês.
 */
export function MetaForm({
  inicial = {},
  submitLabel,
  submitting,
  onSubmit,
  onExcluir,
  excluindo,
}: Props) {
  const [nome, setNome] = useState(inicial.nome ?? '');
  const [emoji, setEmoji] = useState(inicial.emoji ?? '');
  const [valorAlvo, setValorAlvo] = useState(inicial.valorAlvo ?? 0);
  const [saldo, setSaldo] = useState(inicial.saldo ?? 0);
  const [dataAlvo, setDataAlvo] = useState(inicial.dataAlvo ?? undefined);
  const [aporteMensal, setAporteMensal] = useState(inicial.aporteMensal ?? 0);
  const [erros, setErros] = useState<{ nome?: string; valorAlvo?: string }>({});

  function submeter() {
    const novos: typeof erros = {};
    if (!nome.trim()) novos.nome = 'Dá um nome pra essa meta.';
    if (valorAlvo <= 0) novos.valorAlvo = 'Quanto você quer juntar?';

    setErros(novos);
    if (Object.keys(novos).length > 0) return;

    onSubmit({
      nome: nome.trim(),
      // String vazia vira ausência: campo em branco não é emoji em branco.
      emoji: emoji.trim() || null,
      valorAlvo,
      saldo,
      dataAlvo: dataAlvo ?? null,
      // Zero vira ausência, como nos potes do caixa: é assim que a pessoa desfaz
      // o aporte, e é o que faz o status desaparecer em vez de virar "atrasada".
      aporteMensal: aporteMensal > 0 ? aporteMensal : null,
    });
  }

  return (
    <>
      <View style={styles.form}>
        <FormField
          label="O que você quer conquistar"
          value={nome}
          onChangeText={setNome}
          error={erros.nome}
          placeholder="Reserva de emergência, viagem em família..."
        />

        <FormField
          label="Um emoji, se quiser"
          value={emoji}
          onChangeText={setEmoji}
          optional
          maxLength={4}
          placeholder="🛟"
          hint="Só para reconhecer a meta de relance na lista."
        />

        <CurrencyInput label="Quanto você quer juntar" value={valorAlvo} onChangeValue={setValorAlvo} error={erros.valorAlvo} />

        <CurrencyInput
          label="Quanto já tem guardado"
          value={saldo}
          onChangeValue={setSaldo}
          optional
        />

        <DateField
          label="Até quando"
          value={dataAlvo ? (`${dataAlvo}-01` as IsoDate) : undefined}
          onChangeValue={(iso) => setDataAlvo(iso.slice(0, 7))}
          optional
          hint="Só o mês conta. Sem prazo, eu não sugiro aporte — e digo isso na tela em vez de chutar."
        />

        <CurrencyInput
          label="Quanto separa por mês"
          value={aporteMensal}
          onChangeValue={setAporteMensal}
          optional
          hint="O que você de fato separa. Se ficar em branco, mostro só o sugerido."
        />
      </View>

      <Card>
        <Text style={styles.explicacao}>
          O aporte sugerido é o que falta dividido pelos meses que faltam — a conta que você faria
          no papel. Ele não projeta rendimento nenhum: quanto seu dinheiro rende, só você sabe.
        </Text>
      </Card>

      <View style={styles.acoes}>
        <Button label={submitLabel} size="lg" onPress={submeter} loading={submitting} />
        {onExcluir ? (
          // Ghost, e a confirmação carrega o peso — neste app não existe botão
          // vermelho, nem para ação destrutiva (ADR 0015).
          <Button label="Excluir meta" variant="ghost" onPress={onExcluir} loading={excluindo} />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  explicacao: { ...typography.caption, color: colors.inkSoft, lineHeight: 19 },
  acoes: { gap: spacing.sm },
});
