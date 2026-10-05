// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { money, renderAt, seed, testLoan, testPayment } from '../test/dom';

// 1.000.000 al 2% mensual simple desde hace 60 días; abono de 100.000 a los 30 días:
// 20.000 a interés y 80.000 a capital; luego 30 días sobre 920.000 = 18.400.
const balanceText = () => document.querySelector('.balance')?.textContent?.replace(/\s/g, ' ');

describe('LoanDetail', () => {
  it('muestra el saldo derivado y el desglose del pago', async () => {
    await seed([testLoan()], [testPayment()]);
    renderAt('/prestamo/l1');
    await screen.findByRole('heading', { name: 'Ana' });
    expect(balanceText()).toBe(money(938_400_00));
    const entry = screen.getByRole('button', { name: /Editar pago del/ });
    expect(within(entry).getByText(money(20_000_00))).toBeTruthy();
    expect(within(entry).getByText(money(80_000_00))).toBeTruthy();
  });

  it('registra un pago desde la hoja inferior y recalcula el saldo', async () => {
    await seed([testLoan()]);
    const { user } = renderAt('/prestamo/l1');
    await screen.findByRole('heading', { name: 'Ana' });
    expect(balanceText()).toBe(money(1_040_000_00));

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));
    const sheet = screen.getByRole('dialog', { name: 'Registrar pago' });
    await user.click(within(sheet).getByRole('button', { name: /Interés pendiente/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Registrar pago' }));

    expect(await screen.findByText('1 pago')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(balanceText()).toBe(money(1_000_000_00));
    expect((await db.payments.toArray())[0]).toMatchObject({ amount: 40_000_00, date: '2025-03-10' });
  });

  it('valida el monto del pago', async () => {
    await seed([testLoan()]);
    const { user } = renderAt('/prestamo/l1');
    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    const sheet = screen.getByRole('dialog');
    await user.click(within(sheet).getByRole('button', { name: 'Registrar pago' }));
    expect(within(sheet).getByRole('alert').textContent).toBe('El pago debe ser mayor que cero.');
  });

  it('edita y elimina un pago existente', async () => {
    await seed([testLoan()], [testPayment()]);
    const { user } = renderAt('/prestamo/l1');
    await user.click(await screen.findByRole('button', { name: /Editar pago del/ }));
    const sheet = screen.getByRole('dialog', { name: 'Editar pago' });
    const amount = within(sheet).getByRole('textbox', { name: 'Monto' });
    await user.clear(amount);
    await user.type(amount, '20000');
    await user.click(within(sheet).getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByText(money(20_000_00), { selector: '.payment-amount' });
    expect((await db.payments.get('p1'))?.amount).toBe(20_000_00);

    await user.click(screen.getByRole('button', { name: /Editar pago del/ }));
    await user.click(screen.getByRole('button', { name: 'Eliminar pago' }));
    expect(await screen.findByText('Todavía no hay pagos registrados.')).toBeTruthy();
    expect(await db.payments.count()).toBe(0);
  });

  it('préstamo inexistente', async () => {
    renderAt('/prestamo/nada');
    expect(await screen.findByText(/Este préstamo no existe/)).toBeTruthy();
  });
});
