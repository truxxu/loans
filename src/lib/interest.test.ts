import { describe, expect, it } from 'vitest';
import type { Loan, Payment } from '../types';
import { addDays, computeLoanState, daysBetween, nextInterestDate, projectedTotalAtDue } from './interest';

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'l1',
  borrower: 'Ana',
  principal: 1_000_000_00,
  currency: 'COP',
  interestRate: 10,
  ratePeriod: 'annual',
  interestType: 'simple',
  startDate: '2025-01-01',
  dueDate: '2025-12-27', // 360 días después del inicio
  interestPeriodDays: 30,
  createdAt: 0,
  ...over,
});

let seq = 0;
const pay = (date: string, amount: number): Payment => ({
  id: `p${++seq}`,
  loanId: 'l1',
  date,
  amount,
  createdAt: seq,
});

describe('daysBetween', () => {
  it('cuenta días de calendario', () => {
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
    expect(daysBetween('2025-03-01', '2025-02-28')).toBe(-1);
  });

  it('addDays es el inverso de daysBetween', () => {
    expect(addDays('2025-01-01', 360)).toBe('2025-12-27');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(daysBetween('2025-01-01', addDays('2025-01-01', 1000))).toBe(1000);
  });
});

describe('computeLoanState', () => {
  it('sin interés: el saldo es el capital menos los pagos', () => {
    const s = computeLoanState(loan({ interestType: 'none' }), [pay('2025-06-01', 400_000_00)], '2025-12-01');
    expect(s.balance).toBe(600_000_00);
    expect(s.interestOutstanding).toBe(0);
    expect(s.status).toBe('active');
  });

  it('interés simple anual: 10% en 360 días', () => {
    const s = computeLoanState(loan(), [], '2025-12-27');
    expect(s.interestOutstanding).toBe(100_000_00);
    expect(s.balance).toBe(1_100_000_00);
    expect(projectedTotalAtDue(loan())).toBe(1_100_000_00);
  });

  it('interés simple mensual: 35 días cobran 35/30 de la tasa', () => {
    const l = loan({ ratePeriod: 'monthly', interestRate: 2 });
    const s = computeLoanState(l, [], addDays(l.startDate, 35));
    expect(s.interestOutstanding).toBe(Math.round(1_000_000_00 * 0.02 * (35 / 30)));
  });

  it('interés compuesto mensual: 2% durante 12 meses de 30 días', () => {
    const l = loan({ interestType: 'compound', ratePeriod: 'monthly', interestRate: 2 });
    const s = computeLoanState(l, [], '2025-12-27');
    expect(s.balance).toBe(Math.round(1_000_000_00 * Math.pow(1.02, 12)));
  });

  it('un pago cubre primero interés y luego capital', () => {
    const s = computeLoanState(loan(), [pay('2025-12-27', 300_000_00)], '2025-12-27');
    const [entry] = s.ledger;
    expect(entry?.toInterest).toBe(100_000_00);
    expect(entry?.toPrincipal).toBe(200_000_00);
    expect(s.principalOutstanding).toBe(800_000_00);
    expect(s.balance).toBe(800_000_00);
  });

  it('un abono a capital reduce el interés futuro (simple)', () => {
    const half = '2025-07-02'; // día 182
    const s = computeLoanState(loan(), [pay(half, 500_000_00)], '2025-12-27');
    const withoutPayment = computeLoanState(loan(), [], '2025-12-27');
    expect(s.balance).toBeLessThan(withoutPayment.balance - 500_000_00);
  });

  it('marca pagado y registra excedente', () => {
    const s = computeLoanState(loan({ interestType: 'none' }), [pay('2025-02-01', 1_000_500_00)], '2025-03-01');
    expect(s.status).toBe('paid');
    expect(s.balance).toBe(0);
    expect(s.ledger[0]?.overpaid).toBe(500_00);
  });

  it('marca mora después del vencimiento y sigue causando interés', () => {
    const s = computeLoanState(loan(), [], '2026-01-27');
    expect(s.status).toBe('overdue');
    expect(s.daysToDue).toBe(-31);
    expect(s.balance).toBeGreaterThan(1_100_000_00);
  });

  it('ignora pagos posteriores a la fecha de corte y de otros préstamos', () => {
    const other = { ...pay('2025-02-01', 1), loanId: 'otro' };
    const s = computeLoanState(loan({ interestType: 'none' }), [pay('2025-12-01', 100_00), other], '2025-06-01');
    expect(s.ledger).toHaveLength(0);
    expect(s.balance).toBe(1_000_000_00);
  });

  it('sin vencimiento nunca queda en mora', () => {
    const l = loan({ dueDate: undefined });
    const s = computeLoanState(l, [], '2030-01-01');
    expect(s.status).toBe('active');
    expect(s.daysToDue).toBeNull();
    expect(projectedTotalAtDue(l)).toBeNull();
  });

  it('interestPendingSince avanza cuando un pago cubre todo el interés', () => {
    const l = loan({ ratePeriod: 'monthly', interestRate: 2 });
    expect(computeLoanState(l, [], '2025-03-01').interestPendingSince).toBe('2025-01-01');
    const interest = computeLoanState(l, [], '2025-01-31').interestOutstanding;
    const covered = computeLoanState(l, [pay('2025-01-31', interest)], '2025-03-01');
    expect(covered.interestPendingSince).toBe('2025-01-31');
    const partial = computeLoanState(l, [pay('2025-01-31', interest - 100)], '2025-03-01');
    expect(partial.interestPendingSince).toBe('2025-01-01');
    expect(computeLoanState(l, [pay('2025-01-31', interest)], '2025-01-31').interestPendingSince).toBeNull();
  });
});

