import { describe, expect, it } from 'vitest';
import type { Loan } from '../types';
import { emptyLoanForm, loanToForm, parseLoanForm, type LoanForm } from './loanForm';

const form = (over: Partial<LoanForm> = {}): LoanForm => ({
  ...emptyLoanForm('2025-01-01'),
  borrower: ' Ana ',
  principal: '1.000.000',
  interestRate: '2,5',
  ...over,
});
const parse = (f: LoanForm, firstPaymentDate: string | null = null) => parseLoanForm(f, null, firstPaymentDate, () => 'new');
const errorOf = (f: LoanForm) => {
  const r = parse(f);
  return 'error' in r ? r.error : null;
};

describe('parseLoanForm', () => {
  it('arma el préstamo con montos en centavos y textos recortados', () => {
    const r = parse(form({ notes: '  ' }));
    expect(r).toEqual({
      loan: expect.objectContaining({
        id: 'new',
        borrower: 'Ana',
        principal: 1_000_000_00,
        interestRate: 2.5,
        interestPeriodDays: 30,
        dueDate: undefined,
        notes: undefined,
      }),
    });
  });

  it('al editar conserva id y createdAt', () => {
    const r = parseLoanForm(form(), { id: 'l1', createdAt: 7 }, null, () => 'new');
    expect('loan' in r && [r.loan.id, r.loan.createdAt]).toEqual(['l1', 7]);
  });

  it.each<[Partial<LoanForm>, string]>([
    [{ borrower: '  ' }, 'Escribe a quién le prestas.'],
    [{ principal: '0' }, 'El monto debe ser mayor que cero.'],
    [{ interestRate: '' }, 'La tasa debe ser mayor que cero.'],
    [{ interestPeriodDays: '1.5' }, 'El periodo de pago de intereses debe ser un número entero de días.'],
    [{ startDate: '' }, 'Escribe la fecha del préstamo.'],
  ])('%o -> %s', (over, message) => {
    expect(errorOf(form(over))).toBe(message);
  });

  it('valida la fecha contra el primer pago', () => {
    expect(parse(form({ startDate: '2025-02-01' }), '2025-01-15')).toEqual({
      error: 'La fecha del préstamo no puede ser posterior al primer pago registrado.',
    });
  });

  it('sin interés ignora la tasa y conserva el periodo oculto solo si es válido', () => {
    const none = (interestPeriodDays: string) => {
      const r = parse(form({ interestType: 'none', interestRate: 'x', interestPeriodDays }));
      return 'loan' in r ? [r.loan.interestRate, r.loan.interestPeriodDays] : r.error;
    };
    expect(none('15')).toEqual([0, 15]);
    expect(none('abc')).toEqual([0, 30]);
  });
});

describe('loanToForm', () => {
  it('ida y vuelta con parseLoanForm', () => {
    const loan: Loan = {
      id: 'l1',
      borrower: 'Ana',
      principal: 1_500_050,
      currency: 'COP',
      interestRate: 2.5,
      ratePeriod: 'annual',
      interestType: 'compound',
      startDate: '2025-01-01',
      dueDate: '2025-06-01',
      interestPeriodDays: 15,
      notes: 'nota',
      createdAt: 3,
    };
    expect(parseLoanForm(loanToForm(loan), loan, null, () => 'new')).toEqual({ loan });
  });
});
