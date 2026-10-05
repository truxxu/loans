import type { ISODate } from '../types';

/**
 * Validación de fechas de formularios. Devuelven el mensaje de error para la UI,
 * o null si la fecha es válida.
 */

export function isISODate(value: string): value is ISODate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Un pago debe tener fecha, no ser anterior al préstamo ni posterior a hoy:
 * `computeLoanState` ignora los pagos futuros, así que quedarían invisibles.
 */
export function paymentDateError(date: string, loanStartDate: ISODate, today: ISODate): string | null {
  if (!isISODate(date)) return 'Escribe la fecha del pago.';
  if (date < loanStartDate) return 'El pago no puede ser anterior a la fecha del préstamo.';
  if (date > today) return 'El pago no puede tener una fecha futura.';
  return null;
}

/**
 * La fecha del préstamo es obligatoria y no puede quedar después del primer pago
 * registrado (`firstPaymentDate`, null si no hay pagos).
 */
export function loanDatesError(
  startDate: string,
  dueDate: string,
  firstPaymentDate: ISODate | null,
): string | null {
  if (!isISODate(startDate)) return 'Escribe la fecha del préstamo.';
  if (dueDate && !isISODate(dueDate)) return 'La fecha de vencimiento no es válida.';
  if (dueDate && dueDate < startDate)
    return 'La fecha de vencimiento debe ser igual o posterior a la fecha del préstamo.';
  if (firstPaymentDate && startDate > firstPaymentDate)
    return 'La fecha del préstamo no puede ser posterior al primer pago registrado.';
  return null;
}
