import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { HideAmountsButton } from '../components/HideAmountsButton';
import { Money } from '../components/Money';
import { StatusBadge } from '../components/StatusBadge';
import { useLoans } from '../hooks/useLoans';
import { groupByBorrower, plural } from '../lib/loanView';

export function People() {
  const items = useLoans();
  if (!items) return null;
  const people = groupByBorrower(items);

  return (
    <section className="screen">
      <header className="screen-head">
        <span className="muted small">{plural(people.length, 'persona', 'personas')}</span>
        <h1>Personas</h1>
        <HideAmountsButton />
      </header>
      <div className="stack-10">
        {people.map((p) => (
          <Link key={p.name} to={`/personas/${encodeURIComponent(p.name)}`} className="card card-link person-card">
            <Avatar name={p.name} size="lg" />
            <div className="stack-text">
              <span className="title">{p.name}</span>
              <span className="muted small">{plural(p.items.length, 'préstamo', 'préstamos')}</span>
            </div>
            <div className="loan-card-right">
              <span className="title-sm">
                <Money value={p.balance} currency="COP" />
              </span>
              <StatusBadge status={p.status} />
            </div>
          </Link>
        ))}
        {people.length === 0 && <p className="empty">Aún no hay préstamos registrados.</p>}
      </div>
    </section>
  );
}
