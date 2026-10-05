import { DEFAULT_INTEREST_PERIOD_DAYS, type Currency, type ISODate, type InterestType, type Loan, type RatePeriod } from '../types';
import { todayISO } from './interest';
import { amountToInput, parseAmount } from './money';
import { loanDatesError } from './validation';

/** Lo que muestra el formulario de préstamo: todo como texto editable. */
export interface LoanForm {
  borrower: string;
  principal: string;
  currency: Currency;
  interestType: InterestType;
  interestRate: string;
  ratePeriod: RatePeriod;
  /** Vacío = la mora causa a la tasa corriente. */
  lateInterestRate: string;
  interestPeriodDays: string;
  startDate: string;
  dueDate: string;
  notes: string;
}

export const emptyLoanForm = (today: ISODate = todayISO()): LoanForm => ({
  borrower: '',
  principal: '',
  currency: 'COP',
  interestType: 'simple',
  interestRate: '',
  ratePeriod: 'monthly',
  lateInterestRate: '',
  interestPeriodDays: String(DEFAULT_INTEREST_PERIOD_DAYS),
  startDate: today,
  dueDate: '',
  notes: '',
});

export const loanToForm = (loan: Loan): LoanForm => ({
  borrower: loan.borrower,
  principal: amountToInput(loan.principal),
  currency: loan.currency,
  interestType: loan.interestType,
  interestRate: String(loan.interestRate),
  ratePeriod: loan.ratePeriod,
  lateInterestRate: loan.lateInterestRate === undefined ? '' : String(loan.lateInterestRate),
  interestPeriodDays: String(loan.interestPeriodDays),
  startDate: loan.startDate,
  dueDate: loan.dueDate ?? '',
  notes: loan.notes ?? '',
});

const isPeriod = (n: number) => Number.isInteger(n) && n >= 1;
const parseRate = (text: string) => Number(text.trim().replace(',', '.'));

/**
 * Valida el formulario y arma el préstamo, o devuelve el mensaje de error para la UI.
 * `existing` conserva id y createdAt al editar; `firstPaymentDate` es null si no hay pagos.
 */
export function parseLoanForm(
  form: LoanForm,
  existing: Pick<Loan, 'id' | 'createdAt'> | null,
  firstPaymentDate: ISODate | null,
  newId: () => string,
): { loan: Loan } | { error: string } {
  const principal = parseAmount(form.principal);
  const hasInterest = form.interestType !== 'none';
  const rate = hasInterest ? parseRate(form.interestRate) : 0;
  // La tasa de mora solo aplica con vencimiento; sin él el campo está oculto y se descarta.
  const lateRate = form.dueDate && form.lateInterestRate.trim() ? parseRate(form.lateInterestRate) : undefined;
  const typedPeriod = Number(form.interestPeriodDays);
  // Sin interés el campo está oculto: se conserva el periodo que tenía (si es válido)
  // para no perderlo si luego se vuelve a activar el interés.
  const interestPeriodDays = hasInterest || isPeriod(typedPeriod) ? typedPeriod : DEFAULT_INTEREST_PERIOD_DAYS;

  if (!form.borrower.trim()) return { error: 'Escribe a quién le prestas.' };
  if (!principal || principal <= 0) return { error: 'El monto debe ser mayor que cero.' };
  if (hasInterest && !(rate > 0)) return { error: 'La tasa debe ser mayor que cero.' };
  if (lateRate !== undefined && !(lateRate > 0)) return { error: 'La tasa de mora debe ser mayor que cero.' };
  if (!isPeriod(interestPeriodDays))
    return { error: 'El periodo de pago de intereses debe ser un número entero de días.' };
  const datesError = loanDatesError(form.startDate, form.dueDate, firstPaymentDate);
  if (datesError) return { error: datesError };

  return {
    loan: {
      id: existing?.id ?? newId(),
      borrower: form.borrower.trim(),
      principal,
      currency: form.currency,
      interestType: form.interestType,
      interestRate: rate,
      ratePeriod: form.ratePeriod,
      lateInterestRate: lateRate,
      interestPeriodDays,
      startDate: form.startDate,
      dueDate: form.dueDate || undefined,
      notes: form.notes.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    },
  };
}
