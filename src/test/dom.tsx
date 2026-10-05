import { cleanup, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db } from '../db';
import { PrivacyProvider } from '../hooks/usePrivacy';
import { formatMoney } from '../lib/money';
import { LoanDetail } from '../pages/LoanDetail';
import { LoanFormPage } from '../pages/LoanFormPage';
import { LoanList } from '../pages/LoanList';
import { Settings } from '../pages/Settings';
import type { Loan, Payment } from '../types';

/**
 * Utilidades para tests de componentes (archivos `*.test.tsx` con
 * `// @vitest-environment jsdom`). Importar este módulo registra la limpieza entre tests:
 * IndexedDB falsa y `localStorage` vacíos, `confirm` aceptado y "hoy" fijo en `TODAY`.
 */

export const TODAY = '2025-03-10';

beforeEach(async () => {
  // Solo se finge Date: Dexie y user-event necesitan timers reales.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  localStorage.clear();
  await Promise.all([db.loans.clear(), db.payments.clear()]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Monta las rutas de la app en `path` dentro de `PrivacyProvider`, sin `App` (que registra
 * el service worker).
 * Devuelve también un `user` de user-event.
 */
export function renderAt(path: string) {
  const user = userEvent.setup();
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <PrivacyProvider>
        <Routes>
          <Route path="/" element={<LoanList />} />
          <Route path="/nuevo" element={<LoanFormPage />} />
          <Route path="/prestamo/:id" element={<LoanDetail />} />
          <Route path="/prestamo/:id/editar" element={<LoanFormPage />} />
          <Route path="/ajustes" element={<Settings />} />
        </Routes>
      </PrivacyProvider>
    </MemoryRouter>,
  );
  return { user, ...view };
}

export const testLoan = (over: Partial<Loan> = {}): Loan => ({
  id: 'l1',
  borrower: 'Ana',
  principal: 1_000_000_00,
  currency: 'COP',
  interestRate: 2,
  ratePeriod: 'monthly',
  interestType: 'simple',
  startDate: '2025-01-09', // 60 días antes de TODAY
  interestPeriodDays: 30,
  createdAt: 0,
  ...over,
});

export const testPayment = (over: Partial<Payment> = {}): Payment => ({
  id: 'p1',
  loanId: 'l1',
  date: '2025-02-08',
  amount: 100_000_00,
  createdAt: 0,
  ...over,
});

/**
 * Monto en COP tal como lo compara Testing Library: su normalizador convierte el espacio
 * duro de `Intl.NumberFormat` en espacio normal en el DOM, pero no en el texto esperado.
 */
export const money = (minor: number) => formatMoney(minor, 'COP').replace(/\s/g, ' ');

export async function seed(loans: Loan[], payments: Payment[] = []) {
  await db.loans.bulkAdd(loans);
  await db.payments.bulkAdd(payments);
}

/** Escribe un PIN en el teclado numérico (pantalla de bloqueo u hoja del PIN). */
export async function typePin(user: UserEvent, pin: string) {
  for (const d of pin) await user.click(screen.getByRole('button', { name: d }));
}
