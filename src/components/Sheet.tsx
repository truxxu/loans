import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  /** Con él, la hoja es un `<form>`. */
  onSubmit?: (e: FormEvent) => void;
  children: ReactNode;
}

/** Hoja inferior: fondo que cierra, encabezado con "Cerrar" y Escape. */
export function Sheet({ title, onClose, onSubmit, children }: Props) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const body = (
    <>
      <div className="sheet-handle" aria-hidden="true" />
      <div className="sheet-head">
        <h2>{title}</h2>
        <button type="button" className="link-muted" onClick={onClose}>
          Cerrar
        </button>
      </div>
      {children}
    </>
  );

  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} />
      {onSubmit ? (
        <form className="sheet" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}>
          {body}
        </form>
      ) : (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
          {body}
        </div>
      )}
    </div>
  );
}
