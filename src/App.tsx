import { Link, Route, Routes } from 'react-router-dom';
import { LoanDetail } from './pages/LoanDetail';
import { LoanFormPage } from './pages/LoanFormPage';
import { LoanList } from './pages/LoanList';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Préstamos
        </Link>
        <Link to="/ajustes">Respaldo</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<LoanList />} />
          <Route path="/nuevo" element={<LoanFormPage />} />
          <Route path="/prestamo/:id" element={<LoanDetail />} />
          <Route path="/prestamo/:id/editar" element={<LoanFormPage />} />
          <Route path="/ajustes" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
