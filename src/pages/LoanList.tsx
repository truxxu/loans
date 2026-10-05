import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { db } from '../db';
import { computeLoanState } from '../lib/interest';
import { formatDate, formatMoney } from '../lib/money';

export function LoanList() {
  const data = useLiveQuery(async () => {
    const [loans, payments] = await Promise.all([db.loans.toArray(), db.payments.toArray()]);
    return loans
      .map((loan) => ({ loan, state: computeLoanState(loan, payments) }))
      .sort((a, b) => a.loan.dueDate.localeCompare(b.loan.dueDate));
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
                  <small>Vence el {formatDate(loan.dueDate)}</small>
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
