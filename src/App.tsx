import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useReminders } from './hooks/useReminders';
import { LoanDetail } from './pages/LoanDetail';
import { LoanFormPage } from './pages/LoanFormPage';
import { LoanList } from './pages/LoanList';
import { People } from './pages/People';
import { Person } from './pages/Person';
import { Settings } from './pages/Settings';

/** Pantallas con barra de pestañas; detalle y formulario tienen su propio botón fijo. */
const withTabs = (path: string) => path === '/' || path === '/ajustes' || path.startsWith('/personas');

export function App() {
  const { pathname } = useLocation();
  useReminders();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="app">
      <UpdatePrompt />
      <Routes>
        <Route path="/" element={<LoanList />} />
        <Route path="/personas" element={<People />} />
        <Route path="/personas/:name" element={<Person />} />
        <Route path="/nuevo" element={<LoanFormPage />} />
        <Route path="/prestamo/:id" element={<LoanDetail />} />
        <Route path="/prestamo/:id/editar" element={<LoanFormPage />} />
        <Route path="/ajustes" element={<Settings />} />
        <Route path="/respaldo" element={<Navigate to="/ajustes" replace />} />
      </Routes>
      {withTabs(pathname) && <TabBar />}
    </div>
  );
}
