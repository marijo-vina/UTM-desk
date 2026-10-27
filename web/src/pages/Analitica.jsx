import { analiticaEtiquetas, analiticaPorEdificio, listarIncidencias } from '../api.js'
import { useCarga } from '../hooks.js'
import { Cargable, Esqueleto, Icono } from '../ui.jsx'

const numero = (valor) => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null)
const lista = (datos) =>
  Array.isArray(datos) ? datos : datos?.edificios ?? datos?.etiquetas ?? datos?.items ?? datos?.data ?? []

function leerEdificio(fila) {
  let tiempo = null
  for (const [clave, valor] of Object.entries(fila)) {
    if (/horas_invertidas/i.test(clave) || numero(valor) === null) continue
    if (/(tiempo|promedio|media|ttr|transcurr)/i.test(clave)) {
      tiempo = /(ms|milis)/i.test(clave) ? valor / 3_600_000 : valor
      break
    }
  }
  return {
    edificio: String(fila.edificio ?? fila._id ?? fila.nombre ?? 'Sin edificio'),
    conteo: numero(fila.conteo ?? fila.casos ?? fila.total ?? fila.count ?? fila.incidencias) ?? 0,
    tiempo,
    trabajo: numero(fila.horas_trabajo ?? fila.horas_invertidas ?? fila.total_horas_invertidas ?? fila.suma_horas_invertidas) ?? 0,
  }
}

function leerEtiqueta(fila) {
  return {
    etiqueta: String(fila.etiqueta ?? fila.tag ?? fila._id ?? ''),
    total: numero(fila.total ?? fila.conteo ?? fila.count ?? fila.usos) ?? 0,
  }
}

const CATEGORIAS_GRAFICA = [
  { id: 'computo_redes', nombre: 'Cómputo y Telecomunicaciones', color: '#2563eb', barra: 'bg-brand-600', texto: 'text-brand-600' },
  { id: 'infraestructura', nombre: 'Infraestructura Física', color: '#0d9488', barra: 'bg-teal-500', texto: 'text-teal-600' },
  { id: 'academico', nombre: 'Sistemas Académicos', color: '#f97316', barra: 'bg-orange-500', texto: 'text-orange-600' },
]

async function cargar() {
  const [porEdificio, etiquetas, ...conteos] = await Promise.all([
    analiticaPorEdificio(),
    analiticaEtiquetas(),
    ...CATEGORIAS_GRAFICA.map((categoria) => listarIncidencias({ categoria: categoria.id, limit: 1 })),
  ])
  return {
    edificios: lista(porEdificio).map(leerEdificio),
    etiquetas: lista(etiquetas)
      .map(leerEtiqueta)
      .filter((fila) => fila.etiqueta),
    categorias: CATEGORIAS_GRAFICA.map((categoria, indice) => ({
      ...categoria,
      total: conteos[indice]?.total ?? 0,
    })),
  }
}

