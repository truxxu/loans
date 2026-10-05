import { usePinEntry } from '../hooks/usePrivacy';
import { PinPad } from './PinPad';

interface Props {
  pinLength: number;
  unlock: (pin: string) => Promise<boolean>;
  onForgot: () => void;
}

/** Pantalla de bloqueo. Mientras se muestra, las rutas no se montan: no hay datos en el DOM. */
export function LockScreen({ pinLength, unlock, onForgot }: Props) {
  const { verify, busy, waiting, waitMessage, error } = usePinEntry(unlock);

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
          {waiting ? waitMessage : error || 'Préstamos está bloqueada.'}
        </p>
      </div>
      <PinPad
        length={pinLength}
        disabled={busy || waiting}
        onSubmit={(pin) => void verify(pin)}
      />
      <button type="button" className="link-muted" onClick={onForgot}>
        Olvidé el PIN
      </button>
    </section>
  );
}
