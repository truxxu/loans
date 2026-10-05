import { describe, expect, it } from 'vitest';
import type { Loan, Payment } from '../types';
import { parseBackup } from './backup';

const loan = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  borrower: 'Ana',
  principal: 1_000_000_00,
  currency: 'COP',
  interestRate: 2,
  ratePeriod: 'monthly',
  interestType: 'simple',
  startDate: '2025-01-01',
  dueDate: '2025-06-01',
  interestPeriodDays: 30,
  createdAt: 1,
  ...over,
});

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  loanId: 'l1',
  date: '2025-02-01',
  amount: 50_000_00,
  createdAt: 2,
  ...over,
});

const backup = (over: Record<string, unknown> = {}) => ({
  version: 3,
  exportedAt: '2025-03-01T00:00:00.000Z',
  loans: [loan()],
  payments: [payment()],
  ...over,
});

const errorOf = (raw: unknown) => {
  const r = parseBackup(raw);
  return 'error' in r ? r.error : null;
};

describe('parseBackup', () => {
  it('acepta un respaldo válido y descarta campos desconocidos', () => {
    const r = parseBackup(backup({ loans: [loan({ extra: 1, lateInterestRate: 3 })] }));
    expect(r).toEqual({
      loans: [expect.objectContaining({ id: 'l1', lateInterestRate: 3 })],
      payments: [expect.objectContaining({ id: 'p1', amount: 50_000_00 })],
    });
    expect('loans' in r && 'extra' in r.loans[0]!).toBe(false);
  });

  it('v1: completa interestPeriodDays', () => {
    const r = parseBackup(backup({ version: 1, loans: [loan({ interestPeriodDays: undefined, dueDate: undefined })] }));
    const l = 'loans' in r ? (r.loans[0] as Loan) : null;
    expect(l?.interestPeriodDays).toBe(30);
    expect(l?.dueDate).toBeUndefined();
  });

  it('v2 sin tasa de mora', () => {
    expect(errorOf(backup({ version: 2 }))).toBeNull();
  });

  it.each<[unknown, string]>([
    [null, 'El archivo no es un respaldo válido.'],
    [{ version: 3, loans: [] }, 'El archivo no es un respaldo válido.'],
    [backup({ version: 99 }), 'El respaldo es de una versión que esta app no reconoce.'],
  ])('forma general %#', (raw, message) => {
    expect(errorOf(raw)).toBe(message);
  });

  it.each<[Record<string, unknown>, string]>([
    [{ id: '' }, 'Préstamo 1 (Ana): falta el identificador.'],
    [{ borrower: 3 }, 'Préstamo 1: falta el destinatario.'],
    [{ principal: 10.5 }, 'Préstamo 1 (Ana): el monto no es válido.'],
    [{ principal: 0 }, 'Préstamo 1 (Ana): el monto no es válido.'],
    [{ currency: 'EUR' }, 'Préstamo 1 (Ana): la moneda no es válida.'],
    [{ interestType: 'x' }, 'Préstamo 1 (Ana): el tipo de interés no es válido.'],
    [{ interestRate: -1 }, 'Préstamo 1 (Ana): la tasa no es válida.'],
    [{ interestRate: '2' }, 'Préstamo 1 (Ana): la tasa no es válida.'],
    [{ ratePeriod: 'weekly' }, 'Préstamo 1 (Ana): el periodo de la tasa no es válido.'],
    [{ lateInterestRate: 0 }, 'Préstamo 1 (Ana): la tasa de mora no es válida.'],
    [{ startDate: '2025-13-01' }, 'Préstamo 1 (Ana): la fecha del préstamo no es válida.'],
    [{ dueDate: '1/6/2025' }, 'Préstamo 1 (Ana): la fecha de vencimiento no es válida.'],
    [{ dueDate: '2024-12-31' }, 'Préstamo 1 (Ana): el vencimiento es anterior a la fecha del préstamo.'],
    [{ interestPeriodDays: 0 }, 'Préstamo 1 (Ana): el periodo de pago de intereses no es válido.'],
    [{ createdAt: undefined }, 'Préstamo 1 (Ana): falta la fecha de creación.'],
  ])('préstamo %o', (over, message) => {
    expect(errorOf(backup({ loans: [loan(over)], payments: [] }))).toBe(message);
  });

  it('préstamo que no es un objeto, en la posición correcta', () => {
    expect(errorOf(backup({ loans: [loan(), 'x'], payments: [] }))).toBe('Préstamo 2: no es un objeto.');
  });

  it.each<[Record<string, unknown>, string]>([
    [{ id: undefined }, 'Pago 1: falta el identificador.'],
    [{ loanId: 'otro' }, 'Pago 1: no corresponde a ningún préstamo del respaldo.'],
    [{ amount: -5 }, 'Pago 1: el monto no es válido.'],
    [{ date: '' }, 'Pago 1: la fecha no es válida.'],
    [{ date: '2024-12-01' }, 'Pago 1: es anterior al préstamo de Ana.'],
    [{ createdAt: '2' }, 'Pago 1: falta la fecha de creación.'],
  ])('pago %o', (over, message) => {
    expect(errorOf(backup({ payments: [payment(over)] }))).toBe(message);
  });

  it('identificadores repetidos', () => {
    expect(errorOf(backup({ loans: [loan(), loan()], payments: [] }))).toBe(
      'Hay dos préstamos con el mismo identificador.',
    );
    expect(errorOf(backup({ payments: [payment(), payment()] }))).toBe('Hay dos pagos con el mismo identificador.');
  });

  it('las notas vacías o no textuales se descartan', () => {
    const r = parseBackup(backup({ loans: [loan({ notes: 5 })], payments: [payment({ note: '' })] }));
    expect('loans' in r && [r.loans[0]!.notes, (r.payments[0] as Payment).note]).toEqual([undefined, undefined]);
  });
});
