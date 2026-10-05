import { DEFAULT_INTEREST_PERIOD_DAYS, type Currency, type InterestType, type Loan, type Payment, type RatePeriod } from '../types';
import { isISODate } from './validation';

/**
 * Formato del respaldo JSON y su validación campo por campo. Funciones puras: `db.ts`
 * solo exporta/importa lo que sale de aquí.
 *
 * Versiones: v1 sin `interestPeriodDays`; v2 con él; v3 con `lateInterestRate` opcional.
 */
export const BACKUP_VERSION = 3;

export interface Backup {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  loans: Loan[];
  payments: Payment[];
}

export interface BackupData {
  loans: Loan[];
  payments: Payment[];
}

/** Completa los campos que no existían en versiones anteriores (v1: sin interestPeriodDays). */
export const withLoanDefaults = (loan: Loan): Loan => ({
  ...loan,
  interestPeriodDays: loan.interestPeriodDays ?? DEFAULT_INTEREST_PERIOD_DAYS,
});

const CURRENCIES: readonly Currency[] = ['COP', 'USD'];
const INTEREST_TYPES: readonly InterestType[] = ['none', 'simple', 'compound'];
const RATE_PERIODS: readonly RatePeriod[] = ['monthly', 'annual'];

type Fields = Record<string, unknown>;

class BackupError extends Error {}

export const isRecord = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isRate = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isOneOf = <T extends string>(options: readonly T[], v: unknown): v is T => options.includes(v as T);
const optionalText = (v: unknown): string | undefined => (isText(v) ? v : undefined);

function parseLoan(raw: unknown, n: number): Loan {
  const where = isRecord(raw) && isText(raw.borrower) ? `Préstamo ${n} (${raw.borrower})` : `Préstamo ${n}`;
  const fail = (msg: string): never => {
    throw new BackupError(`${where}: ${msg}`);
  };
  if (!isRecord(raw)) return fail('no es un objeto.');
  const r = raw;

  if (!isText(r.id)) fail('falta el identificador.');
  if (!isText(r.borrower)) fail('falta el destinatario.');
  if (!isCount(r.principal)) fail('el monto no es válido.');
  if (!isOneOf(CURRENCIES, r.currency)) fail('la moneda no es válida.');
  if (!isOneOf(INTEREST_TYPES, r.interestType)) fail('el tipo de interés no es válido.');
  if (!isRate(r.interestRate)) fail('la tasa no es válida.');
  if (!isOneOf(RATE_PERIODS, r.ratePeriod)) fail('el periodo de la tasa no es válido.');
  if (r.lateInterestRate !== undefined && !(isRate(r.lateInterestRate) && r.lateInterestRate > 0))
    fail('la tasa de mora no es válida.');
  if (typeof r.startDate !== 'string' || !isISODate(r.startDate)) fail('la fecha del préstamo no es válida.');
  if (r.dueDate !== undefined && (typeof r.dueDate !== 'string' || !isISODate(r.dueDate)))
    fail('la fecha de vencimiento no es válida.');
  if (typeof r.dueDate === 'string' && r.dueDate < (r.startDate as string))
    fail('el vencimiento es anterior a la fecha del préstamo.');
  if (r.interestPeriodDays !== undefined && !isCount(r.interestPeriodDays))
    fail('el periodo de pago de intereses no es válido.');
  if (typeof r.createdAt !== 'number') fail('falta la fecha de creación.');

  // Solo los campos conocidos: lo demás del archivo se descarta.
  return withLoanDefaults({
    id: r.id as string,
    borrower: r.borrower as string,
    principal: r.principal as number,
    currency: r.currency as Currency,
    interestRate: r.interestRate as number,
    ratePeriod: r.ratePeriod as RatePeriod,
    lateInterestRate: r.lateInterestRate as number | undefined,
    interestType: r.interestType as InterestType,
    startDate: r.startDate as string,
    dueDate: r.dueDate as string | undefined,
    interestPeriodDays: r.interestPeriodDays as number,
    notes: optionalText(r.notes),
    createdAt: r.createdAt as number,
  });
}

function parsePayment(raw: unknown, n: number, loans: Map<string, Loan>): Payment {
  const fail = (msg: string): never => {
    throw new BackupError(`Pago ${n}: ${msg}`);
  };
  if (!isRecord(raw)) return fail('no es un objeto.');
  const r = raw;

  if (!isText(r.id)) fail('falta el identificador.');
  const loan = typeof r.loanId === 'string' ? loans.get(r.loanId) : undefined;
  if (!loan) return fail('no corresponde a ningún préstamo del respaldo.');
  if (!isCount(r.amount)) fail('el monto no es válido.');
  if (typeof r.date !== 'string' || !isISODate(r.date)) fail('la fecha no es válida.');
  if ((r.date as string) < loan.startDate) fail(`es anterior al préstamo de ${loan.borrower}.`);
  if (typeof r.createdAt !== 'number') fail('falta la fecha de creación.');

  return {
    id: r.id as string,
    loanId: loan.id,
    date: r.date as string,
    amount: r.amount as number,
    note: optionalText(r.note),
    createdAt: r.createdAt as number,
  };
}

function assertUniqueIds(items: { id: string }[], label: string) {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new BackupError(`Hay dos ${label} con el mismo identificador.`);
    seen.add(id);
  }
}

/**
 * Valida un respaldo leído de un archivo y devuelve los datos limpios, o el primer error
 * encontrado con su ubicación ("Préstamo 3 (Ana): el monto no es válido.").
 */
export function parseBackup(raw: unknown): BackupData | { error: string } {
  if (!isRecord(raw) || !Array.isArray(raw.loans) || !Array.isArray(raw.payments))
    return { error: 'El archivo no es un respaldo válido.' };
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== BACKUP_VERSION)
    return { error: 'El respaldo es de una versión que esta app no reconoce.' };
  try {
    const loans = raw.loans.map((l, i) => parseLoan(l, i + 1));
    assertUniqueIds(loans, 'préstamos');
    const byId = new Map(loans.map((l) => [l.id, l]));
    const payments = raw.payments.map((p, i) => parsePayment(p, i + 1, byId));
    assertUniqueIds(payments, 'pagos');
    return { loans, payments };
  } catch (err) {
    if (err instanceof BackupError) return { error: err.message };
    throw err;
  }
}
