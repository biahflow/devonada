import { HORA_MAXIMA, HORA_MINIMA, horaValida, instanteDoLembrete } from './notificacoes';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

describe('horaValida', () => {
  it('aceita horário comercial', () => {
    expect(horaValida('09:00')).toBe(true);
    expect(horaValida('20:30')).toBe(true);
  });

  it('recusa madrugada — nada deve tocar às 3 da manhã', () => {
    expect(horaValida('03:00')).toBe(false);
    expect(horaValida('05:59')).toBe(false);
  });

  it('recusa tarde da noite', () => {
    expect(horaValida('23:00')).toBe(false);
  });

  it('aceita exatamente os limites', () => {
    expect(horaValida(`${HORA_MINIMA}:00`.padStart(5, '0'))).toBe(true);
    expect(horaValida(`${HORA_MAXIMA}:00`)).toBe(true);
  });
});

describe('instanteDoLembrete', () => {
  it('compõe data do backend com a hora local escolhida', () => {
    const quando = instanteDoLembrete('2026-09-10', '14:30');
    expect(quando.getFullYear()).toBe(2026);
    expect(quando.getMonth()).toBe(8); // setembro
    expect(quando.getDate()).toBe(10);
    expect(quando.getHours()).toBe(14);
    expect(quando.getMinutes()).toBe(30);
  });

  it('usa componentes LOCAIS, não UTC', () => {
    // Se usasse toISOString/UTC, o dia poderia deslizar conforme o fuso.
    const quando = instanteDoLembrete('2026-01-01', '08:00');
    expect(quando.getDate()).toBe(1);
    expect(quando.getMonth()).toBe(0);
  });

  it('zera segundos e milissegundos', () => {
    const quando = instanteDoLembrete('2026-09-10', '09:00');
    expect(quando.getSeconds()).toBe(0);
    expect(quando.getMilliseconds()).toBe(0);
  });
});
