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
    URL.revokeObjectURL(url);
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
    <section>
      <h1>Respaldo</h1>
      <p>Los datos viven solo en este navegador. Exporta un respaldo con regularidad.</p>
      <div className="row actions">
        <button className="button" onClick={onExport}>Exportar respaldo</button>
        <label className="button-ghost">
          Importar respaldo
          <input type="file" accept="application/json" hidden onChange={onImport} />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
