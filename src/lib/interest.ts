import type { InterestType, ISODate, Loan, LoanStatus, Payment } from '../types';

/**
 * Motor de cálculo. Funciones puras: el saldo NUNCA se guarda, siempre se
 * deriva de (préstamo + pagos + fecha de corte).
 *
 * Convenciones (ver CLAUDE.md > Reglas de negocio):
 * - Base comercial: año de 360 días y mes de 30, aplicada sobre días calendario reales.
 *   El interés se causa por día: 35 días al 2% mensual = 2% × 35/30.
 * - Simple: interés sobre el capital pendiente. El interés no pagado no capitaliza.
 * - Compuesto: interés sobre capital + interés pendiente (capitalización continua por días).
 * - Cada pago cubre primero el interés causado y luego el capital.
 * - Después del vencimiento el interés se sigue causando sobre todo el saldo, a la tasa de
 *   mora (`lateInterestRate`) si el préstamo la tiene, o a la misma tasa si no.
 * - El vencimiento es opcional; sin vencimiento no hay mora.
 * - El periodo de pago de intereses (`interestPeriodDays`) es solo informativo.
 */

const DAYS_PER_PERIOD = { monthly: 30, annual: 360 } as const;
const MS_PER_DAY = 86_400_000;

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

/** Suma días de calendario a una fecha `YYYY-MM-DD` (en UTC, sin depender de la zona horaria). */
export function addDays(date: ISODate, days: number): ISODate {
  return new Date(Date.parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function todayISO(now = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface LedgerEntry {
  payment: Payment;
  /** Interés causado pendiente justo antes de aplicar el pago. */
  interestDueBefore: number;
  toInterest: number;
  toPrincipal: number;
  /** Excedente pagado por encima de la deuda total. */
  overpaid: number;
  balanceAfter: number;
}

export interface LoanState {
  principalOutstanding: number;
  interestOutstanding: number;
  /** Saldo total a la fecha de corte. */
  balance: number;
  totalPaid: number;
  totalInterestPaid: number;
  status: LoanStatus;
  /** Positivo = días restantes; negativo = días en mora; null = sin vencimiento. */
  daysToDue: number | null;
  /** Desde cuándo hay interés causado sin pagar; null si no hay interés pendiente. */
  interestPendingSince: ISODate | null;
  ledger: LedgerEntry[];
}

interface Accrual {
  type: InterestType;
  /** Porcentaje por `loan.ratePeriod`. */
  rate: number;
}

/** Cómo se causa el interés hasta el vencimiento. */
const regularAccrual = (loan: Loan): Accrual => ({ type: loan.interestType, rate: loan.interestRate });

/**
 * Cómo se causa el interés en mora. Un préstamo sin interés con tasa de mora causa
 * interés simple a esa tasa.
 */
const lateAccrual = (loan: Loan): Accrual =>
  loan.lateInterestRate === undefined
    ? regularAccrual(loan)
    : { type: loan.interestType === 'none' ? 'simple' : loan.interestType, rate: loan.lateInterestRate };

function accrue(loan: Loan, { type, rate }: Accrual, principal: number, interest: number, days: number): number {
  if (days <= 0 || type === 'none' || rate <= 0) return 0;
  const periods = days / DAYS_PER_PERIOD[loan.ratePeriod];
  const r = rate / 100;
  if (type === 'simple') return principal * r * periods;
  return (principal + interest) * (Math.pow(1 + r, periods) - 1);
}

export function computeLoanState(
  loan: Loan,
  payments: Payment[],
  asOf: ISODate = todayISO(),
): LoanState {
  const sorted = payments
    .filter((p) => p.loanId === loan.id && p.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  let principal = loan.principal;
  let interest = 0; // se mantiene con decimales; se redondea solo al exponerlo
  let cursor = loan.startDate;
  let totalPaid = 0;
  let totalInterestPaid = 0;
  let pendingSince = loan.startDate;
  const ledger: LedgerEntry[] = [];

  const regular = regularAccrual(loan);
  const late = lateAccrual(loan);
  const accrueUntil = (date: ISODate, accrual: Accrual) => {
    interest += accrue(loan, accrual, principal, interest, daysBetween(cursor, date));
    cursor = date;
  };
  /** Causa hasta `date`, partiendo el tramo en el vencimiento: los días posteriores son mora. */
  const advanceTo = (date: ISODate) => {
    if (date <= cursor) return;
    const due = loan.dueDate;
    if (!due) return accrueUntil(date, regular);
    if (cursor < due) accrueUntil(date < due ? date : due, regular);
    if (date > cursor) accrueUntil(date, late);
  };

  for (const payment of sorted) {
    advanceTo(payment.date);
    const interestDueBefore = Math.round(interest);
    const toInterest = Math.min(payment.amount, interestDueBefore);
    const toPrincipal = Math.min(payment.amount - toInterest, principal);
    const overpaid = payment.amount - toInterest - toPrincipal;

    interest = Math.max(0, interest - toInterest);
    principal -= toPrincipal;
    totalPaid += payment.amount;
    totalInterestPaid += toInterest;
    if (Math.round(interest) === 0) pendingSince = payment.date;

    ledger.push({
      payment,
      interestDueBefore,
      toInterest,
      toPrincipal,
      overpaid,
      balanceAfter: principal + Math.round(interest),
    });
  }

  advanceTo(asOf);

  const interestOutstanding = Math.round(interest);
  const balance = principal + interestOutstanding;
  const daysToDue = loan.dueDate ? daysBetween(asOf, loan.dueDate) : null;
  const status: LoanStatus =
    balance <= 0 ? 'paid' : daysToDue !== null && daysToDue < 0 ? 'overdue' : 'active';

  return {
    principalOutstanding: principal,
    interestOutstanding,
    balance,
    totalPaid,
    totalInterestPaid,
    status,
    daysToDue,
    interestPendingSince: interestOutstanding > 0 ? pendingSince : null,
    ledger,
  };
}

/** Total a pagar si no se hace ningún abono hasta el vencimiento; null sin vencimiento. */
export function projectedTotalAtDue(loan: Loan): number | null {
  return loan.dueDate ? computeLoanState(loan, [], loan.dueDate).balance : null;
}

/**
 * Próxima fecha habitual de pago de intereses (`startDate + k × interestPeriodDays`, k >= 1)
 * en o después de `asOf`. Si el vencimiento llega antes, devuelve el vencimiento.
 * Solo informativo: no afecta el estado del préstamo.
 */
export function nextInterestDate(loan: Loan, asOf: ISODate = todayISO()): ISODate | null {
  if (loan.interestType === 'none' || loan.interestRate <= 0) return null;
  const period = loan.interestPeriodDays;
  const k = Math.max(1, Math.ceil(daysBetween(loan.startDate, asOf) / period));
  const next = addDays(loan.startDate, k * period);
  return loan.dueDate && loan.dueDate >= asOf && loan.dueDate < next ? loan.dueDate : next;
}
