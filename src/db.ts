import Dexie, { type Table } from 'dexie';
import type { Loan, Payment } from './types';

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
  version: 1;
  exportedAt: string;
  loans: Loan[];
  payments: Payment[];
}

export async function exportBackup(): Promise<Backup> {
  const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
  return { version: 1, exportedAt: new Date().toISOString(), loans, payments };
}

/** Reemplaza todos los datos locales por los del respaldo. */
export async function importBackup(raw: unknown): Promise<void> {
  const data = raw as Partial<Backup>;
  if (data?.version !== 1 || !Array.isArray(data.loans) || !Array.isArray(data.payments)) {
    throw new Error('El archivo no es un respaldo válido.');
  }
  const { loans, payments } = data;
  await db.transaction('rw', db.loans, db.payments, async () => {
    await Promise.all([db.loans.clear(), db.payments.clear()]);
    await db.loans.bulkAdd(loans);
    await db.payments.bulkAdd(payments);
  });
}
