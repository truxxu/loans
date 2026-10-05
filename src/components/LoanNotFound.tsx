import { Link } from 'react-router-dom';

export function LoanNotFound() {
  return (
    <section className="screen screen-sub">
      <p className="empty">
        Este préstamo no existe. <Link to="/">Volver a la lista</Link>
      </p>
    </section>
  );
}
