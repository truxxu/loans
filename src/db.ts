import Dexie, { type Table } from 'dexie';
import { BACKUP_VERSION, parseBackup, withLoanDefaults, type Backup } from './lib/backup';
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
    // v2: dueDate opcional e interestPeriodDays. Mismos índices.
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Loan, string>('loans')
          .toCollection()
          .modify((loan, ref) => {
            ref.value = withLoanDefaults(loan);
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

/** Crea o reemplaza un pago (editar un pago recalcula todo: el saldo nunca se guarda). */
export async function savePayment(payment: Payment): Promise<void> {
  await db.payments.put(payment);
}

export async function deletePayment(id: string): Promise<void> {
  await db.payments.delete(id);
}

export async function exportBackup(): Promise<Backup> {
  const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), loans, payments };
}

/** Reemplaza todos los datos locales por los del respaldo, si es válido campo por campo. */
export async function importBackup(raw: unknown): Promise<void> {
  const data = parseBackup(raw);
  if ('error' in data) throw new Error(data.error);
  await db.transaction('rw', db.loans, db.payments, async () => {
    await Promise.all([db.loans.clear(), db.payments.clear()]);
    await db.loans.bulkAdd(data.loans);
    await db.payments.bulkAdd(data.payments);
  });
}

/** "Olvidé el PIN": borra préstamos y pagos de este dispositivo. */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', db.loans, db.payments, async () => {
    await Promise.all([db.loans.clear(), db.payments.clear()]);
  });
}
