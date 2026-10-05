import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Aviso de nueva versión. El service worker nuevo espera hasta que el usuario decide
 * actualizar, para no recargar la app a mitad de un formulario.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>Hay una nueva versión de la app.</span>
      <div className="update-actions">
        <button type="button" className="link-muted" onClick={() => setNeedRefresh(false)}>
          Más tarde
        </button>
        <button type="button" className="pill-button" onClick={() => updateServiceWorker(true)}>
          Actualizar
        </button>
      </div>
    </div>
  );
}
