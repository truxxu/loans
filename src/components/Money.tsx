import { formatMoney } from '../lib/money';
import type { Currency } from '../types';

/** Monto formateado. Con "Ocultar montos" se difumina (`.hide-amounts .amount` en styles.css). */
export function Money({ value, currency }: { value: number; currency: Currency }) {
  return <span className="amount">{formatMoney(value, currency)}</span>;
}
