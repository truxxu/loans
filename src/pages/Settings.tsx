import { useState, type ChangeEvent } from 'react';
import { BackupPasswordSheet } from '../components/BackupPasswordSheet';
import { PinSheet, type PinSheetMode } from '../components/PinSheet';
import { exportEncryptedBackup, importBackup } from '../db';
import { usePrivacy } from '../hooks/usePrivacy';
import { notificationsSupported } from '../hooks/useReminders';
import { decryptBackup, isEncryptedBackup, type EncryptedBackup } from '../lib/backupCrypto';
import { LOCK_AFTER_OPTIONS } from '../lib/privacy';
import { isLeadDays, loadReminderSettings, saveReminderSettings, type ReminderSettings } from '../lib/settings';

function Privacy() {
  const { settings, update, lock } = usePrivacy();
  const [sheet, setSheet] = useState<PinSheetMode | null>(null);

  return (
    <div className="card card-pad stack-10">
      <h2>Privacidad</h2>
      <label className="switch-row">
        <span className="stack-2">
          <span>Ocultar montos</span>
          <span className="muted small">Difumina las cifras. También desde el ojo en Préstamos y Personas.</span>
        </span>
        <input
          type="checkbox"
          className="switch"
          checked={settings.hideAmounts}
          onChange={(e) => update({ hideAmounts: e.target.checked })}
        />
      </label>
      {settings.pin ? (
        <>
          <div className="field">
            <span id="lock-after">Pedir el PIN al volver a la app</span>
            <div className="segmented" role="group" aria-labelledby="lock-after">
              {LOCK_AFTER_OPTIONS.map(([ms, label]) => (
                <button
                  key={ms}
                  type="button"
                  className="seg-option"
                  aria-pressed={settings.lockAfterMs === ms}
                  onClick={() => update({ lockAfterMs: ms })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="button" onClick={lock}>
            Bloquear ahora
          </button>
          <button type="button" className="button button-secondary" onClick={() => setSheet('change')}>
            Cambiar PIN
          </button>
          <button type="button" className="button-danger" onClick={() => setSheet('remove')}>
            Quitar PIN
          </button>
        </>
      ) : (
        <>
          <p className="muted small">
            Pide un PIN al abrir la app y al volver después de un rato. Si lo olvidas, solo se puede borrar todo y
            restaurar un respaldo.
          </p>
          <button type="button" className="button" onClick={() => setSheet('create')}>
            Activar bloqueo con PIN
          </button>
        </>
      )}
      {sheet && <PinSheet mode={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

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

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // Revocar de inmediato puede cancelar la descarga (iOS Safari, PWA instalada).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type BackupSheet = { mode: 'export' } | { mode: 'import'; envelope: EncryptedBackup };

export function Settings() {
  const [message, setMessage] = useState('');
  const [sheet, setSheet] = useState<BackupSheet | null>(null);

  async function onExport(password: string) {
    const envelope = await exportEncryptedBackup(password);
    download(`prestamos-${new Date().toISOString().slice(0, 10)}-cifrado.json`, JSON.stringify(envelope));
    setMessage('Respaldo cifrado exportado.');
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('Importar reemplaza todos los datos actuales. ¿Continuar?')) return;
    setMessage('');
    try {
      const raw: unknown = JSON.parse(await file.text());
      // Los respaldos anteriores al cifrado siguen importándose en claro.
      if (isEncryptedBackup(raw)) return setSheet({ mode: 'import', envelope: raw });
      await importBackup(raw);
      setMessage('Respaldo importado.');
    } catch (err) {
      setMessage(err instanceof Error && !(err instanceof SyntaxError) ? err.message : 'No se pudo leer el archivo.');
    }
  }

  async function onDecrypt(envelope: EncryptedBackup, password: string) {
    // Contraseña incorrecta: el error queda en la hoja para reintentar.
    const raw = await decryptBackup(envelope, password);
    try {
      await importBackup(raw);
      setMessage('Respaldo importado.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'No se pudo importar el respaldo.');
    }
  }

  return (
    <section className="screen">
      <header className="screen-head">
        <h1>Ajustes</h1>
      </header>
      <Privacy />
      <Reminders />
      <div className="card card-pad stack-10">
        <h2>Respaldo</h2>
        <p className="muted small">
          Los datos viven solo en este navegador. Exporta un respaldo con regularidad: se cifra con una contraseña que
          debes guardar en un lugar seguro.
        </p>
        <button type="button" className="button" onClick={() => setSheet({ mode: 'export' })}>
          Exportar respaldo
        </button>
        <label className="button button-secondary">
          Importar respaldo
          <input type="file" accept="application/json" hidden onChange={onImport} />
        </label>
        <span className="muted small center-text">Importar reemplaza todos los datos actuales.</span>
        {message && <p role="status" className="alert-ok">{message}</p>}
      </div>
      {sheet && (
        <BackupPasswordSheet
          mode={sheet.mode}
          onSubmit={(password) => (sheet.mode === 'export' ? onExport(password) : onDecrypt(sheet.envelope, password))}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  );
}
