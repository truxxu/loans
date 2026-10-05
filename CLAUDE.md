# Préstamos PWA

PWA personal para llevar el control de préstamos hechos a otras personas: destinatario,
condiciones (monto, tipo de interés, tasa, fecha de pago) e historial de pagos.
Un solo usuario, sin backend, sin cuentas. Los datos viven en IndexedDB.

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm test` — tests (Vitest)
- `npm run typecheck` — TypeScript
- `npm run build` — typecheck + build de producción con service worker

Antes de dar por terminada una tarea: `npm test && npm run build`.

## Stack

Vite, React 19, TypeScript estricto, Dexie (IndexedDB) con `dexie-react-hooks`,
React Router (`HashRouter`), `vite-plugin-pwa`. CSS plano con tokens en `:root`
(`src/styles.css`). No agregar dependencias sin una razón clara.

## Estructura

```
src/
  types.ts            Loan, Payment y tipos auxiliares
  db.ts               Esquema Dexie, borrado en cascada, exportar/importar respaldo
  lib/interest.ts     Motor de cálculo (funciones puras) + tests
  lib/money.ts        Parseo y formato de montos y fechas + tests
  pages/              LoanList, LoanDetail, LoanFormPage, Settings
  components/         StatusBadge
```

## Reglas de negocio

1. **El saldo nunca se guarda.** Se deriva con `computeLoanState(loan, payments, asOf)`.
   Lo mismo el estado (`active` / `overdue` / `paid`) y el desglose de cada pago.
   Editar o borrar un pago antiguo debe recalcular todo sin migraciones.
2. **Dinero en unidades menores enteras** (centavos), también para COP. Nunca floats en
   lo que se persiste. El interés causado se acumula con decimales dentro del motor y
   se redondea solo al exponerlo.
3. **Fechas como `YYYY-MM-DD`**, sin hora ni zona horaria. Se comparan como strings.
4. **Causación diaria**: año de 365 días, mes = 365/12 días.
   - Simple: interés sobre el capital pendiente; el interés no pagado no capitaliza.
   - Compuesto: interés sobre capital + interés pendiente.
5. **Aplicación de pagos**: primero interés causado, luego capital. El excedente se
   reporta como `overpaid`.
6. **Mora**: después del vencimiento el interés se sigue causando a la misma tasa.
7. **Modelo de pago**: una sola fecha de vencimiento con abonos libres. No hay cuotas.

Cualquier cambio a estas reglas va con tests en `src/lib/interest.test.ts`.

## Convenciones

- Código e identificadores en inglés; textos de UI en español (es-CO).
- Lógica de negocio en `src/lib` como funciones puras y testeadas; los componentes solo
  leen de Dexie con `useLiveQuery` y llaman a esas funciones.
- Cambios al esquema de IndexedDB: nueva `this.version(n)` en `db.ts` con `upgrade` si
  hace falta, y subir `Backup.version` si cambia el formato del respaldo.
- Botones nombrados por la acción concreta ("Registrar pago", no "Enviar").

## Estado actual

Funciona de punta a punta: crear/editar/eliminar préstamos, registrar y eliminar pagos,
historial con desglose interés/capital, respaldo JSON, instalable y offline.
La UI es deliberadamente básica.

## Backlog sugerido

- [ ] Editar un pago existente
- [ ] Filtros y totales en la lista (total prestado, total en mora, por moneda)
- [ ] Vista por destinatario (varios préstamos a la misma persona)
- [ ] Tasa de mora distinta a la tasa corriente
- [ ] Préstamos en cuotas con plan de amortización
- [ ] Recordatorios de vencimiento (Notifications API; sin backend solo al abrir la app)
- [ ] Validar el respaldo importado campo por campo (hoy solo valida la forma general)
- [ ] Aviso de "nueva versión disponible" en vez de `autoUpdate` silencioso
- [ ] Tests de componentes (Testing Library) y pulido visual
- [ ] Deploy (GitHub Pages / Cloudflare Pages); `base: './'` ya lo permite
