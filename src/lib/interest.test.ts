import { describe, expect, it } from 'vitest';
import type { Loan, Payment } from '../types';
import { computeLoanState, daysBetween, projectedTotalAtDue } from './interest';

const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'l1',
  borrower: 'Ana',
  principal: 1_000_000_00,
  currency: 'COP',
  interestRate: 10,
  ratePeriod: 'annual',
  interestType: 'simple',
  startDate: '2025-01-01',
  dueDate: '2026-01-01',
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
});

describe('computeLoanState', () => {
  it('sin interés: el saldo es el capital menos los pagos', () => {
    const s = computeLoanState(loan({ interestType: 'none' }), [pay('2025-06-01', 400_000_00)], '2025-12-01');
    expect(s.balance).toBe(600_000_00);
    expect(s.interestOutstanding).toBe(0);
    expect(s.status).toBe('active');
  });

  it('interés simple anual: 10% en 365 días', () => {
    const s = computeLoanState(loan(), [], '2026-01-01');
    expect(s.interestOutstanding).toBe(100_000_00);
    expect(s.balance).toBe(1_100_000_00);
    expect(projectedTotalAtDue(loan())).toBe(1_100_000_00);
  });

  it('interés compuesto mensual: 2% durante 12 meses', () => {
    const l = loan({ interestType: 'compound', ratePeriod: 'monthly', interestRate: 2 });
    const s = computeLoanState(l, [], '2026-01-01');
    expect(s.balance).toBe(Math.round(1_000_000_00 * Math.pow(1.02, 12)));
  });

  it('un pago cubre primero interés y luego capital', () => {
    const s = computeLoanState(loan(), [pay('2026-01-01', 300_000_00)], '2026-01-01');
    const [entry] = s.ledger;
    expect(entry?.toInterest).toBe(100_000_00);
    expect(entry?.toPrincipal).toBe(200_000_00);
    expect(s.principalOutstanding).toBe(800_000_00);
    expect(s.balance).toBe(800_000_00);
  });

  it('un abono a capital reduce el interés futuro (simple)', () => {
    const half = '2025-07-02'; // día 182
    const s = computeLoanState(loan(), [pay(half, 500_000_00)], '2026-01-01');
    const withoutPayment = computeLoanState(loan(), [], '2026-01-01');
    expect(s.balance).toBeLessThan(withoutPayment.balance - 500_000_00);
  });

  it('marca pagado y registra excedente', () => {
    const s = computeLoanState(loan({ interestType: 'none' }), [pay('2025-02-01', 1_000_500_00)], '2025-03-01');
    expect(s.status).toBe('paid');
    expect(s.balance).toBe(0);
    expect(s.ledger[0]?.overpaid).toBe(500_00);
  });

  it('marca mora después del vencimiento y sigue causando interés', () => {
    const s = computeLoanState(loan(), [], '2026-02-01');
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
});
