import { Link } from 'react-router-dom';
import { paidPct, subtitle, type LoanItem } from '../lib/loanView';
import { formatMoney } from '../lib/money';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';

/**
 * Tarjeta de préstamo. En la vista de una persona (`from`) se omite el nombre y se
 * muestra el monto prestado; el detalle vuelve a esa persona.
 */
export function LoanCard({ item, from }: { item: LoanItem; from?: string }) {
  const { loan, state } = item;
  const progress = paidPct(item);
  return (
    <Link to={`/prestamo/${loan.id}`} state={from ? { from } : undefined} className="card card-link loan-card">
      <div className="loan-card-top">
        {!from && <Avatar name={loan.borrower} />}
        <div className="stack-text">
          <span className="title ellipsis">
            {from ? `${formatMoney(loan.principal, loan.currency)} prestados` : loan.borrower}
          </span>
          <span className="muted small">{subtitle(loan, state.status)}</span>
        </div>
        <div className="loan-card-right">
          <span className="title">{formatMoney(state.balance, loan.currency)}</span>
          <StatusBadge status={state.status} />
        </div>
      </div>
      <div className="progress-row">
        <div className="progress">
          <div style={{ width: progress }} />
        </div>
        <span className="muted xsmall">{progress} del capital</span>
      </div>
    </Link>
  );
}
