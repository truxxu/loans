import type { ISODate, Loan, LoanStatus, Payment } from '../types';

/**
 * Motor de cálculo. Funciones puras: el saldo NUNCA se guarda, siempre se
 * deriva de (préstamo + pagos + fecha de corte).
 *
 * Convenciones (ver CLAUDE.md > Reglas de negocio):
 * - Año de 365 días; un mes = 365/12 días. El interés se causa por día.
 * - Simple: interés sobre el capital pendiente. El interés no pagado no capitaliza.
 * - Compuesto: interés sobre capital + interés pendiente (capitalización continua por días).
 * - Cada pago cubre primero el interés causado y luego el capital.
 * - Después del vencimiento el interés se sigue causando a la misma tasa.
 */

const DAYS_PER_PERIOD = { monthly: 365 / 12, annual: 365 } as const;
const MS_PER_DAY = 86_400_000;

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
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
  /** Positivo = días restantes; negativo = días en mora. */
  daysToDue: number;
  ledger: LedgerEntry[];
}

function accrue(loan: Loan, principal: number, interest: number, days: number): number {
  if (days <= 0 || loan.interestType === 'none' || loan.interestRate <= 0) return 0;
  const periods = days / DAYS_PER_PERIOD[loan.ratePeriod];
  const rate = loan.interestRate / 100;
  if (loan.interestType === 'simple') return principal * rate * periods;
  return (principal + interest) * (Math.pow(1 + rate, periods) - 1);
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
  const ledger: LedgerEntry[] = [];

  const advanceTo = (date: ISODate) => {
    if (date > cursor) {
      interest += accrue(loan, principal, interest, daysBetween(cursor, date));
      cursor = date;
    }
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
  const daysToDue = daysBetween(asOf, loan.dueDate);
  const status: LoanStatus = balance <= 0 ? 'paid' : daysToDue < 0 ? 'overdue' : 'active';

  return {
    principalOutstanding: principal,
    interestOutstanding,
    balance,
    totalPaid,
    totalInterestPaid,
    status,
    daysToDue,
    ledger,
  };
}

/** Total a pagar si no se hace ningún abono hasta el vencimiento. */
export function projectedTotalAtDue(loan: Loan): number {
  return computeLoanState(loan, [], loan.dueDate).balance;
}
