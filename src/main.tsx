import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: no requiere reglas de rewrite en hosting estático. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
