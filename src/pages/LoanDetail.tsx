import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { db, deleteLoan, newId } from '../db';
import { computeLoanState, projectedTotalAtDue, todayISO } from '../lib/interest';
import { formatDate, formatMoney, parseAmount } from '../lib/money';

const RATE_LABEL = { monthly: 'mensual', annual: 'anual' } as const;
const TYPE_LABEL = { none: 'Sin interés', simple: 'Interés simple', compound: 'Interés compuesto' } as const;

export function LoanDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const loan = await db.loans.get(id);
    if (!loan) return { loan: null } as const;
    const payments = await db.payments.where('loanId').equals(id).toArray();
    return { loan, state: computeLoanState(loan, payments) } as const;
  }, [id]);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!data) return null;
  if (!data.loan) return <p className="empty">Este préstamo no existe. <Link to="/">Volver a la lista</Link></p>;
  const { loan, state } = data;
  const money = (v: number) => formatMoney(v, loan.currency);

  async function addPayment(e: FormEvent) {
    e.preventDefault();
    const parsed = parseAmount(amount);
    if (!parsed || parsed <= 0) return setError('El pago debe ser mayor que cero.');
    if (date < loan.startDate) return setError('El pago no puede ser anterior a la fecha del préstamo.');
    await db.payments.add({
      id: newId(),
      loanId: loan.id,
      date,
      amount: parsed,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    });
    setAmount('');
    setNote('');
    setError('');
  }

  async function removeLoan() {
    if (!confirm(`¿Eliminar el préstamo de ${loan.borrower} y todos sus pagos?`)) return;
    await deleteLoan(loan.id);
    navigate('/', { replace: true });
  }

  return (
    <section>
      <div className="row">
        <h1>{loan.borrower}</h1>
        <StatusBadge status={state.status} />
      </div>

      <p className="balance">{money(state.balance)}</p>
      <dl className="facts">
        <div><dt>Capital pendiente</dt><dd>{money(state.principalOutstanding)}</dd></div>
        <div><dt>Interés pendiente</dt><dd>{money(state.interestOutstanding)}</dd></div>
        <div><dt>Prestado</dt><dd>{money(loan.principal)} el {formatDate(loan.startDate)}</dd></div>
        <div>
          <dt>Condiciones</dt>
          <dd>
            {TYPE_LABEL[loan.interestType]}
            {loan.interestType !== 'none' && `, ${loan.interestRate}% ${RATE_LABEL[loan.ratePeriod]}`}
          </dd>
        </div>
        <div>
          <dt>Fecha de pago</dt>
          <dd>
            {formatDate(loan.dueDate)}
            {state.status !== 'paid' &&
              (state.daysToDue >= 0 ? ` (faltan ${state.daysToDue} días)` : ` (${-state.daysToDue} días en mora)`)}
          </dd>
        </div>
        <div><dt>Total al vencimiento sin abonos</dt><dd>{money(projectedTotalAtDue(loan))}</dd></div>
        <div><dt>Total pagado</dt><dd>{money(state.totalPaid)}</dd></div>
        {loan.notes && <div><dt>Notas</dt><dd>{loan.notes}</dd></div>}
      </dl>

      <h2>Registrar pago</h2>
      <form onSubmit={addPayment} className="form">
        <div className="grid-2">
          <label>
            Monto
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            Fecha
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label>
          Nota
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="button">Registrar pago</button>
      </form>

      <h2>Historial de pagos</h2>
      {state.ledger.length === 0 ? (
        <p className="empty">Todavía no hay pagos registrados.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fecha</th><th>Pago</th><th>A interés</th><th>A capital</th><th>Saldo</th><th /></tr>
            </thead>
            <tbody>
              {[...state.ledger].reverse().map((entry) => (
                <tr key={entry.payment.id}>
                  <td>
                    {formatDate(entry.payment.date)}
                    {entry.payment.note && <small>{entry.payment.note}</small>}
                  </td>
                  <td>{money(entry.payment.amount)}</td>
                  <td>{money(entry.toInterest)}</td>
                  <td>{money(entry.toPrincipal)}</td>
                  <td>{money(entry.balanceAfter)}</td>
                  <td>
                    <button
                      className="button-ghost"
                      aria-label="Eliminar pago"
                      onClick={() => confirm('¿Eliminar este pago?') && db.payments.delete(entry.payment.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row actions">
        <Link className="button-ghost" to={`/prestamo/${loan.id}/editar`}>Editar préstamo</Link>
        <button className="button-ghost danger" onClick={removeLoan}>Eliminar préstamo</button>
      </div>
    </section>
  );
}
