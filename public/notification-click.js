// Importado por el service worker generado (workbox.importScripts en vite.config.ts).
// Al tocar el recordatorio, enfoca la app si ya está abierta o la abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => 'focus' in c);
      return client ? client.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
