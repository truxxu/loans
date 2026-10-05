import { useEffect, useRef, useState } from 'react';
import { PIN_MAX, PIN_MIN } from '../lib/privacy';

interface Props {
  /** Dígitos esperados: al completarlos se envía solo. Sin él (PIN nuevo) se aceptan 4 a 6. */
  length?: number;
  disabled?: boolean;
  onSubmit: (pin: string) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Teclado numérico propio: el del sistema mostraría sugerencias y no cabe en la pantalla de bloqueo. */
export function PinPad({ length, disabled = false, onSubmit }: Props) {
  const [digits, setDigits] = useState('');
  const max = length ?? PIN_MAX;

  const add = (d: string) => !disabled && setDigits((p) => (p.length < max ? p + d : p));
  const back = () => setDigits((p) => p.slice(0, -1));
  const submit = (pin: string) => {
    setDigits('');
    onSubmit(pin);
  };

  useEffect(() => {
    if (digits.length === max) submit(digits);
  }, [digits, max]);

  // Teclado físico (escritorio, teclados Bluetooth).
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e) => {
    if (/^\d$/.test(e.key)) add(e.key);
    else if (e.key === 'Backspace') back();
    else if (e.key === 'Enter' && !length && digits.length >= PIN_MIN) submit(digits);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="pinpad">
      <div className="pin-dots" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < digits.length ? 'filled' : undefined} />
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        {digits.length} dígitos
      </span>
      <div className="pin-keys">
        {KEYS.map((k) => (
          <button key={k} type="button" className="pin-key" disabled={disabled} onClick={() => add(k)}>
            {k}
          </button>
        ))}
        {length ? (
          <span />
        ) : (
          <button
            type="button"
            className="pin-key pin-key-text"
            disabled={disabled || digits.length < PIN_MIN}
            onClick={() => submit(digits)}
          >
            Continuar
          </button>
        )}
        <button type="button" className="pin-key" disabled={disabled} onClick={() => add('0')}>
          0
        </button>
        <button
          type="button"
          className="pin-key pin-key-text"
          aria-label="Borrar dígito"
          disabled={disabled || digits.length === 0}
          onClick={back}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
