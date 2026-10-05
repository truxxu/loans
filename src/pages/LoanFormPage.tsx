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

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };

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

  const seg = <K extends 'interestType' | 'ratePeriod'>(key: K, opts: [FormState[K], string][]) =>
    opts.map(([value, label]) => (
      <button
        key={value}
        type="button"
        className="seg-option"
        aria-pressed={form[key] === value}
        onClick={() => set(key, value)}
      >
        {label}
      </button>
    ));

  return (
    <form onSubmit={onSubmit} noValidate>
      <section className="screen screen-sub">
        <div className="topnav">
          <button type="button" className="back" onClick={() => navigate(-1)}>
            Cancelar
          </button>
        </div>
        <h1 className="h1-md">{existing ? 'Editar préstamo' : 'Nuevo préstamo'}</h1>

        <label className="field">
          Destinatario
          <input
            className="input input-lg"
            placeholder="Nombre"
            value={form.borrower}
            onChange={(e) => set('borrower', e.target.value)}
            autoFocus
          />
        </label>

        <label className="field">
          Monto
          <span className="input input-affix">
            <span className="affix" aria-hidden="true">$</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={form.principal}
              onChange={(e) => set('principal', e.target.value)}
            />
          </span>
        </label>

        <div className="field">
          <span id="type-label">Tipo de interés</span>
          <div className="segmented" role="group" aria-labelledby="type-label">
            {seg('interestType', [
              ['none', 'Sin interés'],
              ['simple', 'Simple'],
              ['compound', 'Compuesto'],
            ])}
          </div>
        </div>

        {form.interestType !== 'none' && (
          <div className="panel">
            <div className="grid-2">
              <label className="field">
                Tasa (%)
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="2"
                  value={form.interestRate}
                  onChange={(e) => set('interestRate', e.target.value)}
                />
              </label>
              <div className="field">
                <span id="period-label">Periodo de la tasa</span>
                <div className="segmented segmented-fill" role="group" aria-labelledby="period-label">
                  {seg('ratePeriod', [
                    ['monthly', 'Mensual'],
                    ['annual', 'Anual'],
                  ])}
                </div>
              </div>
            </div>
            <label className="field">
              Pago de intereses cada (días)
              <input
                className="input"
                inputMode="numeric"
                value={form.interestPeriodDays}
                onChange={(e) => set('interestPeriodDays', e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="grid-2">
          <label className="field">
            Fecha del préstamo
            <input
              type="date"
              className="input"
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </label>
          <label className="field">
            Vencimiento (opcional)
            <input type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </label>
        </div>

        <label className="field">
          Notas
          <textarea className="input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        {error && <p role="alert" className="error">{error}</p>}
      </section>

      <div className="sticky-cta">
        <button type="submit" className="button">
          Guardar préstamo
        </button>
      </div>
    </form>
  );
}
