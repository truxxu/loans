import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, newId } from '../db';
import { todayISO } from '../lib/interest';
import { parseAmount } from '../lib/money';
import { DEFAULT_INTEREST_PERIOD_DAYS, type Currency, type InterestType, type Loan, type RatePeriod } from '../types';

interface FormState {
  borrower: string;
  principal: string;
  currency: Currency;
  interestType: InterestType;
  interestRate: string;
  ratePeriod: RatePeriod;
  interestPeriodDays: string;
  startDate: string;
  dueDate: string;
  notes: string;
}

const empty = (): FormState => ({
  borrower: '',
  principal: '',
  currency: 'COP',
  interestType: 'simple',
  interestRate: '',
  ratePeriod: 'monthly',
  interestPeriodDays: String(DEFAULT_INTEREST_PERIOD_DAYS),
  startDate: todayISO(),
  dueDate: '',
  notes: '',
});

export function LoanFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [existing, setExisting] = useState<Loan | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void db.loans.get(id).then((loan) => {
      if (!loan) return;
      setExisting(loan);
      setForm({
        borrower: loan.borrower,
        principal: String(loan.principal / 100),
        currency: loan.currency,
        interestType: loan.interestType,
        interestRate: String(loan.interestRate),
        ratePeriod: loan.ratePeriod,
        interestPeriodDays: String(loan.interestPeriodDays),
        startDate: loan.startDate,
        dueDate: loan.dueDate ?? '',
        notes: loan.notes ?? '',
      });
    });
  }, [id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const principal = parseAmount(form.principal);
    const hasInterest = form.interestType !== 'none';
    const rate = hasInterest ? Number(form.interestRate.replace(',', '.')) : 0;
    const interestPeriodDays = hasInterest ? Number(form.interestPeriodDays) : DEFAULT_INTEREST_PERIOD_DAYS;

    if (!form.borrower.trim()) return setError('Escribe a quién le prestas.');
    if (!principal || principal <= 0) return setError('El monto debe ser mayor que cero.');
    if (hasInterest && !(rate > 0)) return setError('La tasa debe ser mayor que cero.');
    if (!Number.isInteger(interestPeriodDays) || interestPeriodDays < 1)
      return setError('El periodo de pago de intereses debe ser un número entero de días.');
    if (form.dueDate && form.dueDate < form.startDate)
      return setError('La fecha de vencimiento debe ser igual o posterior a la fecha del préstamo.');

    const loan: Loan = {
      id: existing?.id ?? newId(),
      borrower: form.borrower.trim(),
      principal,
      currency: form.currency,
      interestType: form.interestType,
      interestRate: rate,
      ratePeriod: form.ratePeriod,
      interestPeriodDays,
      startDate: form.startDate,
      dueDate: form.dueDate || undefined,
      notes: form.notes.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await db.loans.put(loan);
    navigate(`/prestamo/${loan.id}`, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <h1>{existing ? 'Editar préstamo' : 'Nuevo préstamo'}</h1>

      <label>
        Destinatario
        <input value={form.borrower} onChange={(e) => set('borrower', e.target.value)} autoFocus />
      </label>

      <div className="grid-2">
        <label>
          Monto
          <input inputMode="decimal" value={form.principal} onChange={(e) => set('principal', e.target.value)} />
        </label>
        <label>
          Moneda
          <select value={form.currency} onChange={(e) => set('currency', e.target.value as Currency)}>
            <option value="COP">COP</option>
            <option value="USD">USD</option>
          </select>
        </label>
      </div>

      <label>
        Tipo de interés
        <select value={form.interestType} onChange={(e) => set('interestType', e.target.value as InterestType)}>
          <option value="none">Sin interés</option>
          <option value="simple">Simple</option>
          <option value="compound">Compuesto</option>
        </select>
      </label>

      {form.interestType !== 'none' && (
        <div className="grid-2">
          <label>
            Tasa (%)
            <input inputMode="decimal" value={form.interestRate} onChange={(e) => set('interestRate', e.target.value)} />
          </label>
          <label>
            Periodo de la tasa
            <select value={form.ratePeriod} onChange={(e) => set('ratePeriod', e.target.value as RatePeriod)}>
              <option value="monthly">Mensual</option>
              <option value="annual">Anual</option>
            </select>
          </label>
          <label>
            Pago de intereses cada (días)
            <input
              inputMode="numeric"
              value={form.interestPeriodDays}
              onChange={(e) => set('interestPeriodDays', e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="grid-2">
        <label>
          Fecha del préstamo
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </label>
        <label>
          Fecha de vencimiento (opcional)
          <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </label>
      </div>

      <label>
        Notas
        <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      {error && <p role="alert" className="error">{error}</p>}

      <div className="row">
        <button type="button" className="button-ghost" onClick={() => navigate(-1)}>
          Cancelar
        </button>
        <button type="submit" className="button">
          Guardar préstamo
        </button>
      </div>
    </form>
  );
}
