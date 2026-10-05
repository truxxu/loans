import { useEffect, useState } from 'react';
import type { UnlockResult } from '../hooks/usePrivacy';
import { loadPinAttempts } from '../lib/privacy';
import { PinPad } from './PinPad';

interface Props {
  pinLength: number;
  unlock: (pin: string) => Promise<UnlockResult>;
  onForgot: () => void;
}

/** Pantalla de bloqueo. Mientras se muestra, las rutas no se montan: no hay datos en el DOM. */
export function LockScreen({ pinLength, unlock, onForgot }: Props) {
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [waitUntil, setWaitUntil] = useState(() => loadPinAttempts().lockedUntil);
  const [, tick] = useState(0);
  const waitSeconds = Math.ceil((waitUntil - Date.now()) / 1000);
  const waiting = waitSeconds > 0;

  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [waiting]);

  async function onSubmit(pin: string) {
    setChecking(true);
    const result = await unlock(pin);
    setChecking(false);
    if (result.ok) return;
    setWaitUntil(result.lockedUntil);
    setError('PIN incorrecto.');
  }

  return (
    <section className="lock-screen" aria-label="App bloqueada">
      <div className="stack-6 center-text">
        <span className="lock-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h1 className="h1-xs">Ingresa tu PIN</h1>
        <p role="alert" className={waiting || error ? 'error' : 'muted small'}>
          {waiting ? `Demasiados intentos. Espera ${waitSeconds} s.` : error || 'Préstamos está bloqueada.'}
        </p>
      </div>
      <PinPad
        length={pinLength}
        disabled={checking || waiting}
        onSubmit={(pin) => {
          setError('');
          void onSubmit(pin);
        }}
      />
      <button type="button" className="link-muted" onClick={onForgot}>
        Olvidé el PIN
      </button>
    </section>
  );
}
