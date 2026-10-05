import { useState, type ChangeEvent } from 'react';
import { exportBackup, importBackup } from '../db';

export function Settings() {
  const [message, setMessage] = useState('');

  async function onExport() {
    const backup = await exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `prestamos-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    // Revocar de inmediato puede cancelar la descarga (iOS Safari, PWA instalada).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('Importar reemplaza todos los datos actuales. ¿Continuar?')) return;
    try {
      await importBackup(JSON.parse(await file.text()));
      setMessage('Respaldo importado.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo leer el archivo.');
    }
  }

  return (
    <section className="screen">
      <header className="screen-head">
        <h1>Respaldo</h1>
      </header>
      <p className="lead">Los datos viven solo en este navegador. Exporta un respaldo con regularidad.</p>
      <div className="stack-10">
        <button type="button" className="button" onClick={onExport}>
          Exportar respaldo
        </button>
        <label className="button button-secondary">
          Importar respaldo
          <input type="file" accept="application/json" hidden onChange={onImport} />
        </label>
        <span className="muted small center-text">Importar reemplaza todos los datos actuales.</span>
      </div>
      {message && <p role="status" className="alert-ok">{message}</p>}
    </section>
  );
}
