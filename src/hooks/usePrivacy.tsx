import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LockScreen } from '../components/LockScreen';
import { wipeAllData } from '../db';
import {
  hashPin,
  hiddenByPicker,
  loadPinAttempts,
  loadPrivacySettings,
  NO_ATTEMPTS,
  registerFailure,
  savePinAttempts,
  savePrivacySettings,
  shouldLock,
  verifyPin,
  type PrivacySettings,
} from '../lib/privacy';
import { clearAppStorage } from '../lib/storage';

interface Privacy {
  settings: PrivacySettings;
  update: (patch: Partial<PrivacySettings>) => void;
  setPin: (pin: string) => Promise<void>;
  /** Comprueba el PIN actual (cambiar o quitar el PIN). Comparte intentos y espera con el desbloqueo. */
  checkPin: (pin: string) => Promise<boolean>;
  /** Hasta cuándo no se aceptan intentos de PIN (ms epoch; 0 = sin espera). */
  pinLockedUntil: number;
  lock: () => void;
  /** Llamar al abrir el selector de archivos: esa salida de la app no vuelve a bloquear. */
  expectFilePicker: () => void;
}

const PrivacyContext = createContext<Privacy | null>(null);

export function usePrivacy(): Privacy {
  const value = useContext(PrivacyContext);
  if (!value) throw new Error('usePrivacy requiere PrivacyProvider');
  return value;
}

/**
 * Ingreso de un PIN (pantalla de bloqueo u hoja del PIN): envío, error y la espera por
 * intentos fallidos con cuenta regresiva. La espera vive en el provider, así que cerrar
 * la hoja no la reinicia.
 */
export function usePinEntry(check: (pin: string) => Promise<boolean>) {
  const { pinLockedUntil } = usePrivacy();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, tick] = useState(0);
  const seconds = Math.ceil((pinLockedUntil - Date.now()) / 1000);
  const waiting = seconds > 0;

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  async function verify(pin: string): Promise<boolean> {
    setError('');
    setBusy(true);
    const ok = await check(pin);
    setBusy(false);
    if (!ok) setError('PIN incorrecto.');
    return ok;
  }

  return { verify, busy, waiting, waitMessage: `Demasiados intentos. Espera ${seconds} s.`, error, setError };
}

/** App instalada: el selector de apps captura la pantalla; en una pestaña no hace falta. */
const isStandalone = () =>
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Bloqueo con PIN, velo de privacidad al salir de la app y montos ocultos.
 * Si está bloqueada, muestra la pantalla de bloqueo en vez de `children`.
 */
export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadPrivacySettings);
  const [locked, setLocked] = useState(() => settings.pin !== null);
  const [veiled, setVeiled] = useState(false);
  const [pinLockedUntil, setPinLockedUntil] = useState(() => loadPinAttempts().lockedUntil);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pickerOpenedAt = useRef<number | null>(null);

  const update = useCallback((patch: Partial<PrivacySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      savePrivacySettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('hide-amounts', settings.hideAmounts);
    return () => document.documentElement.classList.remove('hide-amounts');
  }, [settings.hideAmounts]);

  // Velo al ocultarse (y al perder el foco si está instalada, que llega antes de la
  // captura del selector de apps); al volver, bloquea si estuvo fuera demasiado tiempo.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const hide = () => {
      hiddenAt ??= Date.now();
      setVeiled(true);
    };
    const show = () => {
      const { pin, lockAfterMs } = settingsRef.current;
      const now = Date.now();
      const picker = hiddenByPicker(pickerOpenedAt.current, hiddenAt, now);
      if (pin && !picker && shouldLock(hiddenAt, now, lockAfterMs)) setLocked(true);
      pickerOpenedAt.current = null;
      hiddenAt = null;
      setVeiled(false);
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? hide() : show());
    const onBlur = () => isStandalone() && setVeiled(true);
    const onFocus = () => document.visibilityState === 'visible' && hiddenAt === null && setVeiled(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Desbloquear, cambiar y quitar el PIN cuentan los mismos intentos: si no, quien tenga
  // el teléfono con la app abierta podría probar PIN sin espera desde Ajustes.
  const checkPin = useCallback(async (pin: string): Promise<boolean> => {
    const stored = settingsRef.current.pin;
    if (!stored) return true;
    const attempts = loadPinAttempts();
    if (attempts.lockedUntil > Date.now()) return false;
    if (await verifyPin(pin, stored)) {
      savePinAttempts(NO_ATTEMPTS);
      return true;
    }
    const next = registerFailure(attempts, Date.now());
    savePinAttempts(next);
    setPinLockedUntil(next.lockedUntil);
    return false;
  }, []);

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      const ok = await checkPin(pin);
      if (ok) setLocked(false);
      return ok;
    },
    [checkPin],
  );

  async function forgot() {
    const message =
      'Se borrarán todos los préstamos, pagos y ajustes de este dispositivo. Luego puedes importar un respaldo. ¿Continuar?';
    if (!confirm(message)) return;
    await wipeAllData();
    clearAppStorage();
    setSettings(loadPrivacySettings());
    setPinLockedUntil(0);
    setLocked(false);
  }

  const value = useMemo<Privacy>(
    () => ({
      settings,
      update,
      setPin: async (pin) => update({ pin: await hashPin(pin) }),
      checkPin,
      pinLockedUntil,
      lock: () => {
        if (settingsRef.current.pin) setLocked(true);
      },
      expectFilePicker: () => {
        pickerOpenedAt.current = Date.now();
      },
    }),
    [settings, update, checkPin, pinLockedUntil],
  );

  return (
    <PrivacyContext.Provider value={value}>
      {locked && settings.pin ? <LockScreen pinLength={settings.pin.length} unlock={unlock} onForgot={forgot} /> : children}
      {veiled && <div className="privacy-veil" aria-hidden="true" />}
    </PrivacyContext.Provider>
  );
}
