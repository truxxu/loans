import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { LoanCard } from '../components/LoanCard';
import { useLoans } from '../hooks/useLoans';
import { groupByBorrower, plural } from '../lib/loanView';
import { formatMoney } from '../lib/money';

export function Person() {
  const { name = '' } = useParams();
  const items = useLoans();
  if (!items) return null;
  const person = groupByBorrower(items).find((p) => p.name === name);

  return (
    <section className="screen screen-sub">
      <div className="topnav">
        <Link to="/personas" className="back">‹ Personas</Link>
      </div>
      {!person ? (
        <p className="empty">No hay préstamos a nombre de {name}.</p>
      ) : (
        <>
          <div className="person-head">
            <Avatar name={person.name} size="xl" />
            <div className="stack-2">
              <h1 className="h1-sm">{person.name}</h1>
              <span className="muted small">{plural(person.items.length, 'préstamo', 'préstamos')}</span>
            </div>
          </div>
          <div className="card summary-simple">
            <span className="muted small">Saldo total</span>
            <span className="person-total">{formatMoney(person.balance, 'COP')}</span>
          </div>
          <div className="stack-10">
            {person.items.map((item) => (
              <LoanCard key={item.loan.id} item={item} from={person.name} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
