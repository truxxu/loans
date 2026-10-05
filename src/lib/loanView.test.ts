import { describe, expect, it } from 'vitest';
import type { Loan, Payment } from '../types';
import { computeLoanState } from './interest';
import {
  groupByBorrower,
  initials,
  listTotals,
  loanDetail,
  paidPct,
  pct,
  plural,
  sortLoans,
  subtitle,
  worstStatus,
  type LoanItem,
} from './loanView';

// 1.000.000 COP al 2% mensual simple, vence a los 60 días.
const loan = (over: Partial<Loan> = {}): Loan => ({
  id: 'l1',
  borrower: 'Ana Pérez',
  principal: 1_000_000_00,
  currency: 'COP',
  interestRate: 2,
  ratePeriod: 'monthly',
  interestType: 'simple',
  startDate: '2025-01-01',
  dueDate: '2025-03-02',
  interestPeriodDays: 30,
  createdAt: 0,
  ...over,
});

let seq = 0;
const pay = (loanId: string, date: string, amount: number): Payment => ({
  id: `p${++seq}`,
  loanId,
  date,
  amount,
  createdAt: seq,
});

const item = (l: Loan, payments: Payment[], asOf: string): LoanItem => ({
  loan: l,
  state: computeLoanState(l, payments, asOf),
});

describe('helpers de texto', () => {
  it('initials toma las dos primeras palabras', () => {
    expect(initials('Luz Marina Pérez')).toBe('LM');
    expect(initials('  ana  ')).toBe('A');
    expect(initials('')).toBe('');
  });

  it('plural', () => {
    expect(plural(1, 'pago', 'pagos')).toBe('1 pago');
    expect(plural(0, 'pago', 'pagos')).toBe('0 pagos');
  });

  it('pct se acota a 0–100', () => {
    expect(pct(42.4)).toBe('42%');
    expect(pct(-5)).toBe('0%');
    expect(pct(130)).toBe('100%');
  });
});

describe('paidPct', () => {
  it('mide el capital devuelto, no el interés', () => {
    const l = loan();
    // 31 días: 20.666,67 de interés; el pago de 270.666,67 deja 750.000 de capital.
    const it1 = item(l, [pay('l1', '2025-02-01', 270_666_67)], '2025-02-01');
    expect(it1.state.principalOutstanding).toBe(750_000_00);
    expect(paidPct(it1)).toBe('25%');
  });
});

describe('subtitle', () => {
  it('con vencimiento muestra el vencimiento', () => {
    expect(subtitle(loan(), 'active', '2025-01-10')).toMatch(/^Vence el /);
  });

  it('sin vencimiento muestra la próxima fecha de intereses', () => {
    expect(subtitle(loan({ dueDate: undefined }), 'active', '2025-01-10')).toMatch(/^Intereses el /);
    expect(subtitle(loan({ dueDate: undefined }), 'paid', '2025-01-10')).toBe('Sin fecha de vencimiento');
    expect(subtitle(loan({ dueDate: undefined, interestType: 'none' }), 'active', '2025-01-10')).toBe(
      'Sin fecha de vencimiento',
    );
  });
});

describe('sortLoans', () => {
  it('ordena por vencimiento, sin vencimiento al final, luego por fecha del préstamo', () => {
    const a = { loan: loan({ id: 'a', dueDate: undefined, startDate: '2025-01-01' }) };
    const b = { loan: loan({ id: 'b', dueDate: '2025-06-01' }) };
    const c = { loan: loan({ id: 'c', dueDate: '2025-03-01' }) };
    const d = { loan: loan({ id: 'd', dueDate: undefined, startDate: '2024-01-01' }) };
    expect(sortLoans([a, b, c, d]).map((x) => x.loan.id)).toEqual(['c', 'b', 'd', 'a']);
  });
});

describe('worstStatus', () => {
  it('mora > al día > pagado', () => {
    expect(worstStatus(['paid', 'active', 'overdue'])).toBe('overdue');
    expect(worstStatus(['paid', 'active'])).toBe('active');
    expect(worstStatus(['paid'])).toBe('paid');
  });
});

describe('listTotals', () => {
  it('suma saldos abiertos, en mora e intereses pendientes', () => {
    const asOf = '2025-03-12';
    const overdue = item(loan({ id: 'o' }), [], asOf); // 70 días: 46.666,67 de interés
    const active = item(loan({ id: 'a', dueDate: undefined, interestType: 'none' }), [], asOf);
    const paid = item(loan({ id: 'p' }), [pay('p', '2025-01-01', 1_000_000_00)], asOf);
    expect(overdue.state.status).toBe('overdue');
    expect(paid.state.status).toBe('paid');

    const t = listTotals([overdue, active, paid]);
    expect(t.outstanding).toBe(1_046_666_67 + 1_000_000_00);
    expect(t.overdue).toBe(1_046_666_67);
    expect(t.overdueCount).toBe(1);
    expect(t.interest).toBe(46_666_67);
    expect(t.openCount).toBe(2);
  });
});

describe('groupByBorrower', () => {
  it('agrupa por nombre (sin espacios sobrantes), suma saldos y toma el peor estado', () => {
    const asOf = '2025-03-12';
    const people = groupByBorrower([
      item(loan({ id: 'x', borrower: 'Óscar' }), [], asOf),
      item(loan({ id: 'y', borrower: 'Ana Pérez', dueDate: undefined, interestType: 'none' }), [], asOf),
      item(loan({ id: 'z', borrower: ' Ana Pérez ' }), [], asOf),
    ]);
    expect(people.map((p) => p.name)).toEqual(['Ana Pérez', 'Óscar']);
    expect(people[0]!.items).toHaveLength(2);
    expect(people[0]!.balance).toBe(1_000_000_00 + 1_046_666_67);
    expect(people[0]!.status).toBe('overdue');
  });
});

describe('loanDetail', () => {
  it('antes del vencimiento: días que faltan, próximo pago de intereses y aviso de atraso', () => {
    const v = loanDetail(loan(), [], '2025-02-01');
    expect(v.conditions).toBe('Interés simple, 2% mensual');
    expect(v.dueText).toMatch(/\(faltan 29 días\)$/);
    expect(v.nextInterest).toEqual({ date: '2025-03-02', amount: 40_000_00 });
    // 31 días sin pagar intereses > periodo de 30.
    expect(v.interestLate).toBe(true);
    expect(v.projected).toBe(1_040_000_00);
  });

  it('dentro del primer periodo no hay atraso de intereses', () => {
    expect(loanDetail(loan(), [], '2025-01-20').interestLate).toBe(false);
  });

  it('en mora muestra los días de mora', () => {
    expect(loanDetail(loan(), [], '2025-03-12').dueText).toMatch(/\(10 días en mora\)$/);
  });

  it('pagado: sin sufijo de días ni próximo pago', () => {
    const v = loanDetail(loan(), [pay('l1', '2025-01-01', 1_000_000_00)], '2025-03-12');
    expect(v.state.status).toBe('paid');
    expect(v.dueText).not.toMatch(/\(/);
    expect(v.nextInterest).toBeNull();
  });

  it('sin interés', () => {
    const v = loanDetail(loan({ interestType: 'none', dueDate: undefined }), [], '2025-02-01');
    expect(v.conditions).toBe('Sin interés');
    expect(v.dueText).toBe('Sin fecha de vencimiento');
    expect(v.nextInterest).toBeNull();
    expect(v.projected).toBeNull();
  });
});
