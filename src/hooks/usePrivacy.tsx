import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LockScreen } from '../components/LockScreen';
import { wipeAllData } from '../db';
import {
  hashPin,
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

export type UnlockResult = { ok: true } | { ok: false; lockedUntil: number };

interface Privacy {
  settings: PrivacySettings;
  update: (patch: Partial<PrivacySettings>) => void;
  setPin: (pin: string) => Promise<void>;
  /** Comprueba el PIN actual (cambiar o quitar el PIN), sin afectar los intentos de desbloqueo. */
  checkPin: (pin: string) => Promise<boolean>;
  lock: () => void;
}

const PrivacyContext = createContext<Privacy | null>(null);

export function usePrivacy(): Privacy {
  const value = useContext(PrivacyContext);
  if (!value) throw new Error('usePrivacy requiere PrivacyProvider');
  return value;
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
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

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
      if (pin && shouldLock(hiddenAt, Date.now(), lockAfterMs)) setLocked(true);
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

  const unlock = useCallback(async (pin: string): Promise<UnlockResult> => {
    const stored = settingsRef.current.pin;
    const attempts = loadPinAttempts();
    if (stored && attempts.lockedUntil > Date.now()) return { ok: false, lockedUntil: attempts.lockedUntil };
    if (!stored || (await verifyPin(pin, stored))) {
      savePinAttempts(NO_ATTEMPTS);
      setLocked(false);
      return { ok: true };
    }
    const next = registerFailure(attempts, Date.now());
    savePinAttempts(next);
    return { ok: false, lockedUntil: next.lockedUntil };
  }, []);

  async function forgot() {
    const message =
      'Se borrarán todos los préstamos, pagos y ajustes de este dispositivo. Luego puedes importar un respaldo. ¿Continuar?';
    if (!confirm(message)) return;
    await wipeAllData();
    clearAppStorage();
    setSettings(loadPrivacySettings());
    setLocked(false);
  }

  const value = useMemo<Privacy>(
    () => ({
      settings,
      update,
      setPin: async (pin) => update({ pin: await hashPin(pin) }),
      checkPin: async (pin) => !!settingsRef.current.pin && verifyPin(pin, settingsRef.current.pin),
      lock: () => {
        if (settingsRef.current.pin) setLocked(true);
      },
    }),
    [settings, update],
  );

  return (
    <PrivacyContext.Provider value={value}>
      {locked && settings.pin ? <LockScreen pinLength={settings.pin.length} unlock={unlock} onForgot={forgot} /> : children}
      {veiled && <div className="privacy-veil" aria-hidden="true" />}
    </PrivacyContext.Provider>
  );
}
