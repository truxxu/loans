import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LoanNotFound } from '../components/LoanNotFound';
import { PaymentSheet } from '../components/PaymentSheet';
import { StatusBadge } from '../components/StatusBadge';
import { db, deleteLoan } from '../db';
import { loanDetail, plural, sharePct } from '../lib/loanView';
import { formatDate, formatMoney } from '../lib/money';
import type { Payment } from '../types';

/** `undefined` = cerrada; `null` = registrar pago nuevo; Payment = editar ese pago. */
type SheetState = Payment | null | undefined;

export function LoanDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const backTo = from ? `/personas/${encodeURIComponent(from)}` : '/';
  const [sheet, setSheet] = useState<SheetState>(undefined);

  const data = useLiveQuery(async () => {
    const loan = await db.loans.get(id);
    if (!loan) return { loan: null } as const;
    const payments = await db.payments.where('loanId').equals(id).toArray();
    return { loan, view: loanDetail(loan, payments) } as const;
  }, [id]);

  if (!data) return null;
  if (!data.loan) return <LoanNotFound />;
  const { loan, view } = data;
  const { state } = view;
  const money = (v: number) => formatMoney(v, loan.currency);

  const facts: [string, string][] = [
    ['Prestado', `${money(loan.principal)} el ${formatDate(loan.startDate)}`],
    ['Condiciones', view.conditions],
    ['Fecha de vencimiento', view.dueText],
    ...(view.projected !== null ? [['Total al vencimiento sin abonos', money(view.projected)] as [string, string]] : []),
    ['Total pagado', money(state.totalPaid)],
    ...(loan.notes ? [['Notas', loan.notes] as [string, string]] : []),
  ];
  const history = [...state.ledger].reverse();

  async function removeLoan() {
    if (!confirm(`¿Eliminar el préstamo de ${loan.borrower} y todos sus pagos?`)) return;
    await deleteLoan(loan.id);
    navigate(backTo, { replace: true });
  }

  return (
    <>
      <section className="screen screen-sub detail">
        <div className="topnav">
          <Link to={backTo} className="back">‹ {from ?? 'Préstamos'}</Link>
          <Link to={`/prestamo/${loan.id}/editar`} className="pill-button">Editar</Link>
        </div>

        <div className="stack-10">
          <div className="title-row">
            <h1 className="h1-xs">{loan.borrower}</h1>
            <StatusBadge status={state.status} />
          </div>
          <div className="stack-2 balance-block">
            <span className="muted small">Saldo a hoy</span>
            <span className="balance">{money(state.balance)}</span>
          </div>
        </div>

        <div className="stack-12">
          <div className="split-bar" aria-hidden="true">
            <div className="brand-bg" style={{ width: sharePct(state.principalOutstanding, state.balance) }} />
            <div className="gold-bg" style={{ width: sharePct(state.interestOutstanding, state.balance) }} />
          </div>
          <div className="grid-2">
            <div className="stack-2">
              <span className="legend"><span className="swatch brand-bg" />Capital pendiente</span>
              <span className="title-sm">{money(state.principalOutstanding)}</span>
            </div>
            <div className="stack-2">
              <span className="legend"><span className="swatch gold-bg" />Interés pendiente</span>
              <span className="title-sm">{money(state.interestOutstanding)}</span>
            </div>
          </div>
        </div>

        {view.nextInterest && (
          <div className="card card-pad stack-10">
            <div className="next-row">
              <div className="stack-3">
                <span className="muted xsmall">Próximo pago de intereses</span>
                <span className="title-sm">{formatDate(view.nextInterest.date)}</span>
                <span className="muted xsmall">Cada {loan.interestPeriodDays} días</span>
              </div>
              <span className="next-amount">{money(view.nextInterest.amount)}</span>
            </div>
            {view.interestLateSince && (
              <div className="alert-warn">Intereses sin pagar desde el {formatDate(view.interestLateSince)}</div>
            )}
          </div>
        )}

        <dl className="card facts">
          {facts.map(([dt, dd]) => (
            <div key={dt}>
              <dt>{dt}</dt>
              <dd>{dd}</dd>
            </div>
          ))}
        </dl>

        <div className="stack-10">
          <div className="section-head">
            <h2>Historial de pagos</h2>
            <span className="muted small">{plural(history.length, 'pago', 'pagos')}</span>
          </div>
          {history.map((entry) => (
            <button
              key={entry.payment.id}
              type="button"
              className="card card-link payment-card"
              aria-label={`Editar pago del ${formatDate(entry.payment.date)}`}
              onClick={() => setSheet(entry.payment)}
            >
              <div className="payment-top">
                <div className="stack-2 min0">
                  <span className="payment-date">{formatDate(entry.payment.date)}</span>
                  {entry.payment.note && <span className="muted small">{entry.payment.note}</span>}
                </div>
                <span className="payment-amount">{money(entry.payment.amount)}</span>
              </div>
              <div className="split-bar thin" aria-hidden="true">
                <div className="gold-bg" style={{ width: sharePct(entry.toInterest, entry.payment.amount) }} />
                <div className="brand-bg" style={{ width: sharePct(entry.toPrincipal, entry.payment.amount) }} />
              </div>
              <div className="payment-grid">
                <div className="stack-2"><span className="muted">A interés</span><span>{money(entry.toInterest)}</span></div>
                <div className="stack-2"><span className="muted">A capital</span><span>{money(entry.toPrincipal)}</span></div>
                <div className="stack-2 right"><span className="muted">Saldo</span><span>{money(entry.balanceAfter)}</span></div>
              </div>
            </button>
          ))}
          {history.length === 0 && <p className="empty">Todavía no hay pagos registrados.</p>}
        </div>

        <button type="button" className="button-danger center" onClick={removeLoan}>
          Eliminar préstamo
        </button>
      </section>

      <div className="sticky-cta">
        <button type="button" className="button" onClick={() => setSheet(null)}>
          Registrar pago
        </button>
      </div>

      {sheet !== undefined && (
        <PaymentSheet
          key={sheet?.id ?? 'new'}
          loan={loan}
          state={state}
          payment={sheet ?? undefined}
          onClose={() => setSheet(undefined)}
        />
      )}
    </>
  );
}
