import { useEffect, useRef, useState, type FormEvent } from 'react';
import { db, newId, savePayment } from '../db';
import { todayISO, type LoanState } from '../lib/interest';
import { formatMoney, parseAmount } from '../lib/money';
import type { Loan, Payment } from '../types';

interface Props {
  loan: Loan;
  state: LoanState;
  /** Pago a editar; sin él se registra uno nuevo. */
  payment?: Payment;
  onClose: () => void;
}

export function PaymentSheet({ loan, state, payment, onClose }: Props) {
  const editing = !!payment;
  const [amount, setAmount] = useState(payment ? String(payment.amount / 100) : '');
  const [date, setDate] = useState(payment?.date ?? todayISO());
  const [note, setNote] = useState(payment?.note ?? '');
  const [error, setError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    amountRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const money = (v: number) => formatMoney(v, loan.currency);
  const quick = editing
    ? []
    : [
        { label: 'Interés pendiente', value: state.interestOutstanding },
        { label: 'Saldo total', value: state.balance },
      ].filter((q) => q.value > 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseAmount(amount);
    if (!parsed || parsed <= 0) return setError('El pago debe ser mayor que cero.');
    if (date < loan.startDate) return setError('El pago no puede ser anterior a la fecha del préstamo.');
    await savePayment({
      id: payment?.id ?? newId(),
      loanId: loan.id,
      date,
      amount: parsed,
      note: note.trim() || undefined,
      createdAt: payment?.createdAt ?? Date.now(),
    });
    onClose();
  }

  async function onDelete() {
    if (!payment || !confirm('¿Eliminar este pago?')) return;
    await db.payments.delete(payment.id);
    onClose();
  }

  const title = editing ? 'Editar pago' : 'Registrar pago';

  return (
    <div className="sheet-layer">
      <div className="sheet-backdrop" onClick={onClose} />
      <form className="sheet" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="link-muted" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <label className="amount-big">
          <span className="sr-only">Monto</span>
          <span className="amount-symbol" aria-hidden="true">$</span>
          <input
            ref={amountRef}
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
          />
        </label>
        {quick.length > 0 && (
          <div className="chips-wrap">
            {quick.map((q) => (
              <button key={q.label} type="button" className="chip-quick" onClick={() => setAmount(String(q.value / 100))}>
                {q.label} · <strong>{money(q.value)}</strong>
              </button>
            ))}
          </div>
        )}
        <div className="grid-sheet">
          <label className="field">
            Fecha
            <input
              type="date"
              className="input input-sunken"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setError('');
              }}
            />
          </label>
          <label className="field">
            Nota
            <input
              className="input input-sunken"
              placeholder="Opcional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="stack-6">
          <button type="submit" className="button">
            {editing ? 'Guardar cambios' : 'Registrar pago'}
          </button>
          {editing && (
            <button type="button" className="button-danger" onClick={onDelete}>
              Eliminar pago
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
