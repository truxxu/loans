// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { loadReminderSettings } from '../lib/settings';
import { renderAt, seed, testLoan } from '../test/dom';

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
});
