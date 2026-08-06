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

/**
 * Reagenda TUDO: cancela o que estava agendado e agenda de novo.
 *
 * Sem cancelar antes, uma parcela paga continuaria avisando — o agendamento
 * vive no aparelho e não sabe que o servidor mudou de ideia.
 *
 * Devolve quantos lembretes ficaram agendados; quem chama decide o que fazer
 * com o número.
 */
export async function reagendar(lembretes: readonly Lembrete[], hora: string): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();

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
        data: { dividaId: lembrete.dividaId, parcelaId: lembrete.parcelaId },
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
