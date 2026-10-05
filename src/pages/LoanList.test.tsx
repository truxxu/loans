// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { money, renderAt, seed, testLoan, testPayment } from '../test/dom';

const none = { interestType: 'none', interestRate: 0 } as const;

describe('LoanList', () => {
  it('lista vacía', async () => {
    renderAt('/');
    expect(await screen.findByText(/Aún no hay préstamos/)).toBeTruthy();
  });

  it('totales y filtros por estado', async () => {
    await seed(
      [
        testLoan({ id: 'a', borrower: 'Ana', ...none, dueDate: '2025-03-01' }), // en mora
        testLoan({ id: 'b', borrower: 'Beto', ...none, principal: 200_000_00 }), // al día
        testLoan({ id: 'c', borrower: 'Carla', ...none, principal: 50_000_00 }), // pagado
      ],
      [testPayment({ loanId: 'c', amount: 50_000_00 })],
    );
    const { user } = renderAt('/');
    await screen.findByText('Ana');

    expect(screen.getByText(money(1_200_000_00), { selector: '.summary-total' })).toBeTruthy();
    expect(screen.getByText(money(1_000_000_00), { selector: '.summary-value' })).toBeTruthy();
    expect(['Ana', 'Beto', 'Carla'].every((n) => screen.queryByText(n))).toBe(true);

    await user.click(screen.getByRole('button', { name: /En mora/ }));
    expect(screen.queryByText('Ana')).toBeTruthy();
    expect(screen.queryByText('Beto')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Pagados/ }));
    expect(screen.queryByText('Carla')).toBeTruthy();
    expect(screen.queryByText('Ana')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Todos/ }));
    expect(screen.queryByText('Beto')).toBeTruthy();
  });
});
