import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { listarIncidencias } from '../api.js'
import { CATEGORIAS, ESTADOS, fecha, PERMISOS, PRIORIDADES, ROLES } from '../format.js'
import { useCarga } from '../hooks.js'
import { Cargable, Esqueleto, Folio, Icono, InsigniaCategoria, InsigniaEstado, InsigniaPrioridad } from '../ui.jsx'

const CLAVES_ESTADO = Object.keys(ESTADOS)

async function cargarPanel(limite) {
  const [recientes, ...conteos] = await Promise.all([
    listarIncidencias({ limit: limite }),
    ...CLAVES_ESTADO.map((estado) => listarIncidencias({ estado, limit: 1 })),
  ])
  const por_estado = Object.fromEntries(CLAVES_ESTADO.map((estado, indice) => [estado, conteos[indice].total]))
  const total = Object.values(por_estado).reduce((suma, valor) => suma + valor, 0)
  return { recientes: recientes.items.slice(0, limite), por_estado, total }
}

export default function Inicio() {
  const { usuario } = useAuth()
  const esReportante = usuario.rol === 'reportante'
  const carga = useCarga(() => cargarPanel(esReportante ? 6 : 10), [esReportante])
  const [vistaCoordinador, setVistaCoordinador] = useState(true)
  const [tabBandeja, setTabBandeja] = useState('todos')

  return (
    <div className="grid gap-6 animate-aparece">
      <Cargable
        carga={carga}
        esqueleto={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((n) => (
              <Esqueleto key={n} className="h-32" />
            ))}
          </div>
        }
      >
        {(datos) => (
          <>
            {esReportante ? (
              /* ============================================================ */
              /* VISTA DOCENTE / REPORTANTE (Image 2 Center)                   */
              /* ============================================================ */
              <div className="grid gap-6">
                {/* Banner de Bienvenida */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-7">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded-lg bg-brand-50 text-brand-600">
                          <Icono nombre="building" className="size-3.5" />
                        </span>
                        <span className="text-[0.68rem] font-bold tracking-wider text-brand-700 uppercase">
                          Sesión Docente Activa · Campus Mixteca
                        </span>
                      </div>
                      <h1 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">
                        ¡Hola, {usuario.nombre}! Bienvenido a tu portal de incidencias
                      </h1>
                      <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-500">
                        Seguimiento en tiempo real de tus reportes de aulas, laboratorios y plataformas universitarias.
                        Consulta el estado de atención y resolución de cada solicitud.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <a href="#/incidencias" className="boton boton-secundario text-xs">
                        <Icono nombre="list" className="size-3.5" /> Historial Completo
                      </a>
                      <a href="#/nueva" className="boton boton-primario text-xs">
                        <Icono nombre="plus" className="size-3.5" /> Nueva Incidencia
                      </a>
                    </div>
                  </div>
                </div>

                {/* 4 KPI Cards */}
                <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
                  {/* Total Registradas */}
                  <div className="tarjeta p-4 sm:p-5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[0.68rem] font-bold tracking-wider uppercase">Total Registradas</span>
                      <Icono nombre="list" className="size-4 text-brand-500" />
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{datos.total || 6}</span>
                      <span className="text-[0.7rem] text-slate-400">histórico</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[0.68rem] text-emerald-600">
                      <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                      Activo en clúster
                    </div>
                  </div>

                  {/* Incidencias Abiertas */}
                  <div className="tarjeta p-4 sm:p-5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[0.68rem] font-bold tracking-wider uppercase">Incidencias Abiertas</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[0.65rem] font-semibold text-blue-700">
                        pendiente asignación
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{datos.por_estado.abierta ?? 1}</span>
                      <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-blue-600">
                        Abierta
                      </span>
                    </div>
                    <p className="mt-2 text-[0.68rem] text-slate-400">En espera de triage técnico</p>
                  </div>

                  {/* En Atención Activa */}
                  <div className="tarjeta p-4 sm:p-5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[0.68rem] font-bold tracking-wider uppercase">En Atención Activa</span>
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.65rem] font-semibold text-teal-700">
                        en diagnóstico
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{datos.por_estado.en_proceso ?? 1}</span>
                      <span className="rounded-md bg-teal-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-teal-600">
                        En proceso
                      </span>
                    </div>
                    <p className="mt-2 text-[0.68rem] text-slate-400">Técnico trabajando en sitio</p>
                  </div>

                  {/* Resueltas y Validadas */}
                  <div className="tarjeta p-4 sm:p-5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[0.68rem] font-bold tracking-wider uppercase">Resueltas y Validadas</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700">
                        satisfacción
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">
                        {(datos.por_estado.resuelta ?? 0) + (datos.por_estado.cerrada ?? 0) || 4}
                      </span>
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-600">
                        Resuelta
                      </span>
                    </div>
                    <p className="mt-2 text-[0.68rem] text-emerald-600 font-medium">100% concluidas con éxito</p>
                  </div>
                </div>

                {/* 2 Columnas: Tickets + Anuncios vs Accesos + Soporte */}
                <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                  {/* Columna Izquierda */}
                  <div className="space-y-4">
                    {/* Header de Últimas Incidencias */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900">Últimas Incidencias Registradas</h2>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.65rem] font-semibold text-slate-600">
                          {datos.recientes.filter((r) => r.estado !== 'resuelta' && r.estado !== 'cerrada').length}{' '}
                          activas
                        </span>
                      </div>
                      <a href="#/incidencias" className="text-xs font-semibold text-brand-600 hover:underline">
                        Ver todas mis solicitudes &rarr;
                      </a>
                    </div>

                    {/* Lista de Tarjetas de Incidencias */}
                    {datos.recientes.slice(0, 3).map((inc) => (
                      <div
                        key={inc.codigo}
                        className="rounded-2xl border border-slate-200/90 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <Folio codigo={inc.codigo} />
                            <InsigniaPrioridad prioridad={inc.prioridad} />
                            <InsigniaEstado estado={inc.estado} />
                          </div>
                          <span className="text-xs text-slate-400">{fecha(inc.fecha_creacion)}</span>
                        </div>

                        <h3 className="mt-3 text-sm font-bold text-slate-900">{inc.titulo}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2">
                          {inc.descripcion}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[0.72rem] text-slate-500">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="inline-flex items-center gap-1.5">
                              <Icono nombre="tag" className="size-3 text-slate-400" />
                              <strong className="text-slate-700">Categoría:</strong>{' '}
                              {CATEGORIAS[inc.categoria]?.nombre ?? inc.categoria}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Icono nombre="building" className="size-3 text-slate-400" />
                              <strong className="text-slate-700">Ubicación:</strong>{' '}
                              {inc.ubicacion?.edificio} · {inc.ubicacion?.aula_o_zona}
                            </span>
                            {inc.tecnico_asignado && (
                              <span className="inline-flex items-center gap-1.5">
                                <Icono nombre="user" className="size-3 text-slate-400" />
                                <strong className="text-slate-700">Técnico:</strong> {inc.tecnico_asignado}
                              </span>
                            )}
                          </div>

                          <a
                            href={`#/incidencias/${encodeURIComponent(inc.codigo)}`}
                            className="font-semibold text-brand-600 hover:underline"
                          >
                            Ver Detalle &rarr;
                          </a>
                        </div>
                      </div>
                    ))}

                    {/* Banner de Satisfacción */}
                    <div className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
                      <div className="flex items-center gap-2.5">
                        <span className="text-amber-500 font-bold">★</span>
                        <span>
                          Tasa de satisfacción institucional en resoluciones pasadas es del{' '}
                          <strong>100%</strong>. Las incidencias resueltas han sido concluidas satisfactoriamente.
                        </span>
                      </div>
                      <a href="#/incidencias" className="font-semibold text-amber-800 hover:underline shrink-0">
                        Consultar cerradas
                      </a>
                    </div>

                    {/* Tarjeta de Anuncio de Mantenimiento con foto de Campus */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
                      <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                        <img
                          src="/campus_edificios.jpg"
                          alt="Campus UTM Edificios"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-3 left-4 text-white">
                          <span className="rounded bg-brand-600/90 px-2 py-0.5 text-[0.62rem] font-bold tracking-wider uppercase">
                            Infraestructura y Red UTM
                          </span>
                          <h4 className="mt-1 text-sm font-bold">Mantenimiento preventivo en Edificio B y C</h4>
                        </div>
                      </div>
                      <div className="p-4 text-xs leading-relaxed text-slate-600">
                        Se realizan pruebas de enlaces de fibra óptica y remozamiento perimetral durante este fin de
                        semana. No afectará el sistema de reinscripción académica ni la conectividad del auditorio.
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha (Acceso directo + Mesa de Ayuda TI + Técnico en turno) */}
                  <div className="space-y-4">
                    {/* Acceso Directo */}
                    <div className="tarjeta p-5">
                      <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">Acceso Directo</h3>
                      <div className="mt-3 divide-y divide-slate-100">
                        <a
                          href="#/incidencias"
                          className="flex items-center justify-between py-2.5 text-xs font-medium text-slate-700 hover:text-brand-600"
                        >
                          <span>Mis Incidencias</span>
                          <Icono nombre="right" className="size-3.5 text-slate-400" />
                        </a>
                        <a
                          href="#/nueva"
                          className="flex items-center justify-between py-2.5 text-xs font-medium text-slate-700 hover:text-brand-600"
                        >
                          <div>
                            <p className="font-semibold">Nuevo Ticket</p>
                            <p className="text-[0.68rem] text-slate-400">Reportar fallo de aula o red</p>
                          </div>
                          <Icono nombre="right" className="size-3.5 text-slate-400" />
                        </a>
                        <div className="py-2.5">
                          <p className="text-xs font-semibold text-slate-700">Tiempos de Respuesta</p>
                          <p className="text-[0.68rem] text-slate-400 mt-0.5">Promedio: 2.4 hrs de atención</p>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: '88.2%' }} />
                          </div>
                          <div className="mt-1 flex justify-between text-[0.62rem] text-slate-400">
                            <span>88.2% dentro de SLA</span>
                            <span>Meta: &gt;85%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mesa de Ayuda TI (Dark Card) */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 p-5 text-white shadow-md">
                      <div className="flex items-center gap-2 text-teal-400">
                        <span className="grid size-7 place-items-center rounded-lg bg-white/10">
                          <Icono nombre="help" className="size-4" />
                        </span>
                        <div>
                          <p className="text-[0.62rem] font-bold tracking-wider uppercase text-slate-400">
                            Atención Inmediata
                          </p>
                          <p className="text-xs font-bold text-white">Mesa de Ayuda TI</p>
                        </div>
                      </div>

                      <p className="mt-3 text-[0.72rem] leading-relaxed text-slate-300">
                        ¿Tienes una emergencia durante clase o examen departamental? Comunícate de forma prioritaria con
                        la coordinación técnica del campus.
                      </p>

                      <div className="mt-4 space-y-2 text-[0.72rem] text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-teal-300">📞</span>
                          <span>Ext. 1200 / 1204 (Soporte Aulas)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-teal-300">✉</span>
                          <span>mesadeayuda@utm.mx</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-teal-300">⏱</span>
                          <span>Lunes a Viernes | 07:00 - 20:00 hrs</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => (window.location.hash = '#/nueva')}
                        className="mt-4 w-full rounded-xl bg-teal-500 px-4 py-2 text-center text-xs font-bold text-navy-950 transition hover:bg-teal-400 shadow-sm"
                      >
                        Contactar Soporte Urgente
                      </button>
                    </div>

                    {/* Técnico en turno */}
                    <div className="tarjeta p-4">
                      <p className="text-[0.65rem] font-bold tracking-wider text-slate-400 uppercase">
                        Técnico en turno Edificio B y C
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <img
                          src="/tecnico_javier.jpg"
                          alt="Técnico Javier Martínez"
                          className="size-11 rounded-full object-cover ring-2 ring-brand-500/30"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900">Ing. Javier Martínez</p>
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-emerald-700">
                              EN GUARDIA
                            </span>
                          </div>
                          <p className="text-[0.68rem] text-slate-500">Respuesta promedio en sitio: 12 min</p>
                          <p className="mt-0.5 text-[0.62rem] font-semibold text-brand-600">
                            UBICACIÓN: CC-102 (CENTRO DE CÓMPUTO)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ============================================================ */
              /* VISTA COORDINADOR / SOPORTE TI (Image 3 Left)                */
              /* ============================================================ */
              <div className="grid gap-6">
                {/* Header Operativo */}
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-[0.65rem] font-bold text-brand-700 tracking-wider uppercase">
                        Operación General TI · Enlazado a MongoDB Atlas
                      </span>
                    </div>
                    <h1 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
                      Panel de Control Operativo - Coordinador e Ingenieros de Soporte TI
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                      Despacho, diagnóstico concurrente, asignación de cuadrillas y ciclo de vida de tickets UTM.
                    </p>
                  </div>

                  {/* Switcher de Vista */}
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setVistaCoordinador(true)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        vistaCoordinador ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Vista Coordinador General
                    </button>
                    <button
                      type="button"
                      onClick={() => setVistaCoordinador(false)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        !vistaCoordinador ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Vista Técnico Asignado
                    </button>
                  </div>
                </div>

                {/* 5 KPI Cards */}
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
                  {/* Total */}
                  <div className="tarjeta p-4">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[0.65rem] font-bold tracking-wider uppercase">Total Incidencias</span>
                      <Icono nombre="list" className="size-4 text-brand-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{datos.total || 28}</span>
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[0.62rem] font-bold text-brand-700">
                        +12 hoy
                      </span>
                    </div>
                  </div>

                  {/* Abiertas */}
                  <div className="tarjeta p-4">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[0.65rem] font-bold tracking-wider uppercase">Incidencias Abiertas</span>
                      <Icono nombre="alert" className="size-4 text-blue-500" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-slate-900">{datos.por_estado.abierta ?? 5}</span>
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[0.62rem] font-bold text-blue-700">
                        en triage
                      </span>
                    </div>
                  </div>

                  {/* Críticas (Red Card) */}
                  <div className="tarjeta border-red-200 bg-red-50/40 p-4">
                    <div className="flex items-center justify-between text-red-700">
                      <span className="text-[0.65rem] font-bold tracking-wider uppercase">Incidencias Críticas</span>
                      <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-red-700">2</span>
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-red-800">
                        SLA &lt; 2h
                      </span>
                    </div>
                  </div>

                  {/* Sin Técnico (Yellow Card) */}
                  <div className="tarjeta border-amber-200 bg-amber-50/40 p-4">
                    <div className="flex items-center justify-between text-amber-700">
                      <span className="text-[0.65rem] font-bold tracking-wider uppercase">Sin Técnico Asignado</span>
                      <Icono nombre="user" className="size-4 text-amber-600" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-amber-700">3</span>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-amber-800">
                        Urgente
                      </span>
                    </div>
                  </div>

                  {/* Resueltas este Mes (Green Card) */}
                  <div className="tarjeta border-emerald-200 bg-emerald-50/40 p-4">
                    <div className="flex items-center justify-between text-emerald-700">
                      <span className="text-[0.65rem] font-bold tracking-wider uppercase">Resueltas Este Mes</span>
                      <Icono nombre="check" className="size-4 text-emerald-600" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-emerald-700">
                        {(datos.por_estado.resuelta ?? 0) + (datos.por_estado.cerrada ?? 0) || 18}
                      </span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-emerald-800">
                        89% SLA
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bandeja de Ejecución con Filtros Rápidos */}
                <div className="tarjeta overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-bold text-slate-900">Bandeja de Ejecución</h2>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.65rem] font-bold text-slate-600">
                        {datos.recientes.length} tickets en cola
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setTabBandeja('todos')}
                          className={`rounded-md px-3 py-1 font-semibold transition ${
                            tabBandeja === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setTabBandeja('criticos')}
                          className={`rounded-md px-3 py-1 font-semibold transition ${
                            tabBandeja === 'criticos' ? 'bg-white text-red-600 shadow-xs' : 'text-slate-500'
                          }`}
                        >
                          Críticos (2)
                        </button>
                        <button
                          type="button"
                          onClick={() => setTabBandeja('asignados')}
                          className={`rounded-md px-3 py-1 font-semibold transition ${
                            tabBandeja === 'asignados' ? 'bg-white text-brand-600 shadow-xs' : 'text-slate-500'
                          }`}
                        >
                          Mis asignados (1)
                        </button>
                      </div>

                      <a href="#/incidencias" className="boton boton-secundario text-xs">
                        <Icono nombre="filter" className="size-3.5" /> Filtrar aula...
                      </a>
                    </div>
                  </div>

                  {/* Tabla Operativa */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[50rem] text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[0.68rem] tracking-wider text-slate-500 uppercase">
                          <th className="px-4 py-3 font-semibold">Folio &amp; Fecha</th>
                          <th className="px-4 py-3 font-semibold">Asunto / Ubicación</th>
                          <th className="px-4 py-3 font-semibold">Categoría</th>
                          <th className="px-4 py-3 font-semibold">Prioridad</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Técnico Asignado</th>
                          <th className="px-4 py-3 text-right font-semibold">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {datos.recientes.slice(0, 6).map((item) => (
                          <tr key={item.codigo} className="transition hover:bg-slate-50/80">
                            <td className="px-4 py-3 align-top">
                              <Folio codigo={item.codigo} />
                              <p className="mt-0.5 text-[0.68rem] text-slate-400">{fecha(item.fecha_creacion)}</p>
                            </td>
                            <td className="max-w-xs px-4 py-3 align-top">
                              <p className="font-bold text-slate-900 truncate">{item.titulo}</p>
                              <p className="text-[0.68rem] text-slate-500">
                                {item.ubicacion?.edificio} · {item.ubicacion?.aula_o_zona}
                              </p>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <InsigniaCategoria categoria={item.categoria} />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <InsigniaPrioridad prioridad={item.prioridad} />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <InsigniaEstado estado={item.estado} />
                            </td>
                            <td className="px-4 py-3 align-top text-slate-600">
                              {item.tecnico_asignado ? (
                                <span className="font-medium text-slate-800">{item.tecnico_asignado}</span>
                              ) : (
                                <span className="rounded bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700">
                                  Sin Técnico
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right align-top">
                              <a
                                href={`#/incidencias/${encodeURIComponent(item.codigo)}`}
                                className="boton boton-secundario px-3 py-1 text-xs"
                              >
                                {item.estado === 'abierta'
                                  ? 'Asignar'
                                  : item.estado === 'en_proceso'
                                  ? 'Actualizar'
                                  : 'Ver'}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
                    <p className="text-[0.7rem]">
                      Regla de negocio: El cierre formal de tickets requiere autorización explícita de Coordinación.
                    </p>
                    <a href="#/incidencias" className="font-semibold text-brand-600 hover:underline">
                      Ver todas las {datos.total} incidencias &rarr;
                    </a>
                  </div>
                </div>

                {/* 2 Columnas Inferiores: Bitácora en Vivo + Infraestructura */}
                <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                  {/* Bitácora Técnica en Vivo */}
                  <div className="tarjeta p-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-xs font-bold text-slate-800">Bitácora Técnica en Vivo</h3>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-medium text-slate-500">
                        En directo · 3s
                      </span>
                    </div>

                    <div className="mt-3.5 space-y-3 text-xs">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex items-center justify-between text-[0.68rem] text-slate-400">
                          <span className="font-mono">12:40:15</span>
                          <span className="font-semibold text-brand-600">INC-20261019-CR-0017</span>
                        </div>
                        <p className="mt-1 font-semibold text-slate-800">
                          Tec. Javier Martínez añadió 1.5 horas técnicas:
                        </p>
                        <p className="mt-0.5 text-slate-600 italic">
                          "Se procedió al cambio de fábrica de antena UniFi U6-Pro y reasignación de VLAN 120."
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="flex items-center justify-between text-[0.68rem] text-slate-400">
                          <span className="font-mono">10:15:02</span>
                          <span className="font-semibold text-red-600">INC-20261019-IN-0012</span>
                        </div>
                        <p className="mt-1 font-semibold text-slate-800">
                          Ing. Javier Martínez (Coord.) escaló prioridad a Crítica
                        </p>
                        <p className="mt-0.5 text-slate-600 italic">
                          "Filtración de agua amenaza rack secundario de cableado estructurado."
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Infraestructura UTM */}
                  <div className="tarjeta p-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <Icono nombre="building" className="size-4 text-teal-600" />
                        <h3 className="text-xs font-bold text-slate-800">Infraestructura UTM</h3>
                      </div>
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[0.65rem] font-bold text-teal-700">
                        Monitoreo
                      </span>
                    </div>

                    <p className="mt-2 text-[0.7rem] text-slate-500">
                      Zonas con mayor reporte de incidencias en campus Huajuapan.
                    </p>

                    <div className="mt-4 space-y-3 text-xs">
                      <div>
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>Edificio B (Laboratorios)</span>
                          <span>11 incidencias</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: '65%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>Edificio C (Aulas Nuevas)</span>
                          <span>9 incidencias</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-orange-500" style={{ width: '48%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>Edificio A (Rectoría)</span>
                          <span>4 incidencias</span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: '22%' }} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[0.68rem] text-slate-400">
                      <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                        <span className="size-1.5 rounded-full bg-emerald-500" /> Clúster Nodos: 3/3 OK
                      </span>
                      <a href="#/analitica" className="font-bold text-brand-600 hover:underline">
                        Ver analítica &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Cargable>
    </div>
  )
}
