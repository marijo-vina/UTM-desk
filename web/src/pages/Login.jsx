import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { Alerta, Icono } from '../ui.jsx'

const DEMO = [
  {
    siglas: 'RM',
    nombre: 'Ing. Roberto Mendoza',
    puesto: 'Reportante / Docente',
    correo: 'ana.lopez@utm.mx',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    siglas: 'EC',
    nombre: 'Lic. Elena Cruz',
    puesto: 'Técnico Especialista TI',
    correo: 'tec.jmartinez@utm.mx',
    color: 'from-teal-500 to-emerald-600',
  },
  {
    siglas: 'JM',
    nombre: 'Ing. Javier Martínez',
    puesto: 'Coordinador Infraestructura',
    correo: 'coordinador@utm.mx',
    color: 'from-blue-600 to-navy-800',
  },
  {
    siglas: 'CS',
    nombre: 'Dr. Carlos Silva',
    puesto: 'Directivo / Consulta SLA',
    correo: 'directivo@utm.mx',
    color: 'from-slate-700 to-slate-900',
  },
]

const CONTRASENA_DEMO = import.meta.env.VITE_DEMO_PASSWORD || 'utmdesk123'

export default function Login() {
  const { entrar, aviso } = useAuth()
  const [correo, setCorreo] = useState('r.mendoza@utm.mx')
  const [contrasena, setContrasena] = useState('••••••••••••')
  const [ver, setVer] = useState(false)
  const [recordar, setRecordar] = useState(true)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento) {
    evento.preventDefault()
    if (enviando) return
    setError('')
    setEnviando(true)
    try {
      await entrar(correo.trim(), contrasena, recordar)
      window.location.hash = '#/inicio'
    } catch (causa) {
      setError(causa.message)
      setEnviando(false)
    }
  }

  function seleccionarPerfil(p) {
    setCorreo(p.correo)
    setContrasena(CONTRASENA_DEMO)
    setError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-10 antialiased">
      <main className="w-full max-w-[480px] animate-aparece">
        {/* Card Principal */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-9">
          {/* Logo Badge */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-50 to-blue-50 px-3.5 py-1.5 ring-1 ring-teal-200/60">
              <span className="grid size-6 place-items-center rounded-lg bg-teal-500 text-white shadow-sm">
                <Icono nombre="check" className="size-3.5 stroke-[3]" />
              </span>
              <span className="text-xs font-bold tracking-wider text-slate-800 uppercase">Desk NoSQL Cloud</span>
            </div>

            <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[0.65rem] font-bold tracking-widest text-brand-600 uppercase">
              <span className="size-1.5 rounded-full bg-brand-500 animate-pulse" />
              Nodo Académico Central
            </div>

            <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Bienvenido a UTM Desk NoSQL Cloud
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
              Plataforma de gestión de incidencias y soporte tecnológico de la Universidad Tecnológica de la Mixteca.
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={enviar} className="mt-7 grid gap-4">
            {(error || aviso) && <Alerta>{error || aviso}</Alerta>}

            <div>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="login-correo" className="font-semibold text-slate-700">
                  Correo Institucional
                </label>
                <span className="font-mono text-slate-400">dominio: @utm.mx</span>
              </div>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 font-mono text-sm">
                  @
                </span>
                <input
                  id="login-correo"
                  className="campo pl-9 text-sm"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="r.mendoza@utm.mx"
                  value={correo}
                  onChange={(evento) => setCorreo(evento.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="login-contrasena" className="font-semibold text-slate-700">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => alert('Para restablecer contraseña, comunícate con la coordinación de soporte (soporte@utm.mx).')}
                  className="text-brand-600 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">
                  <Icono nombre="lock" className="size-4" />
                </span>
                <input
                  id="login-contrasena"
                  className="campo pr-10 pl-9 text-sm tracking-wider"
                  type={ver ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={contrasena}
                  onChange={(evento) => setContrasena(evento.target.value)}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                  onClick={() => setVer((valor) => !valor)}
                  aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icono nombre="eye" className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
                  checked={recordar}
                  onChange={(evento) => setRecordar(evento.target.checked)}
                />
                Mantener sesión iniciada
              </label>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.68rem] font-semibold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Conexión TLS 1.3
              </span>
            </div>

            <button
              id="login-enviar"
              className="boton boton-primario mt-2 w-full py-2.5 text-sm shadow-lg shadow-brand-500/25"
              disabled={enviando}
            >
              {enviando ? 'Iniciando sesión…' : 'Iniciar Sesión Institucional'}
              <Icono nombre="right" className="size-4" />
            </button>
          </form>

          {/* Separador */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <span className="relative bg-white px-3 text-[0.65rem] font-bold tracking-widest text-slate-400 uppercase">
              O ingresa como usuario de prueba
            </span>
          </div>

          {/* Tarjeta de Perfiles de Demostración */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800">Perfiles de Demostración NoSQL</p>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-bold text-sky-800">
                ⚡ Prototipo
              </span>
            </div>
            <p className="mt-1 text-[0.72rem] leading-snug text-slate-500">
              Selecciona un perfil con permisos precargados para explorar las vistas del prototipo.
            </p>

            <div className="mt-3.5 grid grid-cols-2 gap-2">
              {DEMO.map((p) => {
                const seleccionado = correo === p.correo
                return (
                  <button
                    key={p.correo}
                    type="button"
                    onClick={() => seleccionarPerfil(p)}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                      seleccionado
                        ? 'border-brand-500 bg-white ring-2 ring-brand-500/20 shadow-sm'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br ${p.color} text-[0.65rem] font-bold text-white shadow-xs`}
                    >
                      {p.siglas}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">{p.nombre}</p>
                      <p className="truncate text-[0.65rem] text-slate-500">{p.puesto}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.68rem] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            UTM Desk NoSQL Cloud v2.4 · MongoDB Atlas Cluster
          </span>
          <span>·</span>
          <a href="#/privacidad" className="hover:underline">Aviso de Privacidad</a>
          <span>·</span>
          <a href="#/seguridad" className="hover:underline">Seguridad UTM</a>
        </footer>
      </main>
    </div>
  )
}
