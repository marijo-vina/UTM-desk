# UTM Desk

Monorepo de incidencias del campus. `api`, `db` y `web` se instalan juntos desde esta carpeta.

## Quién toca qué

| Carpeta | Equipo | En este corte |
| --- | --- | --- |
| `api/` | Backend | Auth, CRUD incidencias y `PATCH` de ciclo de vida/bitácora |
| `db/` | Base de datos | Validador, índices y usuarios de prueba |
| `web/` | Interfaz | Login y formulario de alta, listo para cambiar el diseño |

El catálogo de categorías, roles y estados está en `db/schema/catalogo.js`. La API lo usa como `@utm-desk/db/catalogo`.

## Levantar el proyecto

1. `npm install`
2. Copia `.env.example` a `.env` y completa Atlas, Redis y `JWT_SECRET`.
3. `npm run db:init` y `npm run db:seed`
4. `npm run dev:api` y `npm run dev:web`

La API queda en `http://localhost:3000` y la interfaz en `http://localhost:5173`.

La contraseña de las cuentas semilla es `SEED_PASSWORD` (en el ejemplo, `utmdesk123`).

| Correo | Rol |
| --- | --- |
| `ana.lopez@utm.mx` | reportante |
| `tec.jmartinez@utm.mx` | tecnico |
| `soporte@utm.mx` | soporte |
| `coordinador@utm.mx` | coordinador |
| `directivo@utm.mx` | directivo |

El directivo entra y no puede registrar incidencias.

## Probar sin Atlas

`npm test` cubre el folio en `America/Merida`, el login, el alta y los rechazos 400 y 403.
