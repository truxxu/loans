import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { db } from '../db';
import { computeLoanState, nextInterestDate } from '../lib/interest';
import { formatDate, formatMoney } from '../lib/money';
import type { Loan, LoanStatus } from '../types';

function subtitle(loan: Loan, status: LoanStatus): string {
  if (loan.dueDate) return `Vence el ${formatDate(loan.dueDate)}`;
  const next = status === 'paid' ? null : nextInterestDate(loan);
  return next ? `Intereses el ${formatDate(next)}` : 'Sin fecha de vencimiento';
}

export function LoanList() {
  const data = useLiveQuery(async () => {
    const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
    return loans
      .map((loan) => ({ loan, state: computeLoanState(loan, payments) }))
      .sort(
        (a, b) =>
          // Sin vencimiento al final; luego por fecha del préstamo.
          (a.loan.dueDate ?? '9999').localeCompare(b.loan.dueDate ?? '9999') ||
          a.loan.startDate.localeCompare(b.loan.startDate),
      );
  }, []);

  if (!data) return null;

  return (
    <section>
      <div className="row">
        <h1>Préstamos</h1>
        <Link className="button" to="/nuevo">
          Nuevo préstamo
        </Link>
      </div>

      {data.length === 0 ? (
        <p className="empty">Aún no hay préstamos. Registra el primero para empezar a llevar el control.</p>
      ) : (
        <ul className="list">
          {data.map(({ loan, state }) => (
            <li key={loan.id}>
              <Link to={`/prestamo/${loan.id}`} className="list-item">
                <div>
                  <strong>{loan.borrower}</strong>
                  <small>{subtitle(loan, state.status)}</small>
                </div>
                <div className="right">
                  <span className="amount">{formatMoney(state.balance, loan.currency)}</span>
                  <StatusBadge status={state.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