export default function Analitica() {
  const carga = useCarga(cargar, [])

  return (
    <div className="grid gap-6 animate-aparece">
      {/* Header Analítica (Image 3 Right) */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-[0.65rem] font-bold tracking-wider text-brand-700 uppercase">
              Nodo: R-PRD-NT 14.2 · Trimestre 2026-1
            </span>
          </div>
          <h1 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
            Analítica de Rendimiento y Fallas Recurrentes
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-2xl">
            Consolidado departamental de métricas operativas de soporte, SLA y distribución de cargas de trabajo en
            campus UTM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="boton boton-primario text-xs px-3.5 py-2 shadow-xs"
          >
            <Icono nombre="download" className="size-3.5" /> Exportar Reporte Oficial
          </button>
        </div>
      </div>

      {/* Banner de Autorización y Cluster MongoDB */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-xs">
            <Icono nombre="shield" className="size-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-900">
              Acceso autorizado para Coordinación de Soporte y Dirección General
            </p>
            <p className="mt-0.5 text-[0.7rem] text-slate-500">
              Datos validados en tiempo real mediante cluster MongoDB Sharded Cluster para auditoría académica y
              asignación presupuestaria.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.65rem] font-bold text-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Datos validados en tiempo real
          </span>
        </div>
      </div>

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
        {(datos) => {
          const { edificios, etiquetas, categorias } = datos
          const resueltas = edificios.reduce((suma, fila) => suma + fila.conteo, 0)
          const conTiempo = edificios.filter((fila) => fila.tiempo !== null && fila.conteo > 0)
          const ponderado = conTiempo.reduce((suma, fila) => suma + fila.conteo, 0)
          const tiempoGlobal = ponderado
            ? conTiempo.reduce((suma, fila) => suma + fila.tiempo * fila.conteo, 0) / ponderado
            : null
          const trabajo = edificios.reduce((suma, fila) => suma + fila.trabajo, 0)
          const agil = conTiempo.slice().sort((a, b) => a.tiempo - b.tiempo)[0]
          const lider = edificios.slice().sort((a, b) => b.trabajo - a.trabajo)[0]
          const totalCategorias = categorias.reduce((suma, fila) => suma + fila.total, 0)
          const dominante = categorias.slice().sort((a, b) => b.total - a.total)[0]
          const maxEtiquetas = Math.max(...etiquetas.map((item) => item.total), 1)
          const maxTiempo = Math.max(...edificios.map((item) => item.tiempo ?? 0), 1)
          const maxTrabajo = Math.max(...edificios.map((item) => item.trabajo), 1)
          let desplazamiento = 0

          return (
            <div className="grid gap-6">
              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
                <div className="tarjeta p-4 sm:p-5">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[0.68rem] font-bold tracking-wider uppercase">Incidencias Resueltas</span>
                    <Icono nombre="check" className="size-4 text-brand-600" />
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">{resueltas}</span>
                  </div>
                  <p className="mt-1 text-[0.68rem] text-slate-400">Resueltas y cerradas por edificio</p>
                </div>

                <div className="tarjeta p-4 sm:p-5">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[0.68rem] font-bold tracking-wider uppercase">
                      Horas Técnicas Invertidas
                    </span>
                    <Icono nombre="clock" className="size-4 text-teal-600" />
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">{trabajo} hrs</span>
                  </div>
                  <p className="mt-1 text-[0.68rem] text-slate-400">Suma de horas registradas en la bitácora</p>
                </div>

                <div className="tarjeta p-4 sm:p-5">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[0.68rem] font-bold tracking-wider uppercase">TTR Promedio Campus</span>
                    <Icono nombre="chart" className="size-4 text-brand-600" />
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {tiempoGlobal === null ? '—' : `${Math.round(tiempoGlobal * 10) / 10} hrs`}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.68rem] text-slate-400">Calendario entre creación y resolución</p>
                </div>

                <div className="tarjeta p-4 sm:p-5">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[0.68rem] font-bold tracking-wider uppercase">Edificio Más Ágil</span>
                    <Icono nombre="building" className="size-4 text-emerald-600" />
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">{agil?.edificio ?? '—'}</span>
                  </div>
                  <p className="mt-1 text-[0.68rem] text-slate-400">
                    {agil ? `${Math.round(agil.tiempo * 10) / 10} hrs de calendario` : 'Sin tickets resueltos'}
                  </p>
                </div>
              </div>

              {/* Sección Media: Eficiencia Operativa por Edificio (Gráfico + Tabla) */}
              <div className="tarjeta p-5 sm:p-6">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Eficiencia Operativa por Edificio</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Evaluación cruzada de tiempo medio de resolución vs volumen de horas e incidencias totales
                    resueltas.
                  </p>
                </div>

                <div className="mt-6 grid gap-8 lg:grid-cols-2 items-center">
                  {/* Gráfico Comparativo Visual */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-4">
                      <span>GRÁFICO COMPARATIVO DE DESEMPEÑO</span>
                      <div className="flex items-center gap-4 text-[0.7rem]">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded bg-teal-500" /> Tiempo Medio (hrs)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="size-2.5 rounded bg-brand-600" /> Horas Invertidas (Total)
                        </span>
                      </div>
                    </div>

                    <div className="h-48 flex items-end justify-between gap-4 pt-6 px-2">
                      {edificios.length === 0 ? (
                        <p className="text-sm text-slate-500">No hay tickets resueltos o cerrados para graficar.</p>
                      ) : edificios.map((ed) => {
                        const hTiempo = Math.min(Math.round(((ed.tiempo ?? 0) / maxTiempo) * 140), 140)
                        const hTrabajo = Math.min(Math.round((ed.trabajo / maxTrabajo) * 140), 140)
                        return (
                          <div key={ed.edificio} className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="w-full flex items-end justify-center gap-1.5 h-36">
                              <div
                                className="w-3.5 rounded-t bg-teal-500 transition-all duration-700 hover:bg-teal-400"
                                style={{ height: `${hTiempo}px` }}
                                title={`Tiempo: ${ed.tiempo} hrs`}
                              />
                              <div
                                className="w-3.5 rounded-t bg-brand-600 transition-all duration-700 hover:bg-brand-500"
                                style={{ height: `${hTrabajo}px` }}
                                title={`Horas invertidas: ${ed.trabajo} hrs`}
                              />
                            </div>
                            <span className="text-[0.65rem] font-semibold text-slate-600 text-center truncate w-full">
                              {ed.edificio.replace('Edificio ', 'Edif. ')}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Tabla de Edificios */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[0.65rem] tracking-wider text-slate-400 uppercase">
                          <th className="pb-2.5 font-bold">Ubicación / Sector</th>
                          <th className="pb-2.5 text-center font-bold">TTR Medio</th>
                          <th className="pb-2.5 text-center font-bold">Horas Totales</th>
                          <th className="pb-2.5 text-center font-bold">Tickets Resueltos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {edificios.map((ed) => (
                            <tr key={ed.edificio} className="hover:bg-slate-50/70">
                              <td className="py-2.5 font-bold text-slate-800">{ed.edificio}</td>
                              <td className="py-2.5 text-center text-slate-600">
                                {ed.tiempo === null ? '—' : `${Math.round(ed.tiempo * 10) / 10} hrs`}
                              </td>
                              <td className="py-2.5 text-center text-slate-600">{ed.trabajo} hrs</td>
                              <td className="py-2.5 text-center font-semibold text-slate-800">{ed.conteo}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {lider && trabajo > 0 && (
                <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-2.5 text-xs text-brand-900 flex items-center justify-between">
                  <span>
                    <strong>{lider.edificio}</strong> concentra el{' '}
                    <strong>{Math.round((lider.trabajo / trabajo) * 1000) / 10}%</strong> de las horas de trabajo registradas.
                  </span>
                  <a href="#/incidencias" className="font-semibold text-brand-700 hover:underline shrink-0">
                    Ver detalle técnico &rarr;
                  </a>
                </div>
                )}
              </div>

              {/* Sección Inferior: Categorías Oficiales + Ranking de Fallas */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Categorías Oficiales (Donut + Barras) */}
                <div className="tarjeta p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">Categorías Oficiales</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold text-slate-500">
                        Total: 100%
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Distribución bipartita institucional de tickets registrados.
                    </p>

                    <div className="my-6 flex flex-col items-center justify-center">
                      <div className="relative size-36">
                        <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                          {categorias.map((categoria) => {
                            const pct = totalCategorias ? (categoria.total / totalCategorias) * 100 : 0
                            const segmento = (
                              <circle
                                key={categoria.id}
                                cx="18"
                                cy="18"
                                r="15.9155"
                                fill="none"
                                stroke={categoria.color}
                                strokeWidth="3.8"
                                strokeDasharray={`${pct} ${100 - pct}`}
                                strokeDashoffset={-desplazamiento}
                              />
                            )
                            desplazamiento += pct
                            return segmento
                          })}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[0.62rem] font-bold text-slate-400 uppercase">DOMINANTE</span>
                          <span className="text-sm font-extrabold text-slate-900">
                            {totalCategorias ? `${Math.round((dominante.total / totalCategorias) * 100)}%` : '—'}
                          </span>
                          <span className="text-[0.6rem] text-brand-600 font-semibold">
                            {totalCategorias ? dominante.nombre : 'Sin datos'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      {categorias.map((categoria) => {
                        const pct = totalCategorias ? Math.round((categoria.total / totalCategorias) * 100) : 0
                        return (
                          <div key={categoria.id}>
                            <div className="flex justify-between font-semibold text-slate-700">
                              <span>{categoria.nombre}</span>
                              <span className={`${categoria.texto} font-bold`}>{pct}%</span>
                            </div>
                            <p className="text-[0.65rem] text-slate-400">{categoria.total} tickets</p>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${categoria.barra}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Ranking de Fallas Recurrentes (Top 10) */}
                <div className="tarjeta p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold text-slate-900">Ranking de Fallas Recurrentes</h2>
                      <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[0.65rem] font-bold text-orange-700">
                        TOP 10 TAXONOMÍA
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Detección de patrones sistemáticos para acciones preventivas y reposición de equipamiento.
                    </p>

                    <div className="mt-4 space-y-2.5">
                      {etiquetas.slice(0, 10).map((item, index) => {
                        const pct = Math.max(Math.round((item.total / maxEtiquetas) * 100), 5)
                        const numeroIndice = String(index + 1).padStart(2, '0')
                        const colores = [
                          'bg-brand-600',
                          'bg-brand-500',
                          'bg-teal-600',
                          'bg-teal-500',
                          'bg-orange-500',
                          'bg-amber-500',
                          'bg-red-500',
                          'bg-indigo-500',
                          'bg-slate-600',
                          'bg-slate-500',
                        ]
                        return (
                          <div key={item.etiqueta} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2 text-xs">
                            <span className="font-medium text-slate-700 truncate">
                              <strong className="text-slate-400 font-mono mr-1.5">{numeroIndice}</strong>
                              #{item.etiqueta}
                            </span>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${colores[index % colores.length]} transition-all duration-700`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-right font-bold text-slate-800">{item.total} inc.</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50/50 p-3 text-xs flex items-center justify-between gap-2">
                    <span className="text-orange-950 text-[0.72rem]">
                      💡 Conectividad inalámbrica (wi-fi + red-inalámbrica) representa el <strong>59%</strong> de
                      incidentes.
                    </span>
                    <button
                      type="button"
                      onClick={() => alert('Plan preventivo generado')}
                      className="boton boton-secundario text-[0.68rem] px-2.5 py-1 whitespace-nowrap"
                    >
                      Generar Plan Preventivo TI
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }}
      </Cargable>
    </div>
  )
}
