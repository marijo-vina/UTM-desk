# UTM Desk

Monorepo de incidencias del campus. `api`, `db` y `web` se instalan juntos desde esta carpeta.

## Quién toca qué

| Carpeta | Equipo | En este corte |
| --- | --- | --- |
| `api/` | Backend | Login, alta, listado, detalle y cambio de estado |
| `db/` | Base de datos | Validador, índices, cinco usuarios y 24 incidencias de prueba |
| `web/` | Interfaz | Login y formulario de alta, listo para cambiar el diseño |

El catálogo de categorías, roles y estados está en `db/schema/catalogo.js`. La API lo usa como `@utm-desk/db/catalogo`.

MongoDB guarda los expedientes. Redis solo entrega el consecutivo del folio. Supabase guarda fotos y PDF. En Atlas queda la ruta, y al abrir el detalle la API firma esa ruta por una hora.

## Levantar el proyecto

1. `npm install`
2. Copia `.env.example` a `.env` y completa Atlas, Redis, Supabase y `JWT_SECRET`.
3. `npm run db:init`, `npm run db:seed` y `npm run db:seed:incidencias`
4. `npm run dev:api` y `npm run dev:web`

La API queda en `http://localhost:3000` y la interfaz en `http://localhost:5173`.

En Supabase el bucket se llama `evidencias` y es privado. En el `.env` va la llave `service_role`, no la `anon` ni la publishable. El `.env` no se sube a Git.

La contraseña de las cuentas semilla es `SEED_PASSWORD` (en el ejemplo, `utmdesk123`).

| Correo | Rol |
| --- | --- |
| `ana.lopez@utm.mx` | reportante |
| `tec.jmartinez@utm.mx` | tecnico |
| `soporte@utm.mx` | soporte |
| `coordinador@utm.mx` | coordinador |
| `directivo@utm.mx` | directivo |

El directivo entra y no puede registrar incidencias. Solo el coordinador cierra un ticket, y solo si ya está resuelto.

## Probar sin Atlas

`npm test` cubre el folio en `America/Merida`, el login, el alta, el listado, el detalle y los cambios de estado.
