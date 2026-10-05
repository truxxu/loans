import { useState, type ChangeEvent } from 'react';
import { exportBackup, importBackup } from '../db';
import { notificationsSupported } from '../hooks/useReminders';
import { isLeadDays, loadReminderSettings, saveReminderSettings, type ReminderSettings } from '../lib/settings';

function Reminders() {
  const [settings, setSettings] = useState(loadReminderSettings);
  const [leadText, setLeadText] = useState(String(settings.leadDays));
  const [permission, setPermission] = useState(() => (notificationsSupported() ? Notification.permission : null));

  const update = (next: ReminderSettings) => {
    setSettings(next);
    saveReminderSettings(next);
  };

  async function enable() {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') update({ ...settings, enabled: true });
  }

  function onLeadChange(text: string) {
    setLeadText(text);
    const n = Number(text);
    if (text.trim() && isLeadDays(n)) update({ ...settings, leadDays: n });
  }

  const active = settings.enabled && permission === 'granted';

  return (
    <div className="card card-pad stack-10">
      <h2>Recordatorios</h2>
      <p className="muted small">
        Al abrir la app, una notificación avisa de los préstamos en mora o que vencen pronto. Como mucho una vez al día.
      </p>
      {permission === null ? (
        <p className="alert-warn">
          Este navegador no permite notificaciones. En iPhone, primero agrega la app a la pantalla de inicio.
        </p>
      ) : permission === 'denied' ? (
        <p className="alert-warn">Las notificaciones están bloqueadas. Permítelas en los ajustes del navegador.</p>
      ) : active ? (
        <>
          <label className="field">
            Avisar con anticipación (días)
            <input
              className="input"
              inputMode="numeric"
              value={leadText}
              onChange={(e) => onLeadChange(e.target.value)}
              onBlur={() => setLeadText(String(settings.leadDays))}
            />
          </label>
          <button type="button" className="button button-secondary" onClick={() => update({ ...settings, enabled: false })}>
            Desactivar recordatorios
          </button>
        </>
      ) : (
        <button type="button" className="button" onClick={enable}>
          Activar recordatorios
        </button>
      )}
    </div>
  );
}

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
        <h1>Ajustes</h1>
      </header>
      <Reminders />
      <div className="card card-pad stack-10">
        <h2>Respaldo</h2>
        <p className="muted small">Los datos viven solo en este navegador. Exporta un respaldo con regularidad.</p>
        <button type="button" className="button" onClick={onExport}>
          Exportar respaldo
        </button>
        <label className="button button-secondary">
          Importar respaldo
          <input type="file" accept="application/json" hidden onChange={onImport} />
        </label>
        <span className="muted small center-text">Importar reemplaza todos los datos actuales.</span>
        {message && <p role="status" className="alert-ok">{message}</p>}
      </div>
    </section>
  );
}
