import { CATEGORIAS, ESTADOS, PRIORIDADES } from './format.js'

const ICONOS = {
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  plus: ['M12 5v14M5 12h14'],
  chart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M21 21l-4.3-4.3'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  check: ['M20 6L9 17l-5-5'],
  x: ['M18 6L6 18M6 6l12 12'],
  alert: ['M12 9v4M12 17h.01', 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  right: ['M9 18l6-6-6-6'],
  left: ['M15 18l-6-6 6-6'],
  menu: ['M3 12h18M3 6h18M3 18h18'],
  trash: ['M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'],
  wifi: ['M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01'],
  building: ['M3 21h18M5 21V7l8-4v18M19 21V11l-6-4', 'M9 9v.01M9 12v.01M9 15v.01M9 18v.01'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
  tag: ['M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z', 'M7 7h.01'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  refresh: ['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5'],
  clip: ['M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5'],
  send: ['M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  lock: ['M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  server: ['M4 3h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M4 13h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z', 'M7 7.5h.01M7 17.5h.01'],
}

export function Icono({ nombre, className = 'size-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {(ICONOS[nombre] ?? []).map((trazo) => (
        <path key={trazo} d={trazo} />
      ))}
    </svg>
  )
}

const CLASES_ESTADO = {
  abierta: 'bg-blue-50 text-blue-700 ring-blue-200',
  en_proceso: 'bg-amber-50 text-amber-700 ring-amber-200',
  en_espera: 'bg-violet-50 text-violet-700 ring-violet-200',
  resuelta: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cerrada: 'bg-slate-100 text-slate-600 ring-slate-300',
}

const CLASES_PRIORIDAD = {
  baja: 'text-slate-600',
  media: 'text-blue-700',
  alta: 'text-orange-600',
  critica: 'text-red-600',
}

const PUNTO_PRIORIDAD = {
  baja: 'bg-slate-400',
  media: 'bg-blue-500',
  alta: 'bg-orange-500',
  critica: 'bg-red-500',
}

export function InsigniaEstado({ estado }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${CLASES_ESTADO[estado] ?? CLASES_ESTADO.cerrada}`}>
      {ESTADOS[estado] ?? estado}
    </span>
  )
}

export function InsigniaPrioridad({ prioridad }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${CLASES_PRIORIDAD[prioridad] ?? ''}`}>
      <span className={`size-2 rounded-full ${PUNTO_PRIORIDAD[prioridad] ?? 'bg-slate-400'} ${prioridad === 'critica' ? 'animate-pulse' : ''}`} />
      {PRIORIDADES[prioridad] ?? prioridad}
    </span>
  )
}

export function InsigniaCategoria({ categoria }) {
  const datos = CATEGORIAS[categoria]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-brand-700">
      {datos && <Icono nombre={datos.icono} className="size-3" />}
      {datos?.nombre ?? categoria}
    </span>
  )
}

export function Folio({ codigo }) {
  return <span className="font-mono text-xs font-semibold tracking-tight text-navy-700">{codigo}</span>
}

export function Esqueleto({ className = 'h-24' }) {
  return <div className={`esqueleto ${className}`} />
}

export function Vacio({ icono = 'list', titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icono nombre={icono} className="size-6" />
      </span>
      <p className="text-base font-semibold">{titulo}</p>
      {texto && <p className="max-w-md text-sm text-suave">{texto}</p>}
      {children}
    </div>
  )
}

export function NoAutorizado() {
  return (
    <div className="tarjeta animate-aparece">
      <Vacio icono="lock" titulo="No tienes permiso para ver esta sección" texto="Tu rol no incluye esta operación. Si crees que es un error, habla con la coordinación de soporte." >
        <a href="#/inicio" className="boton boton-secundario mt-2">
          Volver al inicio
        </a>
      </Vacio>
    </div>
  )
}

function PanelError({ error, alReintentar }) {
  const sinApi = error.noDisponible
  return (
    <div className="tarjeta animate-aparece">
      <Vacio
        icono={sinApi ? 'server' : 'alert'}
        titulo={sinApi ? 'Función pendiente en la API' : error.sinConexion ? 'Sin conexión con la API' : 'No pudimos cargar la información'}
        texto={
          sinApi
            ? 'La interfaz ya está lista para esta pantalla, pero el endpoint correspondiente todavía no está publicado en el backend. Aparecerá aquí en cuanto exista.'
            : error.message
        }
      >
        {!sinApi && (
          <button type="button" className="boton boton-secundario mt-2" onClick={alReintentar}>
            <Icono nombre="refresh" /> Reintentar
          </button>
        )}
      </Vacio>
    </div>
  )
}

/** Renderiza el estado de una carga: esqueleto, 403, endpoint pendiente, error o contenido. */
export function Cargable({ carga, esqueleto, children }) {
  if (carga.cargando && !carga.datos) return esqueleto ?? <Esqueleto className="h-64" />
  if (carga.error?.status === 403) return <NoAutorizado />
  if (carga.error) return <PanelError error={carga.error} alReintentar={carga.recargar} />
  return children(carga.datos)
}

export function Alerta({ tipo = 'error', children }) {
  const clases = tipo === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${clases}`}>
      <Icono nombre={tipo === 'error' ? 'alert' : 'check'} className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Paginacion({ pagina, paginas, total, alCambiar }) {
  if (paginas <= 1) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea px-4 py-3 text-sm text-suave">
      <span>
        Página {pagina} de {paginas} · {total} resultados
      </span>
      <div className="flex gap-2">
        <button type="button" className="boton boton-secundario px-3 py-1.5" disabled={pagina <= 1} onClick={() => alCambiar(pagina - 1)}>
          <Icono nombre="left" /> Anterior
        </button>
        <button type="button" className="boton boton-secundario px-3 py-1.5" disabled={pagina >= paginas} onClick={() => alCambiar(pagina + 1)}>
          Siguiente <Icono nombre="right" />
        </button>
      </div>
    </div>
  )
}

export function Modal({ titulo, children, alCerrar }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={titulo} onClick={alCerrar}>
      <div className="tarjeta w-full max-w-md animate-aparece p-6" onClick={(evento) => evento.stopPropagation()}>
        <h2 className="text-lg font-bold">{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

export function TituloPagina({ sobretitulo, titulo, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {sobretitulo && <p className="etiqueta-seccion">{sobretitulo}</p>}
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
      </div>
      {children}
    </div>
  )
}
