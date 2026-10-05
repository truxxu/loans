import { useState } from 'react';
import { HideAmountsButton } from '../components/HideAmountsButton';
import { LoanCard } from '../components/LoanCard';
import { Money } from '../components/Money';
import { useLoans } from '../hooks/useLoans';
import { todayISO } from '../lib/interest';
import { listTotals, plural, STATUS_LABEL } from '../lib/loanView';
import { formatDate } from '../lib/money';
import type { LoanStatus } from '../types';

type Filter = 'all' | LoanStatus;
const FILTERS: [Filter, string][] = [
  ['all', 'Todos'],
  ['active', STATUS_LABEL.active],
  ['overdue', STATUS_LABEL.overdue],
  ['paid', 'Pagados'],
];

export function LoanList() {
  const items = useLoans();
  const [filter, setFilter] = useState<Filter>('all');

  if (!items) return null;
  const totals = listTotals(items);
  const cop = (v: number) => <Money value={v} currency="COP" />;
  const visible = filter === 'all' ? items : items.filter((i) => i.state.status === filter);

  return (
    <section className="screen">
      <header className="screen-head">
        <span className="muted small">Hoy, {formatDate(todayISO())}</span>
        <h1>Préstamos</h1>
        <HideAmountsButton />
      </header>

      <div className="card summary">
        <div className="stack-4">
          <span className="muted small">Por cobrar</span>
          <span className="summary-total">{cop(totals.outstanding)}</span>
        </div>
        <div className="summary-split">
          <div className="stack-4">
            <span className="muted xsmall">En mora</span>
            <span className="summary-value warn">{cop(totals.overdue)}</span>
            <span className="muted xsmall">{plural(totals.counts.overdue, 'préstamo', 'préstamos')}</span>
          </div>
          <div className="stack-4">
            <span className="muted xsmall">Intereses pendientes</span>
            <span className="summary-value gold">{cop(totals.interest)}</span>
            <span className="muted xsmall">{plural(totals.openCount, 'préstamo abierto', 'préstamos abiertos')}</span>
          </div>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filtrar por estado">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="chip"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="chip-count">
              {key === 'all' ? items.length : totals.counts[key]}
            </span>
          </button>
        ))}
      </div>

      <div className="stack-10">
        {visible.map((item) => (
          <LoanCard key={item.loan.id} item={item} />
        ))}
        {visible.length === 0 && (
          <p className="empty">
            {items.length === 0
              ? 'Aún no hay préstamos. Registra el primero para empezar a llevar el control.'
              : 'No hay préstamos con este estado.'}
          </p>
        )}
      </div>
    </section>
  );
}
