import Dexie, { type Table } from 'dexie';
import { DEFAULT_INTEREST_PERIOD_DAYS, type Loan, type Payment } from './types';

/** Completa los campos que no existían en versiones anteriores (v1: sin interestPeriodDays). */
const withLoanDefaults = (loan: Loan): Loan => ({
  ...loan,
  interestPeriodDays: loan.interestPeriodDays ?? DEFAULT_INTEREST_PERIOD_DAYS,
});

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

/** v3: `lateInterestRate` opcional en los préstamos. */
const BACKUP_VERSION = 3;

export interface Backup {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  loans: Loan[];
  payments: Payment[];
}

export async function exportBackup(): Promise<Backup> {
  const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), loans, payments };
}

/** Reemplaza todos los datos locales por los del respaldo. */
export async function importBackup(raw: unknown): Promise<void> {
  const data = raw as { version?: number; loans?: unknown; payments?: unknown } | null;
  if (
    !data ||
    ![1, 2, BACKUP_VERSION].includes(data.version ?? 0) ||
    !Array.isArray(data.loans) ||
    !Array.isArray(data.payments)
  ) {
    throw new Error('El archivo no es un respaldo válido.');
  }
  const loans = (data.loans as Loan[]).map(withLoanDefaults);
  const payments = data.payments as Payment[];
  await db.transaction('rw', db.loans, db.payments, async () => {
    await Promise.all([db.loans.clear(), db.payments.clear()]);
    await db.loans.bulkAdd(loans);
    await db.payments.bulkAdd(payments);
  });
}
