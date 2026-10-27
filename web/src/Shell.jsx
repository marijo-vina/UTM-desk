import { useState } from 'react'
import { useAuth } from './auth.jsx'
import { iniciales, PERMISOS, ROLES } from './format.js'
import { ir } from './router.js'
import { Icono } from './ui.jsx'

function opcionesMenu(rol) {
  const menu = [
    { clave: 'inicio', texto: 'Inicio / Dashboard', icono: 'home' },
    { clave: 'incidencias', texto: rol === 'reportante' ? 'Mis incidencias' : 'Incidencias', icono: 'list' },
  ]
  if (PERMISOS.registra.includes(rol)) menu.push({ clave: 'nueva', texto: 'Nueva incidencia', icono: 'plus' })
  if (PERMISOS.analitica.includes(rol)) menu.push({ clave: 'analitica', texto: 'Analítica y reportes', icono: 'chart' })
  return menu
}

export const rutaPermitida = (clave, rol) => opcionesMenu(rol).some((opcion) => opcion.clave === clave)

function Marca() {
  return (
    <a href="#/inicio" className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-400 font-mono text-sm font-bold text-white shadow-lg shadow-brand-600/30">UD</span>
      <span className="leading-tight">
        <span className="block text-base font-bold text-white">UTM Desk</span>
        <span className="block text-[0.65rem] font-semibold tracking-[0.18em] text-teal-300 uppercase">NoSQL Cloud</span>
      </span>
    </a>
  )
}

export default function Shell({ actual, titulo, children }) {
  const { usuario, salir } = useAuth()
  const [abiertoMovil, setAbiertoMovil] = useState(false)
  const [colapsado, setColapsado] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const menu = opcionesMenu(usuario.rol)

  function buscar(evento) {
    evento.preventDefault()
    ir(`incidencias${busqueda.trim() ? `?q=${encodeURIComponent(busqueda.trim())}` : ''}`)
    setAbiertoMovil(false)
  }

  function alternarMenu() {
    if (window.innerWidth < 1024) {
      setAbiertoMovil((prev) => !prev)
    } else {
      setColapsado((prev) => !prev)
    }
  }

  return (
    <div
      className={`min-h-screen transition-all duration-300 ${
        colapsado ? 'lg:grid lg:grid-cols-[5.25rem_1fr]' : 'lg:grid lg:grid-cols-[17rem_1fr]'
      }`}
    >
      {/* Fondo móvil */}
      {abiertoMovil && (
        <div
          className="fixed inset-0 z-30 bg-navy-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setAbiertoMovil(false)}
        />
      )}

      {/* Menú lateral (Sidebar) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-gradient-to-b from-navy-900 to-navy-950 transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          colapsado ? 'lg:w-21 p-3' : 'lg:w-auto p-5'
        } ${abiertoMovil ? 'translate-x-0 w-68' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Cabecera con Logo, Nombre de la App y Botón de 3 rayas */}
        <div className={`flex items-center gap-2 ${colapsado ? 'justify-center flex-col' : 'justify-between'}`}>
          <a
            href="#/inicio"
            className={`flex items-center gap-3 overflow-hidden ${colapsado ? 'hidden' : 'flex'}`}
            title="UTM Desk"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-400 font-mono text-sm font-bold text-white shadow-lg shadow-brand-600/30">
              UD
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold text-white">UTM Desk</span>
              <span className="block text-[0.65rem] font-semibold tracking-[0.18em] text-teal-300 uppercase">
                NoSQL Cloud
              </span>
            </span>
          </a>

          {colapsado && (
            <span
              onClick={alternarMenu}
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-400 font-mono text-sm font-bold text-white shadow-lg shadow-brand-600/30 mb-2"
              title="Expandir menú"
            >
              UD
            </span>
          )}

          {/* Botón de tres rayas dentro del menú */}
          <button
            type="button"
            onClick={alternarMenu}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label={colapsado ? 'Expandir menú' : 'Contraer menú'}
            title={colapsado ? 'Expandir menú' : 'Contraer menú'}
          >
            <Icono nombre="menu" className="size-5" />
          </button>
        </div>

        {!colapsado && <p className="etiqueta-seccion mt-8 mb-2 px-3 text-slate-400">Navegación</p>}
        {colapsado && <div className="mt-4 border-t border-white/10" />}

        {/* Lista de navegación */}
        <nav className={`flex flex-col gap-1.5 ${colapsado ? 'mt-4 items-center' : 'mt-1'}`} aria-label="Principal">
          {menu.map((opcion) => {
            const activo = actual === opcion.clave
            return (
              <a
                key={opcion.clave}
                href={`#/${opcion.clave}`}
                onClick={() => setAbiertoMovil(false)}
                aria-current={activo ? 'page' : undefined}
                title={opcion.texto}
                className={`group flex items-center gap-3 rounded-xl transition ${
                  colapsado ? 'size-11 justify-center' : 'w-full px-3 py-2.5 text-sm font-medium'
                } ${
                  activo
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-600/30'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icono nombre={opcion.icono} className="size-[1.15rem] shrink-0" />
                {!colapsado && <span className="truncate">{opcion.texto}</span>}
              </a>
            )
          })}
        </nav>

        {/* Tarjeta de usuario / sesión */}
        <div
          className={`mt-auto rounded-xl border border-white/10 bg-white/5 transition-all ${
            colapsado ? 'p-2 flex flex-col items-center' : 'p-3.5'
          }`}
        >
          <div className={`flex items-center gap-3 ${colapsado ? 'justify-center' : ''}`}>
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-400/20 text-xs font-bold text-teal-200"
              title={usuario.nombre}
            >
              {iniciales(usuario.nombre)}
            </span>
            {!colapsado && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{usuario.nombre}</p>
                <p className="truncate text-xs text-slate-400">{ROLES[usuario.rol] ?? usuario.rol}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => salir()}
            title="Cerrar sesión"
            className={`mt-3 flex items-center justify-center gap-2 rounded-lg border border-white/10 text-xs font-semibold text-slate-200 transition hover:bg-white/10 ${
              colapsado ? 'size-9 p-0' : 'w-full py-2'
            }`}
          >
            <Icono nombre="logout" className="size-3.5 shrink-0" />
            {!colapsado && <span>Cerrar sesión</span>}
          </button>
        </div>
        {!colapsado && (
          <p className="mt-4 px-1 text-center text-[0.65rem] text-slate-500">Universidad Tecnológica de la Mixteca</p>
        )}
      </aside>

      {/* Cabecera superior y contenido principal */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-linea bg-white/85 px-4 py-3 backdrop-blur-md sm:px-6">
          <p className="text-sm text-suave">
            <span className="font-semibold text-tinta">Soporte TI</span> / {titulo}
          </p>

          <form onSubmit={buscar} className="relative ml-auto w-full max-w-sm" role="search">
            <Icono
              nombre="search"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="busqueda-global"
              className="campo pl-10"
              placeholder="Buscar por título o descripción…"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              aria-label="Buscar incidencias"
            />
          </form>

          {PERMISOS.registra.includes(usuario.rol) && actual !== 'nueva' && (
            <a href="#/nueva" className="boton boton-primario hidden sm:inline-flex">
              <Icono nombre="plus" /> Nueva incidencia
            </a>
          )}
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  )
}
