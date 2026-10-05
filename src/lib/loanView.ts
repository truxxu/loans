import type { ISODate, Loan, LoanStatus, Payment } from '../types';
import {
  computeLoanState,
  daysBetween,
  nextInterestDate,
  projectedTotalAtDue,
  todayISO,
  type LoanState,
} from './interest';
import { formatDate } from './money';

/**
 * Datos derivados para las vistas (lista, personas, detalle). Funciones puras sobre
 * `computeLoanState`; nada de esto se persiste.
 */

export interface LoanItem {
  loan: Loan;
  state: LoanState;
}

export const STATUS_LABEL: Record<LoanStatus, string> = { active: 'Al día', overdue: 'En mora', paid: 'Pagado' };
const RATE_LABEL = { monthly: 'mensual', annual: 'anual' } as const;
const TYPE_LABEL = { none: 'Sin interés', simple: 'Interés simple', compound: 'Interés compuesto' } as const;
/** Menor = más grave. */
const STATUS_RANK: Record<LoanStatus, number> = { overdue: 0, active: 1, paid: 2 };

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Porcentaje entero acotado a 0–100, como texto CSS (`"42%"`). */
export const pct = (x: number) => `${Math.max(0, Math.min(100, Math.round(x)))}%`;

/** Qué parte de `whole` es `part`, como ancho CSS; `whole` = 0 da 0%. */
export const sharePct = (part: number, whole: number) => pct((100 * part) / (whole || 1));

/** Cuánto del capital prestado ya se devolvió. */
export const paidPct = ({ loan, state }: LoanItem) => pct(100 * (1 - state.principalOutstanding / loan.principal));

/** Próximo pago de intereses; un préstamo pagado ya no tiene. */
const upcomingInterestDate = (loan: Loan, status: LoanStatus, asOf: ISODate) =>
  status === 'paid' ? null : nextInterestDate(loan, asOf);

export function subtitle(loan: Loan, status: LoanStatus, asOf: ISODate = todayISO()): string {
  if (loan.dueDate) return `Vence el ${formatDate(loan.dueDate)}`;
  const next = upcomingInterestDate(loan, status, asOf);
  return next ? `Intereses el ${formatDate(next)}` : 'Sin fecha de vencimiento';
}

/** Por vencimiento (sin vencimiento al final); luego por fecha del préstamo. */
export function sortLoans<T extends { loan: Loan }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (a.loan.dueDate ?? '9999').localeCompare(b.loan.dueDate ?? '9999') ||
      a.loan.startDate.localeCompare(b.loan.startDate),
  );
}

/** Estado de cada préstamo a `asOf`, ordenados. Agrupa los pagos por préstamo una sola vez. */
export function loanItems(loans: Loan[], payments: Payment[], asOf: ISODate = todayISO()): LoanItem[] {
  const byLoan = new Map<string, Payment[]>();
  for (const p of payments) byLoan.set(p.loanId, [...(byLoan.get(p.loanId) ?? []), p]);
  return sortLoans(loans.map((loan) => ({ loan, state: computeLoanState(loan, byLoan.get(loan.id) ?? [], asOf) })));
}

export function worstStatus(statuses: LoanStatus[]): LoanStatus {
  return statuses.reduce<LoanStatus>((w, s) => (STATUS_RANK[s] < STATUS_RANK[w] ? s : w), 'paid');
}

export interface ListTotals {
  outstanding: number;
  overdue: number;
  interest: number;
  openCount: number;
  /** Cuántos préstamos hay en cada estado. */
  counts: Record<LoanStatus, number>;
}

export function listTotals(items: LoanItem[]): ListTotals {
  const t: ListTotals = { outstanding: 0, overdue: 0, interest: 0, openCount: 0, counts: { active: 0, overdue: 0, paid: 0 } };
  for (const { state } of items) {
    t.counts[state.status]++;
    if (state.status === 'paid') continue;
    t.outstanding += state.balance;
    t.interest += state.interestOutstanding;
    t.openCount++;
    if (state.status === 'overdue') t.overdue += state.balance;
  }
  return t;
}

export interface Person {
  name: string;
  items: LoanItem[];
  balance: number;
  status: LoanStatus;
}

/** Agrupa por destinatario (nombre sin espacios sobrantes), ordenado alfabéticamente. */
export function groupByBorrower(items: LoanItem[]): Person[] {
  const groups = new Map<string, LoanItem[]>();
  for (const item of items) {
    const name = item.loan.borrower.trim();
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([name, rs]) => ({
      name,
      items: rs,
      balance: rs.reduce((a, i) => a + i.state.balance, 0),
      status: worstStatus(rs.map((i) => i.state.status)),
    }));
}

export interface LoanDetailView {
  state: LoanState;
  nextInterest: { date: ISODate; amount: number } | null;
  /** Desde cuándo hay intereses sin pagar, si llevan más de un periodo; si no, null. Solo informativo. */
  interestLateSince: ISODate | null;
  projected: number | null;
  dueText: string;
  conditions: string;
}

export function loanDetail(loan: Loan, payments: Payment[], asOf: ISODate = todayISO()): LoanDetailView {
  const state = computeLoanState(loan, payments, asOf);
  const nextDate = upcomingInterestDate(loan, state.status, asOf);
  const nextInterest = nextDate
    ? { date: nextDate, amount: computeLoanState(loan, payments, nextDate).interestOutstanding }
    : null;
  const since = state.interestPendingSince;
  const interestLateSince = since !== null && daysBetween(since, asOf) > loan.interestPeriodDays ? since : null;
  const dueText =
    (loan.dueDate ? formatDate(loan.dueDate) : 'Sin fecha de vencimiento') +
    (state.status !== 'paid' && state.daysToDue !== null
      ? state.daysToDue >= 0
        ? ` (faltan ${state.daysToDue} días)`
        : ` (${-state.daysToDue} días en mora)`
      : '');
  const conditions =
    TYPE_LABEL[loan.interestType] +
    (loan.interestType !== 'none' ? `, ${loan.interestRate}% ${RATE_LABEL[loan.ratePeriod]}` : '');
  return { state, nextInterest, interestLateSince, projected: projectedTotalAtDue(loan), dueText, conditions };
}
