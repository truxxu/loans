import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useReminders } from './hooks/useReminders';

export function App() {
  const { pathname } = useLocation();
  useReminders();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="app">
      <UpdatePrompt />
      <AppRoutes />
    </div>
  );
}
