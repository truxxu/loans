import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { computeLoanState, todayISO } from '../lib/interest';
import { sortLoans, type LoanItem } from '../lib/loanView';

/** Todos los préstamos con su estado a hoy, ordenados. `undefined` mientras carga. */
export function useLoans(): LoanItem[] | undefined {
  return useLiveQuery(async () => {
    const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
    const today = todayISO();
    return sortLoans(loans.map((loan) => ({ loan, state: computeLoanState(loan, payments, today) })));
  }, []);
}
