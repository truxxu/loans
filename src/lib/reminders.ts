import type { Loan } from '../types';
import { plural, type LoanItem } from './loanView';
import { formatMoney } from './money';

/**
 * Recordatorios de vencimiento. Funciones puras: qué préstamos avisar y con qué texto.
 * Mostrar la notificación (y cuándo) es cosa de `hooks/useReminders.ts`.
 */

export interface Reminder {
  loan: Loan;
  balance: number;
  /** Positivo = días que faltan; 0 = vence hoy; negativo = días en mora. */
  daysToDue: number;
}

/** Préstamos sin pagar que están en mora o vencen dentro de `leadDays` días; los más urgentes primero. */
export function dueReminders(items: LoanItem[], leadDays: number): Reminder[] {
  return items
    .filter(({ state }) => state.status !== 'paid' && state.daysToDue !== null && state.daysToDue <= leadDays)
    .map(({ loan, state }) => ({ loan, balance: state.balance, daysToDue: state.daysToDue! }))
    .sort((a, b) => a.daysToDue - b.daysToDue);
}

function when(daysToDue: number): string {
  if (daysToDue < -1) return `lleva ${-daysToDue} días en mora`;
  if (daysToDue === -1) return 'lleva 1 día en mora';
  if (daysToDue === 0) return 'vence hoy';
  if (daysToDue === 1) return 'vence mañana';
  return `vence en ${daysToDue} días`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Título y cuerpo de una sola notificación que resume todos los recordatorios; null si no hay.
 * `discreet` (`discreetNotifications`): sin nombres ni montos, que la notificación
 * se ve en la pantalla de bloqueo del teléfono.
 */
export function reminderText(reminders: Reminder[], discreet = false): { title: string; body: string } | null {
  const [first] = reminders;
  if (!first) return null;
  if (discreet) {
    const overdue = reminders.filter((r) => r.daysToDue < 0).length;
    const count = plural(reminders.length, 'préstamo', 'préstamos');
    return {
      title: 'Préstamos',
      body: overdue > 0 ? `${count} por cobrar (${overdue} en mora).` : `${count} por vencer.`,
    };
  }
  if (reminders.length === 1) {
    return {
      title: `Préstamo de ${first.loan.borrower}`,
      body: `${capitalize(when(first.daysToDue))}. Saldo: ${formatMoney(first.balance, first.loan.currency)}.`,
    };
  }
  const overdue = reminders.filter((r) => r.daysToDue < 0).length;
  return {
    title: overdue > 0 ? `${reminders.length} préstamos por cobrar (${overdue} en mora)` : `${reminders.length} préstamos por vencer`,
    body: reminders.map((r) => `${r.loan.borrower}: ${when(r.daysToDue)}`).join('\n'),
  };
}