describe('tasa de mora', () => {
  // Vence a los 360 días (2025-12-27); 30 días de mora llegan al 2026-01-26.
  const lateDate = addDays('2025-12-27', 30);

  it('sin tasa de mora, la mora causa a la tasa corriente', () => {
    const s = computeLoanState(loan(), [], lateDate);
    expect(s.interestOutstanding).toBe(Math.round(1_000_000_00 * 0.1 * (390 / 360)));
  });

  it('simple: los días después del vencimiento causan a la tasa de mora', () => {
    const l = loan({ lateInterestRate: 30 });
    expect(computeLoanState(l, [], '2025-12-27').interestOutstanding).toBe(100_000_00);
    const s = computeLoanState(l, [], lateDate);
    expect(s.interestOutstanding).toBe(Math.round(100_000_00 + 1_000_000_00 * 0.3 * (30 / 360)));
    expect(s.status).toBe('overdue');
  });

  it('compuesto: capitaliza a la tasa corriente y luego a la de mora', () => {
    const l = loan({ interestType: 'compound', ratePeriod: 'monthly', interestRate: 2, lateInterestRate: 5 });
    const s = computeLoanState(l, [], lateDate);
    expect(s.balance).toBe(Math.round(1_000_000_00 * Math.pow(1.02, 12) * 1.05));
  });

  it('el tramo se parte en el vencimiento aunque un pago caiga en mora', () => {
    const l = loan({ lateInterestRate: 30 });
    const s = computeLoanState(l, [pay(lateDate, 100_000_00)], lateDate);
    const owed = Math.round(100_000_00 + 1_000_000_00 * 0.3 * (30 / 360));
    expect(s.ledger[0]?.interestDueBefore).toBe(owed);
    expect(s.ledger[0]?.toInterest).toBe(100_000_00);
    expect(s.interestOutstanding).toBe(owed - 100_000_00);
  });

  it('un pago antes del vencimiento no cambia la tasa de los días previos', () => {
    const l = loan({ lateInterestRate: 30 });
    const s = computeLoanState(l, [pay('2025-07-02', 500_000_00)], '2025-12-27');
    const same = computeLoanState(loan(), [pay('2025-07-02', 500_000_00)], '2025-12-27');
    expect(s.balance).toBe(same.balance);
  });

  it('sin interés con tasa de mora: causa interés simple solo en mora', () => {
    const l = loan({ interestType: 'none', interestRate: 0, ratePeriod: 'monthly', lateInterestRate: 3 });
    expect(computeLoanState(l, [], '2025-12-27').balance).toBe(1_000_000_00);
    expect(computeLoanState(l, [], lateDate).interestOutstanding).toBe(30_000_00);
  });

  it('sin vencimiento la tasa de mora no aplica', () => {
    const l = loan({ dueDate: undefined, lateInterestRate: 30 });
    expect(computeLoanState(l, [], lateDate).balance).toBe(computeLoanState(loan({ dueDate: undefined }), [], lateDate).balance);
  });
});

describe('nextInterestDate', () => {
  const l = loan({ dueDate: undefined });

  it('cada 30 días desde el inicio', () => {
    expect(nextInterestDate(l, '2025-01-01')).toBe('2025-01-31');
    expect(nextInterestDate(l, '2025-01-31')).toBe('2025-01-31');
    expect(nextInterestDate(l, '2025-02-01')).toBe('2025-03-02');
  });

  it('respeta un periodo configurado', () => {
    expect(nextInterestDate(loan({ dueDate: undefined, interestPeriodDays: 15 }), '2025-01-20')).toBe('2025-01-31');
  });

  it('se detiene en el vencimiento si llega antes', () => {
    expect(nextInterestDate(loan({ dueDate: '2025-01-20' }), '2025-01-10')).toBe('2025-01-20');
  });

  it('null sin interés', () => {
    expect(nextInterestDate(loan({ interestType: 'none' }), '2025-01-10')).toBeNull();
  });
});
