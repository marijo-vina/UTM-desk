import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { listarIncidencias } from '../api.js'
import { CATEGORIAS, EDIFICIOS, ESTADOS, PERMISOS } from '../format.js'
import { useCarga, useRetraso } from '../hooks.js'
import { useRuta } from '../router.js'
import { Cargable, Esqueleto, Icono, Paginacion, Vacio } from '../ui.jsx'
import TablaIncidencias from './TablaIncidencias.jsx'
import Detalle from './Detalle.jsx'

export default function Incidencias() {
  const { usuario } = useAuth()
  const { consulta } = useRuta()
  const desdeBuscador = consulta.get('q') ?? ''
  const [q, setQ] = useState(desdeBuscador)
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState('')
  const [edificio, setEdificio] = useState('')
  const [pagina, setPagina] = useState(1)
  const [incidenciaSeleccionada, setIncidenciaSeleccionada] = useState(null)
  const qRetrasado = useRetraso(q.trim())

  useEffect(() => {
    setQ(desdeBuscador)
    setPagina(1)
  }, [desdeBuscador])

  const carga = useCarga(
    () => listarIncidencias({ q: qRetrasado, categoria, estado, edificio, page: pagina, limit: 10 }),
    [qRetrasado, categoria, estado, edificio, pagina],
  )

  const filtrado = Boolean(q || categoria || estado || edificio)
  const esReportante = usuario.rol === 'reportante'
  const cambiar = (poner) => (evento) => {
    poner(evento.target.value)
    setPagina(1)
  }

  return (
    <div className="relative grid gap-6 animate-aparece">
      {/* Encabezado con métricas rápidas */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-[0.65rem] font-bold tracking-wider text-brand-700 uppercase">
              Módulo de Seguimiento &gt; Tiempo Real
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
              {esReportante ? 'Mis Incidencias' : 'Incidencias del Campus'}
            </h1>
            {carga.datos && (
              <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-600">
                {carga.datos.total} tickets encontrados
              </span>
            )}
          </div>
        </div>

        {/* Píldoras de estado en tiempo real */}
        {carga.datos && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 font-semibold text-blue-700">
              <span className="size-2 rounded-full bg-blue-500" />
              Abiertas: {carga.datos.items.filter((i) => i.estado === 'abierta').length}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 font-semibold text-amber-700">
              <span className="size-2 rounded-full bg-amber-500" />
              En proceso:{' '}
              {carga.datos.items.filter((i) => i.estado === 'en_proceso' || i.estado === 'en_espera').length}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-500" />
              Resueltas: {carga.datos.items.filter((i) => i.estado === 'resuelta' || i.estado === 'cerrada').length}
            </span>
          </div>
        )}
      </div>

      <div className="tarjeta overflow-hidden">
        {/* Barra de Filtros */}
        <div className="grid gap-3 border-b border-linea p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Icono
              nombre="search"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="filtro-q"
              className="campo pl-10 text-xs"
              placeholder="Buscar por Folio, Título o Descripción..."
              value={q}
              onChange={cambiar(setQ)}
              aria-label="Buscar"
            />
          </div>
          <select
            id="filtro-categoria"
            className="campo text-xs lg:w-48"
            value={categoria}
            onChange={cambiar(setCategoria)}
            aria-label="Categoría"
          >
            <option value="">Categoría: Todas</option>
            {Object.entries(CATEGORIAS).map(([clave, datos]) => (
              <option key={clave} value={clave}>
                {datos.nombre}
              </option>
            ))}
          </select>
          <select
            id="filtro-estado"
            className="campo text-xs lg:w-40"
            value={estado}
            onChange={cambiar(setEstado)}
            aria-label="Estado"
          >
            <option value="">Estado: Todos</option>
            {Object.entries(ESTADOS).map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {nombre}
              </option>
            ))}
          </select>
          <select
            id="filtro-edificio"
            className="campo text-xs lg:w-40"
            value={edificio}
            onChange={cambiar(setEdificio)}
            aria-label="Edificio"
          >
            <option value="">Edificio: Todos</option>
            {EDIFICIOS.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="boton boton-secundario text-xs"
            disabled={!filtrado}
            onClick={() => {
              setQ('')
              setCategoria('')
              setEstado('')
              setEdificio('')
              setPagina(1)
              if (desdeBuscador) window.location.hash = '#/incidencias'
            }}
          >
            <Icono nombre="refresh" className="size-3.5" /> Limpiar
          </button>
        </div>

        <Cargable
          carga={carga}
          esqueleto={
            <div className="grid gap-3 p-4">
              {[0, 1, 2, 3].map((n) => (
                <Esqueleto key={n} className="h-14" />
              ))}
            </div>
          }
        >
          {(datos) =>
            datos.items.length === 0 ? (
              <Vacio
                icono="list"
                titulo={filtrado ? 'Sin resultados para estos filtros' : 'Aún no hay incidencias'}
                texto={
                  filtrado
                    ? 'Prueba con otros criterios de búsqueda.'
                    : esReportante
                    ? 'Cuando registres una incidencia aparecerá aquí.'
                    : 'Cuando se registren incidencias aparecerán aquí.'
                }
              >
                {!filtrado && PERMISOS.registra.includes(usuario.rol) && (
                  <a href="#/nueva" className="boton boton-primario mt-2">
                    <Icono nombre="plus" /> Registrar incidencia
                  </a>
                )}
              </Vacio>
            ) : (
              <>
                <TablaIncidencias
                  items={datos.items}
                  mostrarReportante={!esReportante}
                  onVer={(inc) => setIncidenciaSeleccionada(inc.codigo)}
                />
                <div className="flex flex-wrap items-center justify-between border-t border-linea px-4 py-3 text-xs text-suave">
                  <p>
                    Mostrando {(datos.pagina - 1) * 10 + 1}-{Math.min(datos.pagina * 10, datos.total)} de{' '}
                    {datos.total} resultados
                  </p>
                  <Paginacion
                    pagina={datos.pagina}
                    paginas={datos.paginas}
                    total={datos.total}
                    alCambiar={setPagina}
                  />
                </div>
              </>
            )
          }
        </Cargable>
      </div>

      {/* Pestaña deslizable / Drawer Lateral de Expediente Digital */}
      {incidenciaSeleccionada && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-navy-950/60 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => {
            setIncidenciaSeleccionada(null)
            carga.recargar()
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative h-full w-full max-w-4xl md:max-w-3xl lg:w-[60vw] lg:max-w-5xl overflow-y-auto bg-white p-6 shadow-2xl transition-transform animate-drawer border-l border-linea sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <Detalle
              codigo={incidenciaSeleccionada}
              alCerrar={() => {
                setIncidenciaSeleccionada(null)
                carga.recargar()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
