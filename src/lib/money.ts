import type { Currency } from '../types';

/** Convierte lo que escribe el usuario ("1.500.000", "1500000,50") a unidades menores. */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // El último separador seguido de 1-2 dígitos se toma como decimal; el resto son miles.
  const match = cleaned.match(/^(.*?)(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const whole = (match[1] ?? '').replace(/[.,]/g, '');
  const cents = (match[2] ?? '').padEnd(2, '0');
  const value = Number(whole || '0') * 100 + Number(cents || '0');
  return Number.isFinite(value) ? value : null;
}

export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'COP' ? 0 : 2,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(minor / 100);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));
}
