// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { BACKUP_VERSION, type Backup } from '../lib/backup';
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../lib/backupCrypto';
import { hashPin, loadPrivacySettings, savePrivacySettings, verifyPin } from '../lib/privacy';
import { loadReminderSettings } from '../lib/settings';
import { renderAt, seed, testLoan, typePin } from '../test/dom';

const file = (data: unknown) => new File([JSON.stringify(data)], 'respaldo.json', { type: 'application/json' });

describe('Settings', () => {
  it('importar un respaldo con un campo inválido muestra el error y no toca los datos', async () => {
    await seed([testLoan()]);
    const { user } = renderAt('/ajustes');
    const bad = { version: 3, loans: [{ ...testLoan({ id: 'x' }), principal: -1 }], payments: [] };
    await user.upload(screen.getByLabelText('Importar respaldo'), file(bad));

    expect((await screen.findByRole('status')).textContent).toBe('Préstamo 1 (Ana): el monto no es válido.');
    expect((await db.loans.toArray()).map((l) => l.id)).toEqual(['l1']);
  });

  it('importar un respaldo válido reemplaza los datos', async () => {
    await seed([testLoan()]);
    const { user } = renderAt('/ajustes');
    const good = { version: 3, loans: [testLoan({ id: 'x', borrower: 'Beto' })], payments: [] };
    await user.upload(screen.getByLabelText('Importar respaldo'), file(good));

    expect((await screen.findByRole('status')).textContent).toBe('Respaldo importado.');
    expect((await db.loans.toArray()).map((l) => l.borrower)).toEqual(['Beto']);
  });

  it('exportar pide la contraseña dos veces y descarga un respaldo cifrado', async () => {
    await seed([testLoan()]);
    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => ((blob = b as Blob), 'blob:x'));
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderAt('/ajustes');

    await user.click(screen.getByRole('button', { name: 'Exportar respaldo' }));
    const sheet = screen.getByRole('dialog', { name: 'Exportar respaldo' });
    const submit = within(sheet).getByRole('button', { name: 'Exportar respaldo cifrado' });
    await user.type(within(sheet).getByLabelText('Contraseña'), 'corta');
    await user.click(submit);
    expect(within(sheet).getByRole('alert').textContent).toBe('La contraseña debe tener al menos 8 caracteres.');

    await user.type(within(sheet).getByLabelText('Contraseña'), ' pero ya no');
    await user.type(within(sheet).getByLabelText('Repetir contraseña'), 'otra cosa');
    await user.click(submit);
    expect(within(sheet).getByRole('alert').textContent).toBe('Las contraseñas no coinciden.');

    await user.clear(within(sheet).getByLabelText('Repetir contraseña'));
    await user.type(within(sheet).getByLabelText('Repetir contraseña'), 'corta pero ya no');
    await user.click(submit);
    expect((await screen.findByRole('status', {}, { timeout: 5000 })).textContent).toBe('Respaldo cifrado exportado.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(click).toHaveBeenCalled();

    const envelope: unknown = JSON.parse(await blob!.text());
    expect(isEncryptedBackup(envelope)).toBe(true);
    if (!isEncryptedBackup(envelope)) return;
    const backup = (await decryptBackup(envelope, 'corta pero ya no')) as { loans: { id: string }[] };
    expect(backup.loans.map((l) => l.id)).toEqual(['l1']);
  });

  it('importar un respaldo cifrado pide la contraseña y solo reemplaza los datos si es correcta', async () => {
    await seed([testLoan()]);
    const data: Backup = { version: BACKUP_VERSION, exportedAt: '', loans: [testLoan({ id: 'x', borrower: 'Beto' })], payments: [] };
    const envelope = await encryptBackup(data, 'clave secreta', 1000);
    const { user } = renderAt('/ajustes');
    await user.upload(screen.getByLabelText('Importar respaldo'), file(envelope));

    const sheet = await screen.findByRole('dialog', { name: 'Importar respaldo' });
    await user.type(within(sheet).getByLabelText('Contraseña del respaldo'), 'clave equivocada');
    await user.click(within(sheet).getByRole('button', { name: 'Descifrar e importar' }));
    expect((await within(sheet).findByRole('alert')).textContent).toBe('Contraseña incorrecta o archivo dañado.');
    expect((await db.loans.toArray()).map((l) => l.id)).toEqual(['l1']);

    await user.clear(within(sheet).getByLabelText('Contraseña del respaldo'));
    await user.type(within(sheet).getByLabelText('Contraseña del respaldo'), 'clave secreta');
    await user.click(within(sheet).getByRole('button', { name: 'Descifrar e importar' }));
    expect((await screen.findByRole('status')).textContent).toBe('Respaldo importado.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await db.loans.toArray()).map((l) => l.borrower)).toEqual(['Beto']);
  });

  it('sin soporte de notificaciones lo explica en vez de ofrecer activarlas', () => {
    renderAt('/ajustes');
    expect(screen.getByText(/no permite notificaciones/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activar recordatorios' })).toBeNull();
  });

  it('activa los recordatorios pidiendo permiso y guarda la anticipación', async () => {
    const fake = { permission: 'default' as NotificationPermission, requestPermission: vi.fn() };
    const requestPermission = fake.requestPermission.mockImplementation(async () => (fake.permission = 'granted'));
    vi.stubGlobal('Notification', fake);
    const { user } = renderAt('/ajustes');

    await user.click(screen.getByRole('button', { name: 'Activar recordatorios' }));
    expect(requestPermission).toHaveBeenCalled();
    const lead = await screen.findByLabelText('Avisar con anticipación (días)');
    await user.clear(lead);
    await user.type(lead, '5');
    expect(loadReminderSettings()).toEqual({ enabled: true, leadDays: 5 });

    await user.click(screen.getByRole('button', { name: 'Desactivar recordatorios' }));
    expect(loadReminderSettings().enabled).toBe(false);
  });

  it('activa el PIN pidiéndolo dos veces y permite bloquear al momento', async () => {
    const { user } = renderAt('/ajustes');
    await user.click(screen.getByRole('button', { name: 'Activar bloqueo con PIN' }));
    const sheet = screen.getByRole('dialog', { name: 'Activar bloqueo con PIN' });

    await typePin(user, '1234');
    await user.click(within(sheet).getByRole('button', { name: 'Continuar' }));
    await typePin(user, '1235');
    expect(await within(sheet).findByText('Los PIN no coinciden. Inténtalo de nuevo.')).toBeTruthy();

    await typePin(user, '123456'); // seis dígitos: continúa solo
    expect(await within(sheet).findByText('Repite el PIN')).toBeTruthy();
    await typePin(user, '123456');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await verifyPin('123456', loadPrivacySettings().pin!)).toBe(true);

    await user.click(screen.getByRole('button', { name: '5 min' }));
    expect(loadPrivacySettings().lockAfterMs).toBe(300_000);
    await user.click(screen.getByRole('button', { name: 'Bloquear ahora' }));
    expect(screen.getByText('Ingresa tu PIN')).toBeTruthy();
  });

  it('cambiar y quitar el PIN piden el actual', async () => {
    savePrivacySettings({ pin: await hashPin('1111'), lockAfterMs: 60_000, hideAmounts: false });
    const { user } = renderAt('/ajustes');
    await typePin(user, '1111'); // pantalla de bloqueo
    await user.click(await screen.findByRole('button', { name: 'Cambiar PIN' }));

    await typePin(user, '9999');
    expect(await screen.findByText('PIN incorrecto.')).toBeTruthy();
    await typePin(user, '1111');
    await screen.findByText('Elige un PIN de 4 a 6 dígitos');
    await typePin(user, '2222');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await typePin(user, '2222');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await verifyPin('2222', loadPrivacySettings().pin!)).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Quitar PIN' }));
    await typePin(user, '2222');
    await waitFor(() => expect(loadPrivacySettings().pin).toBeNull());
    expect(screen.getByRole('button', { name: 'Activar bloqueo con PIN' })).toBeTruthy();
  });

  it('el interruptor oculta los montos', async () => {
    const { user } = renderAt('/ajustes');
    await user.click(screen.getByRole('checkbox', { name: /Ocultar montos/ }));
    expect(loadPrivacySettings().hideAmounts).toBe(true);
    expect(document.documentElement.classList.contains('hide-amounts')).toBe(true);
  });
});
