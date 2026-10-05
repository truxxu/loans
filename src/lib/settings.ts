import type { ISODate } from '../types';

/**
 * Preferencias de este dispositivo (no viajan en el respaldo): los permisos de
 * notificación también son por dispositivo. `localStorage` puede no estar disponible
 * (modo privado, datos bloqueados), así que todo acceso tolera fallos.
 */

export interface ReminderSettings {
  enabled: boolean;
  /** Con cuántos días de anticipación avisar un vencimiento. Entero >= 0. */
  leadDays: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, leadDays: 3 };

const SETTINGS_KEY = 'prestamos:reminders';
const LAST_SHOWN_KEY = 'prestamos:reminders:last';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la preferencia dura solo esta sesión.
  }
}

export const isLeadDays = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 60;

export function loadReminderSettings(): ReminderSettings {
  try {
    const raw = JSON.parse(read(SETTINGS_KEY) ?? 'null') as Partial<ReminderSettings> | null;
    return {
      enabled: raw?.enabled === true,
      leadDays: isLeadDays(raw?.leadDays) ? raw.leadDays : DEFAULT_REMINDER_SETTINGS.leadDays,
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export const saveReminderSettings = (settings: ReminderSettings) => write(SETTINGS_KEY, JSON.stringify(settings));

/** Último día en que se mostró el recordatorio: como mucho uno al día. */
export const lastReminderDate = (): ISODate | null => read(LAST_SHOWN_KEY);
export const setLastReminderDate = (date: ISODate) => write(LAST_SHOWN_KEY, date);
