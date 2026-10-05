import { useEffect } from 'react';
import { db } from '../db';
import { todayISO } from '../lib/interest';
import { loanItems } from '../lib/loanView';
import { discreetNotifications, loadPrivacySettings } from '../lib/privacy';
import { dueReminders, reminderText } from '../lib/reminders';
import { lastReminderDate, loadReminderSettings, setLastReminderDate } from '../lib/settings';

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

/** Muestra el resumen de vencimientos si está activado, hay permiso y hoy no se ha mostrado. */
async function remindIfDue(): Promise<void> {
  const settings = loadReminderSettings();
  const today = todayISO();
  if (!settings.enabled || !notificationsSupported() || Notification.permission !== 'granted') return;
  if (lastReminderDate() === today) return;

  const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
  const discreet = discreetNotifications(loadPrivacySettings());
  const text = reminderText(dueReminders(loanItems(loans, payments, today), settings.leadDays), discreet);
  if (!text) return;

  const options: NotificationOptions = { body: text.body, tag: 'prestamos-recordatorio', icon: 'icon-192.png' };
  // En Android solo funcionan las notificaciones del service worker; `new Notification` lanza.
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification(text.title, options);
  else new Notification(text.title, options);
  setLastReminderDate(today);
}

/**
 * Sin backend no hay notificaciones programadas: se revisa al abrir la app y cada vez
 * que vuelve a primer plano (una PWA instalada puede quedar abierta varios días).
 */
export function useReminders(): void {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'visible') remindIfDue().catch(() => {});
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
}
