import { describe, expect, it } from 'vitest';
import type { Loan, Payment } from '../types';
import { loanItems } from './loanView';
import { dueReminders, reminderText } from './reminders';

const loan = (id: string, borrower: string, dueDate: string | undefined): Loan => ({
  id,
  borrower,
  principal: 1_000_000_00,
  currency: 'COP',
  interestRate: 0,
  ratePeriod: 'monthly',
  interestType: 'none',
  startDate: '2025-01-01',
  dueDate,
  interestPeriodDays: 30,
  createdAt: 0,
});

const paid: Payment = { id: 'p1', loanId: 'paid', date: '2025-01-02', amount: 1_000_000_00, createdAt: 0 };

const asOf = '2025-03-10';
const items = loanItems(
  [
    loan('far', 'Carlos', '2025-03-20'),
    loan('soon', 'Bea', '2025-03-13'),
    loan('late', 'Ana', '2025-03-05'),
    loan('paid', 'Dora', '2025-03-01'),
    loan('none', 'Eva', undefined),
    loan('today', 'Fer', '2025-03-10'),
  ],
  [paid],
  asOf,
);

describe('dueReminders', () => {
  it('en mora o dentro de la anticipación, sin pagados ni sin vencimiento, los más urgentes primero', () => {
    const r = dueReminders(items, 3);
    expect(r.map((x) => [x.loan.borrower, x.daysToDue])).toEqual([
      ['Ana', -5],
      ['Fer', 0],
      ['Bea', 3],
    ]);
  });

  it('anticipación 0: solo lo que vence hoy y la mora', () => {
    expect(dueReminders(items, 0).map((x) => x.loan.borrower)).toEqual(['Ana', 'Fer']);
  });
});

describe('reminderText', () => {
  const one = (borrower: string) => dueReminders(items, 10).filter((r) => r.loan.borrower === borrower);

  it('null sin recordatorios', () => {
    expect(reminderText([])).toBeNull();
  });

  it('un préstamo: nombre, plazo y saldo', () => {
    expect(reminderText(one('Ana'))).toEqual({
      title: 'Préstamo de Ana',
      body: expect.stringMatching(/^Lleva 5 días en mora\. Saldo: \$\s?1\.000\.000\.$/),
    });
    expect(reminderText(one('Fer'))?.body).toMatch(/^Vence hoy\./);
    expect(reminderText(one('Carlos'))?.body).toMatch(/^Vence en 10 días\./);
  });

  it('varios préstamos: resumen con cuántos en mora y una línea por préstamo', () => {
    expect(reminderText(dueReminders(items, 3))).toEqual({
      title: '3 préstamos por cobrar (1 en mora)',
      body: 'Ana: lleva 5 días en mora\nFer: vence hoy\nBea: vence en 3 días',
    });
    expect(reminderText(dueReminders(items, 10).slice(1))?.title).toBe('3 préstamos por vencer');
  });

  it('discreto: sin nombres ni montos', () => {
    expect(reminderText(one('Ana'), true)).toEqual({ title: 'Préstamos', body: '1 préstamo por cobrar (1 en mora).' });
    expect(reminderText(dueReminders(items, 10).slice(1), true)?.body).toBe('3 préstamos por vencer.');
  });
});
