import { usePrivacy } from '../hooks/usePrivacy';

/** Ojo para difuminar o mostrar todos los montos (útil al enseñar el teléfono). */
export function HideAmountsButton() {
  const { settings, update } = usePrivacy();
  const hidden = settings.hideAmounts;
  return (
    <button
      type="button"
      className="icon-button head-action"
      aria-label="Ocultar montos"
      aria-pressed={hidden}
      onClick={() => update({ hideAmounts: !hidden })}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="M4 4l16 16" />}
      </svg>
    </button>
  );
}
