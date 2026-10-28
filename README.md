# UTM Desk

Monorepo de incidencias del campus. `api`, `db` y `web` se instalan juntos desde esta carpeta.

## Quién toca qué

| Carpeta | Equipo | En este corte |
| --- | --- | --- |
| `api/` | Backend | Auth, incidencias, ciclo de vida, evidencias, etiquetas, analítica y borrado |
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

La contraseña de las cuentas semilla es `SEED_PASSWORD` (en el ejemplo, `utmdesk123`). La cuenta `lizandro.reyes@utmetropolitana.edu.mx` usa `lizandro_2026`.

| Correo | Rol |
| --- | --- |
| `ana.lopez@utm.mx` | reportante |
| `tec.jmartinez@utm.mx` | tecnico |
| `soporte@utm.mx` | soporte |
| `coordinador@utm.mx` | coordinador |
| `directivo@utm.mx` | directivo |
| `lizandro.reyes@utmetropolitana.edu.mx` | superAdmin |

El directivo entra y no puede registrar incidencias. El coordinador y el superAdmin cierran un ticket, y solo si ya está resuelto.

## Probar sin Atlas

`npm test` cubre el folio en `America/Merida`, el login, el alta, el listado, el detalle, el ciclo de vida, evidencias, etiquetas, analítica y borrado.

La colección de Postman está en `postman/UTM-Desk.postman_collection.json`.

## Publicar en Vercel

Un solo proyecto sirve la interfaz y la API. `vercel.json` manda `/api` a Fastify y el resto a Vite. La interfaz sigue llamando a `/api`; en producción Vercel quita ese prefijo antes de llegar a la API, igual que el proxy local.

En el panel de Vercel:

1. Importa el repositorio y deja la raíz en esta carpeta, no en el directorio padre.
2. Antes del primer deploy, crea estas variables (los mismos nombres del `.env`): `MONGODB_URI`, `MONGODB_DB`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`, `CORS_ORIGIN`.
3. `JWT_SECRET` tiene que ser distinto del ejemplo. `SUPABASE_SERVICE_ROLE_KEY` se queda solo en Vercel, nunca en el frontend.
4. En Atlas, el acceso de red debe incluir `0.0.0.0/0`, porque las direcciones de Vercel cambian.
5. Cuando el deploy tenga URL, agrega esa URL a `CORS_ORIGIN` junto a `http://localhost:5173`.

Cada evidencia admite como máximo 4 MB. Vercel rechaza cuerpos de más de 4.5 MB.
