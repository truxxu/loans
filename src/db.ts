import Dexie, { type Table } from 'dexie';
import { DEFAULT_INTEREST_PERIOD_DAYS, type Loan, type Payment } from './types';

class LoansDB extends Dexie {
  loans!: Table<Loan, string>;
  payments!: Table<Payment, string>;

  constructor() {
    super('prestamos-pwa');
    // Solo se listan los campos indexados. Cambios de esquema => nueva version().
    this.version(1).stores({
      loans: 'id, borrower, dueDate',
      payments: 'id, loanId, date',
    });
    // v2: dueDate opcional e interestPeriodDays. Mismos índices.
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Loan, string>('loans')
          .toCollection()
          .modify((loan) => {
            loan.interestPeriodDays ??= DEFAULT_INTEREST_PERIOD_DAYS;
          }),
      );
  }
}

export const db = new LoansDB();

export const newId = () => crypto.randomUUID();

export async function deleteLoan(id: string): Promise<void> {
  await db.transaction('rw', db.loans, db.payments, async () => {
    await db.payments.where('loanId').equals(id).delete();
    await db.loans.delete(id);
  });
}

export interface Backup {
  version: 2;
  exportedAt: string;
  loans: Loan[];
  payments: Payment[];
}

export async function exportBackup(): Promise<Backup> {
  const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
  return { version: 2, exportedAt: new Date().toISOString(), loans, payments };
}

/** Reemplaza todos los datos locales por los del respaldo. */
export async function importBackup(raw: unknown): Promise<void> {
  const data = raw as { version?: number; loans?: unknown; payments?: unknown } | null;
  if (
    (data?.version !== 1 && data?.version !== 2) ||
    !Array.isArray(data.loans) ||
    !Array.isArray(data.payments)
  ) {
    throw new Error('El archivo no es un respaldo válido.');
  }
  // v1 no tenía interestPeriodDays.
  const loans = (data.loans as Loan[]).map((loan) => ({
    ...loan,
    interestPeriodDays: loan.interestPeriodDays ?? DEFAULT_INTEREST_PERIOD_DAYS,
  }));
  const payments = data.payments as Payment[];
  await db.transaction('rw', db.loans, db.payments, async () => {
    await Promise.all([db.loans.clear(), db.payments.clear()]);
    await db.loans.bulkAdd(loans);
    await db.payments.bulkAdd(payments);
  });
}
