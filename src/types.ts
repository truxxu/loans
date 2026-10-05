export type Currency = 'COP' | 'USD';
export type RatePeriod = 'monthly' | 'annual';
export type InterestType = 'none' | 'simple' | 'compound';
export type LoanStatus = 'active' | 'overdue' | 'paid';

export const DEFAULT_INTEREST_PERIOD_DAYS = 30;

/** Fecha de calendario sin hora, formato `YYYY-MM-DD`. */
export type ISODate = string;

export interface Loan {
  id: string;
  /** Destinatario del préstamo. */
  borrower: string;
  /** Capital prestado en unidades menores (centavos). Siempre entero. */
  principal: number;
  currency: Currency;
  /** Tasa en porcentaje por `ratePeriod`. Ej: 2.5 = 2.5%. */
  interestRate: number;
  ratePeriod: RatePeriod;
  /**
   * Opcional: tasa en mora (después de `dueDate`), en porcentaje por `ratePeriod`.
   * Sin ella, la mora causa a `interestRate`.
   */
  lateInterestRate?: number;
  interestType: InterestType;
  startDate: ISODate;
  /** Opcional: muchos préstamos no tienen fecha de vencimiento. */
  dueDate?: ISODate;
  /** Cada cuántos días se suelen pagar los intereses. Solo informativo; entero >= 1. */
  interestPeriodDays: number;
  notes?: string;
  createdAt: number;
}

export interface Payment {
  id: string;
  loanId: string;
  date: ISODate;
  /** Monto pagado en unidades menores. Siempre entero y > 0. */
  amount: number;
  note?: string;
  createdAt: number;
}
