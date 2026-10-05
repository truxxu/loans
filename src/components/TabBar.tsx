import { Link, NavLink, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/', label: 'Préstamos', end: true },
  { to: '/personas', label: 'Personas', end: false },
  { to: '/ajustes', label: 'Ajustes', end: true },
];

/** Barra inferior fija; en la lista además muestra el botón "Nuevo préstamo". */
export function TabBar() {
  const { pathname } = useLocation();
  return (
    <div className="tabbar-wrap">
      {pathname === '/' && (
        <Link to="/nuevo" className="fab">
          <span aria-hidden="true">+</span>Nuevo préstamo
        </Link>
      )}
      <nav className="tabbar" aria-label="Secciones">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="tab">
            <span className="tab-bar" aria-hidden="true" />
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
