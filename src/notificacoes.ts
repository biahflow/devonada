import * as Notifications from 'expo-notifications';
import type { Lembrete } from './api/types';
import { isoParaDate } from './util/date';

/**
 * Lembretes locais de vencimento.
 *
 * SÓ NOTIFICAÇÃO LOCAL. Nada de push remoto — não há servidor de push, e o
 * Expo Go não suporta push desde o SDK 53. Agendamento local funciona.
 *
 * A divisão com o backend: ele decide O QUE avisar e EM QUE DIA, e manda o
 * texto pronto; o aparelho compõe a HORA local. O servidor não sabe o fuso do
 * dispositivo, então um instante calculado lá tocaria na hora errada.
 */

/** Faixa em que um lembrete pode tocar. Nada dispara de madrugada. */
export const HORA_MINIMA = 7;
export const HORA_MAXIMA = 22;

export function horaValida(hhmm: string): boolean {
  const [h] = hhmm.split(':').map(Number);
  return h !== undefined && h >= HORA_MINIMA && h <= HORA_MAXIMA;
}

/**
 * Pede permissão NO CONTEXTO — chamada ao ativar o lembrete, nunca no boot.
 * Pedir antes de existir motivo é o caminho mais curto para o usuário negar.
 */
export async function pedirPermissao(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;

  const pedida = await Notifications.requestPermissionsAsync();
  return pedida.granted;
}

export async function permissaoConcedida(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Compõe o instante LOCAL a partir da data do backend e da hora preferida. */
export function instanteDoLembrete(dataLembrete: string, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  const quando = isoParaDate(dataLembrete);
  quando.setHours(h ?? 9, m ?? 0, 0, 0);
  return quando;
}

/** Marca o que cada agendamento é, para um não cancelar o outro. */
const TIPO_PARCELA = 'parcela';
const TIPO_FECHAMENTO = 'fechamento';

/**
 * Cancela só os agendamentos de um tipo.
 *
 * Existe porque `cancelAllScheduledNotificationsAsync` é global: reagendar as
 * parcelas apagaria o lembrete mensal de fechamento sem nenhum sinal, e o
 * usuário só descobriria pela notificação que nunca chegou.
 */
async function cancelarPorTipo(tipo: string): Promise<void> {
  const agendadas = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of agendadas) {
    const data = n.content.data as { tipo?: string } | undefined;
    if (data?.tipo === tipo) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

/**
 * Reagenda os lembretes de parcela: cancela os que estavam e agenda de novo.
 *
 * Sem cancelar antes, uma parcela paga continuaria avisando — o agendamento
 * vive no aparelho e não sabe que o servidor mudou de ideia.
 *
 * Devolve quantos lembretes ficaram agendados; quem chama decide o que fazer
 * com o número.
 */
export async function reagendar(lembretes: readonly Lembrete[], hora: string): Promise<number> {
  await cancelarPorTipo(TIPO_PARCELA);

  if (!(await permissaoConcedida())) return 0;

  const agora = Date.now();
  let agendados = 0;

  for (const lembrete of lembretes) {
    const quando = instanteDoLembrete(lembrete.dataLembrete, hora);
    // Instante no passado não pode ser agendado — dispararia na hora.
    if (quando.getTime() <= agora) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: lembrete.titulo,
        body: lembrete.corpo,
        data: {
          tipo: TIPO_PARCELA,
          dividaId: lembrete.dividaId,
          parcelaId: lembrete.parcelaId,
        },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quando },
    });
    agendados += 1;
  }

  return agendados;
}

export async function cancelarTodos(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * O próximo dia `dia` do mês, no futuro. Se o dia já passou neste mês, vai para
 * o mês que vem.
 */
export function proximoFechamento(dia: number, hora: string, agora = new Date()): Date {
  const [h, m] = hora.split(':').map(Number);
  const quando = new Date(agora.getFullYear(), agora.getMonth(), dia, h ?? 9, m ?? 0, 0, 0);
  if (quando.getTime() <= agora.getTime()) {
    quando.setMonth(quando.getMonth() + 1);
  }
  return quando;
}

/**
 * Lembrete mensal de fechamento do mês (M7.1).
 *
 * AGENDA UMA OCORRÊNCIA POR VEZ, e não um gatilho mensal repetido, porque
 * gatilho de calendário com repetição mensal não tem suporte igual nas duas
 * plataformas. O reagendamento acontece a cada abertura do app — mesma
 * estratégia de `reagendar`, que também refaz tudo do zero a cada montagem.
 *
 * `dia` vem do perfil e é limitado a 28 no contrato: 29, 30 e 31 não existem em
 * todo mês, e um lembrete que some em fevereiro é pior que um lembrete um dia
 * antes.
 *
 * `dia` nulo é o lembrete desligado — cancela e não agenda.
 */
export async function agendarFechamento(dia: number | undefined, hora: string): Promise<boolean> {
  await cancelarPorTipo(TIPO_FECHAMENTO);

  if (dia === undefined || !horaValida(hora)) return false;
  if (!(await permissaoConcedida())) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Hora de fechar o mês',
      body: 'Confirme o que entrou e o que variou. Leva menos de um minuto.',
      data: { tipo: TIPO_FECHAMENTO },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: proximoFechamento(dia, hora),
    },
  });
  return true;
}
