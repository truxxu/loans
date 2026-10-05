// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { money, renderAt, seed, testLoan, TODAY } from '../test/dom';

describe('LoanFormPage', () => {
  it('crea un préstamo y abre su detalle', async () => {
    const { user } = renderAt('/nuevo');
    await user.type(screen.getByLabelText('Destinatario'), 'Beto');
    await user.type(screen.getByRole('textbox', { name: 'Monto' }), '500.000');
    await user.type(screen.getByLabelText('Tasa (%)'), '2');
    await user.click(screen.getByRole('button', { name: 'Guardar préstamo' }));

    expect(await screen.findByRole('heading', { name: 'Beto' })).toBeTruthy();
    expect(screen.getAllByText(money(500_000_00)).length).toBeGreaterThan(0);
    const [loan] = await db.loans.toArray();
    expect(loan).toMatchObject({ borrower: 'Beto', principal: 500_000_00, interestRate: 2, startDate: TODAY });
  });

  it('muestra el error de validación y no guarda', async () => {
    const { user } = renderAt('/nuevo');
    await user.click(screen.getByRole('button', { name: 'Guardar préstamo' }));
    expect(screen.getByRole('alert').textContent).toBe('Escribe a quién le prestas.');
    expect(await db.loans.count()).toBe(0);
  });

  it('la tasa de mora aparece solo con vencimiento y se guarda', async () => {
    const { user } = renderAt('/nuevo');
    expect(screen.queryByLabelText('Tasa de mora (%)')).toBeNull();
    await user.type(screen.getByLabelText('Destinatario'), 'Beto');
    await user.type(screen.getByRole('textbox', { name: 'Monto' }), '100');
    await user.type(screen.getByLabelText('Tasa (%)'), '2');
    fireEvent.change(screen.getByLabelText('Vencimiento (opcional)'), { target: { value: '2025-06-01' } });
    await user.type(screen.getByLabelText('Tasa de mora (%)'), '4');
    await user.click(screen.getByRole('button', { name: 'Guardar préstamo' }));

    await screen.findByRole('heading', { name: 'Beto' });
    expect(screen.getByText('Interés simple, 2% mensual; mora 4% mensual')).toBeTruthy();
    expect((await db.loans.toArray())[0]).toMatchObject({ dueDate: '2025-06-01', lateInterestRate: 4 });
  });

  it('al editar carga los datos y conserva el id', async () => {
    await seed([testLoan({ notes: 'Para el carro' })]);
    const { user } = renderAt('/prestamo/l1/editar');
    const borrower = await screen.findByDisplayValue('Ana');
    expect(screen.getByDisplayValue('Para el carro')).toBeTruthy();
    await user.clear(borrower);
    await user.type(borrower, 'Ana María');
    await user.click(screen.getByRole('button', { name: 'Guardar préstamo' }));

    await screen.findByRole('heading', { name: 'Ana María' });
    expect(await db.loans.get('l1')).toMatchObject({ borrower: 'Ana María', notes: 'Para el carro' });
  });
});
