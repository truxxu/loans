import { useEffect, useRef, useState } from 'react';
import { usePrivacy } from '../hooks/usePrivacy';
import { PinPad } from './PinPad';

export type PinSheetMode = 'create' | 'change' | 'remove';
type Step = 'current' | 'new' | 'confirm';

const TITLE: Record<PinSheetMode, string> = {
  create: 'Activar bloqueo con PIN',
  change: 'Cambiar PIN',
  remove: 'Quitar PIN',
};

const PROMPT: Record<Step, string> = {
  current: 'Ingresa tu PIN actual',
  new: 'Elige un PIN de 4 a 6 dígitos',
  confirm: 'Repite el PIN',
};

/** Hoja para crear, cambiar o quitar el PIN. Cambiar y quitar piden primero el actual. */
export function PinSheet({ mode, onClose }: { mode: PinSheetMode; onClose: () => void }) {
  const { settings, setPin, checkPin, update } = usePrivacy();
  const [step, setStep] = useState<Step>(mode === 'create' ? 'new' : 'current');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function onSubmit(pin: string) {
    setError('');
    if (step === 'current') {
      setBusy(true);
      const ok = await checkPin(pin);
      setBusy(false);
      if (!ok) return setError('PIN incorrecto.');
      if (mode === 'remove') {
        update({ pin: null });
        return onClose();
      }
      return setStep('new');
    }
    if (step === 'new') {
      setFirst(pin);
      return setStep('confirm');
    }
    if (pin !== first) {
      setStep('new');
      return setError('Los PIN no coinciden. Inténtalo de nuevo.');
    }
    setBusy(true);
    await setPin(pin);
    onClose();
  }

  const length = step === 'current' ? settings.pin?.length : step === 'confirm' ? first.length : undefined;

  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={TITLE[mode]}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{TITLE[mode]}</h2>
          <button type="button" className="link-muted" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="stack-4 center-text">
          <span className="title">{PROMPT[step]}</span>
          {error ? <p role="alert" className="error">{error}</p> : <span className="small">&nbsp;</span>}
        </div>
        {/* key: cada paso empieza con el teclado vacío. */}
        <PinPad key={step} length={length} disabled={busy} onSubmit={(pin) => void onSubmit(pin)} />
      </div>
    </div>
  );
}
