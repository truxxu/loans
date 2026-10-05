import { fromBase64, toBase64 } from './base64';
import { readJSON, writeItem } from './storage';

/**
 * Privacidad de este dispositivo: bloqueo con PIN y montos ocultos. No viaja en el respaldo.
 *
 * El PIN es un bloqueo de la interfaz, no cifra los datos: IndexedDB sigue legible para
 * quien tenga acceso al navegador. Protege contra alguien que toma el teléfono desbloqueado.
 * Solo se guarda un hash PBKDF2 con sal, nunca el PIN.
 */

export const PIN_MIN = 4;
export const PIN_MAX = 6;
const PBKDF2_ITERATIONS = 200_000;

export interface StoredPin {
  salt: string;
  hash: string;
  iterations: number;
  /** Cantidad de dígitos: la pantalla de bloqueo desbloquea al completarlos. */
  length: number;
}

export interface PrivacySettings {
  pin: StoredPin | null;
  /** Tiempo en segundo plano tras el cual se vuelve a pedir el PIN; 0 = siempre. */
  lockAfterMs: number;
  /** Difuminar todos los montos de la interfaz. */
  hideAmounts: boolean;
}

export const LOCK_AFTER_OPTIONS: readonly [number, string][] = [
  [0, 'Al salir'],
  [60_000, '1 min'],
  [5 * 60_000, '5 min'],
  [15 * 60_000, '15 min'],
];

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = { pin: null, lockAfterMs: 60_000, hideAmounts: false };

const SETTINGS_KEY = 'privacy';
const ATTEMPTS_KEY = 'privacy:attempts';

export const isValidPin = (text: string) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(text);

const isStoredPin = (v: unknown): v is StoredPin => {
  const p = v as Partial<StoredPin> | null;
  return (
    typeof p?.salt === 'string' &&
    typeof p.hash === 'string' &&
    Number.isInteger(p.iterations) &&
    (p.iterations as number) > 0 &&
    Number.isInteger(p.length) &&
    (p.length as number) >= PIN_MIN &&
    (p.length as number) <= PIN_MAX
  );
};

export function loadPrivacySettings(): PrivacySettings {
  const raw = readJSON(SETTINGS_KEY) as Partial<PrivacySettings> | null;
  const lockAfterMs = LOCK_AFTER_OPTIONS.some(([ms]) => ms === raw?.lockAfterMs)
    ? (raw!.lockAfterMs as number)
    : DEFAULT_PRIVACY_SETTINGS.lockAfterMs;
  return {
    pin: isStoredPin(raw?.pin) ? raw.pin : null,
    lockAfterMs,
    hideAmounts: raw?.hideAmounts === true,
  };
}

export const savePrivacySettings = (settings: PrivacySettings) => writeItem(SETTINGS_KEY, JSON.stringify(settings));

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toBase64(new Uint8Array(bits));
}

/** Hash de un PIN nuevo, con sal aleatoria. */
export async function hashPin(pin: string): Promise<StoredPin> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: toBase64(salt),
    hash: await derive(pin, salt, PBKDF2_ITERATIONS),
    iterations: PBKDF2_ITERATIONS,
    length: pin.length,
  };
}

export async function verifyPin(pin: string, stored: StoredPin): Promise<boolean> {
  if (pin.length !== stored.length) return false;
  return (await derive(pin, fromBase64(stored.salt), stored.iterations)) === stored.hash;
}

/** Al volver a primer plano: ¿estuvo oculta lo suficiente para volver a pedir el PIN? */
export const shouldLock = (hiddenAt: number | null, now: number, lockAfterMs: number) =>
  hiddenAt !== null && now - hiddenAt >= lockAfterMs;

/** Intentos fallidos seguidos y hasta cuándo no se acepta otro intento (ms epoch). */
export interface PinAttempts {
  failed: number;
  lockedUntil: number;
}

export const NO_ATTEMPTS: PinAttempts = { failed: 0, lockedUntil: 0 };

const FREE_ATTEMPTS = 5;
const LOCKOUT_STEPS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000];

/** Espera tras `failed` intentos fallidos seguidos: ninguna los primeros 5, luego creciente. */
export function lockoutMs(failed: number): number {
  if (failed < FREE_ATTEMPTS) return 0;
  return LOCKOUT_STEPS_MS[Math.min(failed - FREE_ATTEMPTS, LOCKOUT_STEPS_MS.length - 1)]!;
}

export function registerFailure(attempts: PinAttempts, now: number): PinAttempts {
  const failed = attempts.failed + 1;
  return { failed, lockedUntil: now + lockoutMs(failed) };
}

/** Persistidos para que recargar la app no reinicie la espera. */
export function loadPinAttempts(): PinAttempts {
  const raw = readJSON(ATTEMPTS_KEY) as Partial<PinAttempts> | null;
  return {
    failed: Number.isInteger(raw?.failed) ? raw!.failed! : 0,
    lockedUntil: typeof raw?.lockedUntil === 'number' ? raw.lockedUntil : 0,
  };
}

export const savePinAttempts = (attempts: PinAttempts) => writeItem(ATTEMPTS_KEY, JSON.stringify(attempts));
