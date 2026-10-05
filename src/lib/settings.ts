import type { ISODate } from '../types';
import { readItem, readJSON, writeItem } from './storage';

/**
 * Preferencias de este dispositivo (no viajan en el respaldo): los permisos de
 * notificación también son por dispositivo.
 */

export interface ReminderSettings {
  enabled: boolean;
  /** Con cuántos días de anticipación avisar un vencimiento. Entero >= 0. */
  leadDays: number;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: false, leadDays: 3 };

const SETTINGS_KEY = 'reminders';
const LAST_SHOWN_KEY = 'reminders:last';

export const isLeadDays = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 60;

export function loadReminderSettings(): ReminderSettings {
  const raw = readJSON(SETTINGS_KEY) as Partial<ReminderSettings> | null;
  return {
    enabled: raw?.enabled === true,
    leadDays: isLeadDays(raw?.leadDays) ? raw.leadDays : DEFAULT_REMINDER_SETTINGS.leadDays,
  };
}

export const saveReminderSettings = (settings: ReminderSettings) => writeItem(SETTINGS_KEY, JSON.stringify(settings));

/** Último día en que se mostró el recordatorio: como mucho uno al día. */
export const lastReminderDate = (): ISODate | null => readItem(LAST_SHOWN_KEY);
export const setLastReminderDate = (date: ISODate) => writeItem(LAST_SHOWN_KEY, date);
