// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { hashPin, loadPinAttempts, loadPrivacySettings, savePinAttempts, savePrivacySettings } from '../lib/privacy';
import { renderAt, seed, testLoan, TODAY, typePin } from '../test/dom';

const PIN = '2580';

async function withPin(lockAfterMs = 60_000) {
  savePrivacySettings({ pin: await hashPin(PIN), lockAfterMs, hideAmounts: false });
}

let visibility: DocumentVisibilityState = 'visible';
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

const at = (time: string) => new Date(`${TODAY}T${time}`);

afterEach(() => {
  visibility = 'visible';
});

describe('Bloqueo con PIN', () => {
  it('sin PIN no hay bloqueo', async () => {
    await seed([testLoan()]);
    renderAt('/');
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.queryByText('Ingresa tu PIN')).toBeNull();
  });

  it('con PIN pide el código y no muestra datos hasta acertarlo', async () => {
    await seed([testLoan()]);
    await withPin();
    const { user } = renderAt('/');

    expect(screen.getByText('Ingresa tu PIN')).toBeTruthy();
    expect(screen.queryByText('Ana')).toBeNull();

    await typePin(user, '1111');
    expect(await screen.findByText('PIN incorrecto.')).toBeTruthy();
    expect(screen.queryByText('Ana')).toBeNull();

    await typePin(user, PIN);
    expect(await screen.findByText('Ana')).toBeTruthy();
  });

  it('acepta el teclado físico', async () => {
    await seed([testLoan()]);
    await withPin();
    const { user } = renderAt('/');
    await user.keyboard(PIN);
    expect(await screen.findByText('Ana')).toBeTruthy();
  });

  it('tras cinco fallos hace esperar, también después de recargar', async () => {
    await withPin();
    const { user, unmount } = renderAt('/');
    for (let i = 1; i <= 5; i++) {
      await typePin(user, '0000');
      await waitFor(() => expect(loadPinAttempts().failed).toBe(i));
      await waitFor(() => expect(screen.getByRole('button', { name: '0' }).hasAttribute('disabled')).toBe(i === 5));
    }
    expect(screen.getByRole('alert').textContent).toBe('Demasiados intentos. Espera 30 s.');

    unmount();
    renderAt('/');
    expect(screen.getByRole('alert').textContent).toBe('Demasiados intentos. Espera 30 s.');
    expect(screen.getByRole('button', { name: '1' }).hasAttribute('disabled')).toBe(true);
  });

  it('vuelve a bloquear si estuvo en segundo plano más del tiempo configurado', async () => {
    await seed([testLoan()]);
    await withPin(60_000);
    const { user, container } = renderAt('/');
    await typePin(user, PIN);
    await screen.findByText('Ana');

    // Menos de un minuto fuera: sigue abierta. Mientras está oculta se ve el velo.
    setVisibility('hidden');
    expect(container.ownerDocument.querySelector('.privacy-veil')).toBeTruthy();
    setVisibility('visible');
    expect(container.ownerDocument.querySelector('.privacy-veil')).toBeNull();
    expect(screen.getByText('Ana')).toBeTruthy();

    setVisibility('hidden');
    vi.setSystemTime(at('12:01:30'));
    setVisibility('visible');
    expect(screen.getByText('Ingresa tu PIN')).toBeTruthy();
    expect(screen.queryByText('Ana')).toBeNull();
  });

  it('abrir el selector de archivos para importar no vuelve a bloquear al volver', async () => {
    await withPin(0);
    const { user } = renderAt('/ajustes');
    await typePin(user, PIN);
    const input = await screen.findByLabelText('Importar respaldo');

    // El selector oculta la página (Android): al volver sigue abierta en Ajustes.
    act(() => input.click());
    setVisibility('hidden');
    vi.setSystemTime(at('12:00:20'));
    setVisibility('visible');
    expect(screen.getByLabelText('Importar respaldo')).toBeTruthy();

    // La excepción vale solo para esa salida: la siguiente bloquea como siempre.
    setVisibility('hidden');
    setVisibility('visible');
    expect(screen.getByText('Ingresa tu PIN')).toBeTruthy();
  });

  it('"Olvidé el PIN" borra todos los datos y los ajustes', async () => {
    await seed([testLoan()]);
    await withPin();
    savePinAttempts({ failed: 3, lockedUntil: 0 });
    const { user } = renderAt('/');

    await user.click(screen.getByRole('button', { name: 'Olvidé el PIN' }));
    expect(await screen.findByText(/Aún no hay préstamos/)).toBeTruthy();
    expect(await db.loans.count()).toBe(0);
    expect(loadPrivacySettings().pin).toBeNull();
    expect(localStorage.getItem('prestamos:privacy:attempts')).toBeNull();
  });
});

describe('Ocultar montos', () => {
  it('el ojo difumina los montos y recuerda la preferencia', async () => {
    await seed([testLoan()]);
    const { user } = renderAt('/');
    await screen.findByText('Ana');
    const eye = screen.getByRole('button', { name: 'Ocultar montos' });

    await user.click(eye);
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.classList.contains('hide-amounts')).toBe(true);
    expect(loadPrivacySettings().hideAmounts).toBe(true);

    await user.click(eye);
    expect(document.documentElement.classList.contains('hide-amounts')).toBe(false);
  });
});
