import { useEffect, useRef, useState, type FormEvent } from 'react';
import { deletePayment, newId, savePayment } from '../db';
import { todayISO, type LoanState } from '../lib/interest';
import { amountToInput, parseAmount } from '../lib/money';
import { paymentDateError } from '../lib/validation';
import type { Loan, Payment } from '../types';
import { Money } from './Money';
import { Sheet } from './Sheet';

interface Props {
  loan: Loan;
  state: LoanState;
  /** Pago a editar; sin él se registra uno nuevo. */
  payment?: Payment;
  onClose: () => void;
}

export function PaymentSheet({ loan, state, payment, onClose }: Props) {
  const editing = !!payment;
  const [amount, setAmount] = useState(payment ? amountToInput(payment.amount) : '');
  const [date, setDate] = useState(payment?.date ?? todayISO());
  const [note, setNote] = useState(payment?.note ?? '');
  const [error, setError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

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
    const dateError = paymentDateError(date, loan.startDate, todayISO());
    if (dateError) return setError(dateError);
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
    await deletePayment(payment.id);
    onClose();
  }

  return (
    <Sheet title={editing ? 'Editar pago' : 'Registrar pago'} onClose={onClose} onSubmit={onSubmit}>
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
            <button key={q.label} type="button" className="chip-quick" onClick={() => setAmount(amountToInput(q.value))}>
              {q.label} · <strong>
                <Money value={q.value} currency={loan.currency} />
              </strong>
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
            min={loan.startDate}
            max={todayISO()}
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
    </Sheet>
  );
}
