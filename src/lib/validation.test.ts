import { describe, expect, it } from 'vitest';
import { isISODate, loanDatesError, paymentDateError } from './validation';

describe('isISODate', () => {
  it('acepta YYYY-MM-DD y rechaza vacío o mal formado', () => {
    expect(isISODate('2026-10-05')).toBe(true);
    expect(isISODate('')).toBe(false);
    expect(isISODate('2026-13-45')).toBe(false);
    expect(isISODate('05/10/2026')).toBe(false);
  });
});

describe('paymentDateError', () => {
  const start = '2026-01-01';
  const today = '2026-10-05';

  it('acepta fechas entre el préstamo y hoy, inclusive', () => {
    expect(paymentDateError(start, start, today)).toBeNull();
    expect(paymentDateError(today, start, today)).toBeNull();
  });

  it('rechaza fecha vacía', () => {
    expect(paymentDateError('', start, today)).not.toBeNull();
  });

  it('rechaza fechas anteriores al préstamo', () => {
    expect(paymentDateError('2025-12-31', start, today)).toMatch(/anterior/);
  });

  it('rechaza fechas futuras (computeLoanState las ignoraría)', () => {
    expect(paymentDateError('2026-10-06', start, today)).toMatch(/futura/);
  });
});

describe('loanDatesError', () => {
  it('exige la fecha del préstamo', () => {
    expect(loanDatesError('', '', null)).toMatch(/fecha del préstamo/);
  });

  it('el vencimiento es opcional pero no puede ser anterior al préstamo', () => {
    expect(loanDatesError('2026-01-01', '', null)).toBeNull();
    expect(loanDatesError('2026-01-01', '2026-01-01', null)).toBeNull();
    expect(loanDatesError('2026-01-01', '2025-12-31', null)).toMatch(/vencimiento/);
  });

  it('no permite mover el inicio después del primer pago', () => {
    expect(loanDatesError('2026-02-01', '', '2026-02-01')).toBeNull();
    expect(loanDatesError('2026-02-02', '', '2026-02-01')).toMatch(/primer pago/);
  });
});
