import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BACKUP_PASSWORD_MIN, isValidBackupPassword } from '../lib/backupCrypto';

export type BackupPasswordMode = 'export' | 'import';

const TITLE: Record<BackupPasswordMode, string> = {
  export: 'Exportar respaldo',
  import: 'Importar respaldo',
};

interface Props {
  mode: BackupPasswordMode;
  /** Exporta o importa con la contraseña; si lanza, el mensaje se muestra en la hoja. */
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
}

/** Hoja que pide la contraseña del respaldo: dos veces al exportar, una al importar. */
export function BackupPasswordSheet({ mode, onSubmit, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === 'export') {
      if (!isValidBackupPassword(password))
        return setError(`La contraseña debe tener al menos ${BACKUP_PASSWORD_MIN} caracteres.`);
      if (password !== repeat) return setError('Las contraseñas no coinciden.');
    } else if (!password) {
      return setError('Escribe la contraseña del respaldo.');
    }
    setBusy(true);
    try {
      await onSubmit(password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar.');
      setBusy(false);
    }
  }

  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} />
      <form className="sheet" role="dialog" aria-modal="true" aria-label={TITLE[mode]} onSubmit={submit}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{TITLE[mode]}</h2>
          <button type="button" className="link-muted" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p className="muted small">
          {mode === 'export'
            ? 'El archivo se cifra con esta contraseña. Si la olvidas, el respaldo no se puede recuperar.'
            : 'Este respaldo está cifrado. Escribe la contraseña con la que se exportó.'}
        </p>
        <label className="field">
          {mode === 'export' ? 'Contraseña' : 'Contraseña del respaldo'}
          <input
            ref={inputRef}
            type="password"
            className="input input-sunken"
            autoComplete={mode === 'export' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
        </label>
        {mode === 'export' && (
          <label className="field">
            Repetir contraseña
            <input
              type="password"
              className="input input-sunken"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => {
              setRepeat(e.target.value);
              setError('');
            }}
            />
          </label>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="button" disabled={busy}>
          {mode === 'export' ? 'Exportar respaldo cifrado' : 'Descifrar e importar'}
        </button>
      </form>
    </div>
  );
}
