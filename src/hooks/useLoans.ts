import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { loanItems, type LoanItem } from '../lib/loanView';

/** Todos los préstamos con su estado a hoy, ordenados. `undefined` mientras carga. */
export function useLoans(): LoanItem[] | undefined {
  return useLiveQuery(async () => {
    const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
    return loanItems(loans, payments);
  }, []);
}
