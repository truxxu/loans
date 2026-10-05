import { useState } from 'react';
import { usePinEntry, usePrivacy } from '../hooks/usePrivacy';
import { PinPad } from './PinPad';
import { Sheet } from './Sheet';

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
  const [saving, setSaving] = useState(false);
  const { verify, busy, waiting, waitMessage, error, setError } = usePinEntry(checkPin);
  const blocked = step === 'current' && waiting;

  async function onSubmit(pin: string) {
    setError('');
    if (step === 'current') {
      if (!(await verify(pin))) return;
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
    setSaving(true);
    await setPin(pin);
    onClose();
  }

  const length = step === 'current' ? settings.pin?.length : step === 'confirm' ? first.length : undefined;

  return (
    <Sheet title={TITLE[mode]} onClose={onClose}>
      <div className="stack-4 center-text">
        <span className="title">{PROMPT[step]}</span>
        {blocked || error ? (
          <p role="alert" className="error">
            {blocked ? waitMessage : error}
          </p>
        ) : (
          <span className="small">&nbsp;</span>
        )}
      </div>
      {/* key: cada paso empieza con el teclado vacío. */}
      <PinPad
        key={step}
        length={length}
        disabled={busy || saving || blocked}
        onSubmit={(pin) => void onSubmit(pin)}
      />
    </Sheet>
  );
}
