import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LoanNotFound } from '../components/LoanNotFound';
import { db, newId } from '../db';
import { emptyLoanForm, loanToForm, parseLoanForm, type LoanForm } from '../lib/loanForm';
import type { ISODate, Loan } from '../types';

/** Al editar, el formulario no se puede guardar hasta cargar el préstamo. */
type Load =
  | { status: 'loading' }
  | { status: 'missing' }
  /** `firstPaymentDate`: fecha del primer pago del préstamo que se edita; null si no tiene pagos. */
  | { status: 'ready'; existing: Loan | null; firstPaymentDate: ISODate | null };

export function LoanFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<LoanForm>(() => emptyLoanForm());
  const [load, setLoad] = useState<Load>(
    id ? { status: 'loading' } : { status: 'ready', existing: null, firstPaymentDate: null },
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void Promise.all([db.loans.get(id), db.payments.where('loanId').equals(id).sortBy('date')]).then(
      ([loan, payments]) => {
        if (!loan) return setLoad({ status: 'missing' });
        setForm(loanToForm(loan));
        setLoad({ status: 'ready', existing: loan, firstPaymentDate: payments[0]?.date ?? null });
      },
    );
  }, [id]);

  const set = <K extends keyof LoanForm>(key: K, value: LoanForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (load.status !== 'ready') return;
    const result = parseLoanForm(form, load.existing, load.firstPaymentDate, newId);
    if ('error' in result) return setError(result.error);
    await db.loans.put(result.loan);
    navigate(`/prestamo/${result.loan.id}`, { replace: true });
  }

  if (load.status === 'missing') return <LoanNotFound />;
  const ready = load.status === 'ready' ? load : null;

  const seg = <K extends 'interestType' | 'ratePeriod'>(key: K, opts: [LoanForm[K], string][]) =>
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
        <h1 className="h1-md">{id ? 'Editar préstamo' : 'Nuevo préstamo'}</h1>

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
              max={ready?.firstPaymentDate ?? undefined}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </label>
          <label className="field">
            Vencimiento (opcional)
            <input type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </label>
        </div>

        {form.dueDate && (
          <div className="grid-2">
            <label className="field">
              Tasa de mora (%)
              <input
                className="input"
                inputMode="decimal"
                placeholder={form.interestType === 'none' ? 'Opcional' : 'Igual a la tasa'}
                value={form.lateInterestRate}
                onChange={(e) => set('lateInterestRate', e.target.value)}
              />
            </label>
            {/* Con interés, la mora usa el periodo de la tasa corriente (ya visible arriba). */}
            {form.interestType === 'none' && (
              <div className="field">
                <span id="late-period-label">Periodo de la tasa</span>
                <div className="segmented segmented-fill" role="group" aria-labelledby="late-period-label">
                  {seg('ratePeriod', [
                    ['monthly', 'Mensual'],
                    ['annual', 'Anual'],
                  ])}
                </div>
              </div>
            )}
          </div>
        )}

        <label className="field">
          Notas
          <textarea className="input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        {error && <p role="alert" className="error">{error}</p>}
      </section>

      <div className="sticky-cta">
        <button type="submit" className="button" disabled={!ready}>
          Guardar préstamo
        </button>
      </div>
    </form>
  );
}
