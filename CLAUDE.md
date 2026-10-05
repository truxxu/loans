# Préstamos PWA

PWA personal para llevar el control de préstamos hechos a otras personas: destinatario,
condiciones (monto, tipo de interés, tasa, vencimiento opcional) e historial de pagos.
Un solo usuario, sin backend, sin cuentas. Los datos viven en IndexedDB.

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm test` — tests (Vitest): lógica en `src/lib/*.test.ts` (node) y componentes en
  `src/**/*.test.tsx` (jsdom + Testing Library + `fake-indexeddb`)
- `npm run typecheck` — TypeScript
- `npm run build` — typecheck + build de producción con service worker

Antes de dar por terminada una tarea: `npm test && npm run build`.

Deploy: cada push a `main` publica en https://truxxu.github.io/loans/ (GitHub Actions).

## Stack

Vite, React 19, TypeScript estricto, Dexie (IndexedDB) con `dexie-react-hooks`,
React Router (`HashRouter`), `vite-plugin-pwa`. CSS plano con tokens en `:root`
(`src/styles.css`). No agregar dependencias sin una razón clara.

## Estructura

```
src/
  types.ts            Loan, Payment y tipos auxiliares
  db.ts               Esquema Dexie, borrado en cascada, exportar/importar respaldo
  lib/backup.ts       Formato del respaldo y validación campo por campo + tests
  lib/backupCrypto.ts Sobre cifrado del respaldo (PBKDF2 + AES-GCM, contraseña propia) + tests
  lib/base64.ts       Base64 de bytes por bloques (respaldo cifrado, hash del PIN)
  lib/interest.ts     Motor de cálculo (funciones puras) + tests
  lib/money.ts        Parseo y formato de montos y fechas + tests
  lib/loanView.ts     Datos derivados para las vistas (totales, personas, detalle) + tests
  lib/reminders.ts    Qué préstamos recordar y el texto de la notificación + tests
  lib/settings.ts     Preferencias del dispositivo (recordatorios) en localStorage
  lib/storage.ts      Acceso tolerante a fallos a localStorage (claves `prestamos:*`)
  lib/privacy.ts      PIN (hash PBKDF2), cuándo volver a bloquear, intentos fallidos + tests
  lib/validation.ts   Validación de fechas de préstamos y pagos + tests
  lib/loanForm.ts     Formulario de préstamo: texto ⇄ Loan, validación + tests
  hooks/useLoans.ts   Todos los préstamos con su estado a hoy (useLiveQuery)
  hooks/useReminders.ts  Notificación de vencimientos al abrir/volver a la app
  hooks/usePrivacy.tsx   PrivacyProvider: bloqueo con PIN, velo al salir, montos ocultos
  pages/              LoanList, People, Person, LoanDetail, LoanFormPage, Settings (Ajustes)
  pages/*.test.tsx    Tests de componentes; utilidades en test/dom.tsx (renderAt, seed, money)
  components/         StatusBadge, Avatar, LoanCard, LoanNotFound, PaymentSheet, TabBar,
                      UpdatePrompt (aviso de nueva versión del service worker),
                      Money (monto que se difumina), LockScreen, PinPad, PinSheet,
                      HideAmountsButton, BackupPasswordSheet (contraseña del respaldo)
```

## Reglas de negocio

1. **El saldo nunca se guarda.** Se deriva con `computeLoanState(loan, payments, asOf)`.
   Lo mismo el estado (`active` / `overdue` / `paid`) y el desglose de cada pago.
   Editar o borrar un pago antiguo debe recalcular todo sin migraciones.
2. **Dinero en unidades menores enteras** (centavos), también para COP. Nunca floats en
   lo que se persiste. El interés causado se acumula con decimales dentro del motor y
   se redondea solo al exponerlo.
3. **Fechas como `YYYY-MM-DD`**, sin hora ni zona horaria. Se comparan como strings.
4. **Causación diaria**, base comercial sobre días calendario reales: año de 360 días,
   mes de 30. Si se paga a los 35 días se cobran 35 días: 2% mensual × 35/30.
   - Simple: interés sobre el capital pendiente; el interés no pagado no capitaliza.
   - Compuesto: interés sobre capital + interés pendiente.
5. **Aplicación de pagos**: primero interés causado, luego capital. El excedente se
   reporta como `overpaid`.
6. **Mora**: después del vencimiento el interés se sigue causando sobre todo el saldo, a la
   tasa de mora (`lateInterestRate`, opcional, en la misma unidad que `ratePeriod`) o, si no
   hay, a la tasa corriente. El tramo se parte en `dueDate`: los días posteriores son mora.
   Un préstamo sin interés con tasa de mora causa interés simple solo en mora.
   El vencimiento (`dueDate`) es opcional; sin vencimiento el préstamo nunca queda en mora.
7. **Modelo de pago**: abonos libres y, como mucho, una fecha de vencimiento. No hay cuotas.
8. **Periodo de intereses**: los intereses se suelen pagar cada `interestPeriodDays` días
   (30 por defecto, configurable por préstamo), en `startDate + k × periodo`. Es solo
   informativo: la app muestra la próxima fecha y el monto estimado, y avisa si hay
   intereses sin pagar por más de un periodo, pero no cambia el estado.

Cualquier cambio a estas reglas va con tests en `src/lib/interest.test.ts`.

## Convenciones

- Código e identificadores en inglés; textos de UI en español (es-CO).
- Lógica de negocio en `src/lib` como funciones puras y testeadas; los componentes solo
  leen de Dexie con `useLiveQuery` y llaman a esas funciones.
- Cambios al esquema de IndexedDB: nueva `this.version(n)` en `db.ts` con `upgrade` si
  hace falta, y subir `Backup.version` si cambia el formato del respaldo. El sobre cifrado
  (`lib/backupCrypto.ts`) tiene su propia versión, independiente de `Backup.version`.
- El respaldo se exporta siempre cifrado con una contraseña propia (no el PIN); importar acepta
  también los respaldos viejos en claro. Lo descifrado pasa por `parseBackup` igual que uno en claro.
- Botones nombrados por la acción concreta ("Registrar pago", no "Enviar").
- Montos en la UI siempre con `<Money>`, no `formatMoney` directo, para que "Ocultar montos"
  los difumine.

## Estado actual

Funciona de punta a punta: crear/editar/eliminar préstamos, registrar/editar/eliminar pagos
(hoja inferior), historial con desglose interés/capital, lista con totales y filtros por estado,
vista por persona, tasa de mora opcional, respaldo JSON cifrado con contraseña y validado campo por campo,
recordatorios de vencimiento (pestaña Ajustes), aviso de nueva versión, instalable y offline,
privacidad (PIN opcional, velo al salir de la app, ocultar montos, notificaciones discretas),
desplegado en GitHub Pages.
UI móvil, solo tema oscuro (rediseño "Préstamos - Rediseño" de claude.ai/design). El formulario
no pide moneda: los préstamos nuevos son COP y los totales suman todo como COP.

## Backlog sugerido

- [x] Editar un pago existente
- [x] Filtros y totales en la lista (falta: totales por moneda si vuelve USD)
- [x] Vista por destinatario (varios préstamos a la misma persona)
- [x] Tasa de mora distinta a la tasa corriente
- [ ] Préstamos en cuotas con plan de amortización (choca con la regla 7; decidir el modelo antes)
- [x] Recordatorios de vencimiento (Notifications API; sin backend solo al abrir la app)
- [x] Validar el respaldo importado campo por campo
- [x] Aviso de "nueva versión disponible" en vez de `autoUpdate` silencioso
- [x] Tests de componentes (Testing Library)
- [x] Deploy en GitHub Pages (`.github/workflows/deploy.yml`, push a `main`)
- [x] Bloqueo con PIN y ocultar montos. El PIN bloquea la UI, no cifra IndexedDB; si se
      olvida, "Olvidé el PIN" borra todo. Pendiente posible: desbloqueo con WebAuthn (Face ID)
