import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { actualizarIncidencia, agregarTag, eliminarIncidencia, obtenerIncidencia, quitarTag } from '../api.js'
import { ESTADOS, ETIQUETAS_DETALLE, fechaHora, horas, PERMISOS, transiciones, valorDetalle } from '../format.js'
import { useCarga } from '../hooks.js'
import { ir } from '../router.js'
import { Alerta, Cargable, Esqueleto, Folio, Icono, InsigniaCategoria, InsigniaEstado, InsigniaPrioridad, Modal } from '../ui.jsx'

const PATRON_TAG = /^[a-z0-9áéíóúüñ-]{2,30}$/

function Seccion({ titulo, icono, children, derecha }) {
  return (
    <section className="tarjeta p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          {icono && <Icono nombre={icono} className="size-4 text-brand-600" />}
          {titulo}
        </h2>
        {derecha}
      </div>
      {children}
    </section>
  )
}

function Dato({ etiqueta, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-linea py-2 text-sm last:border-0">
      <dt className="text-suave">{etiqueta}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

export function Contenido({ incidencia, usuario, recargar, alCerrar }) {
  const rol = usuario.rol
  const puedeAtender = PERMISOS.atiende.includes(rol)
  const puedeEtiquetar = PERMISOS.etiqueta.includes(rol)
  const destinos = transiciones(incidencia.estado, rol)

  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState('')
  const [comentario, setComentario] = useState('')
  const [horasTexto, setHorasTexto] = useState('')
  const [estado, setEstado] = useState('')
  const [tecnico, setTecnico] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [confirmar, setConfirmar] = useState(null)

  async function ejecutar(accion, mensaje) {
    if (ocupado) return false
    setOcupado(true)
    setError(null)
    setExito('')
    try {
      await accion()
      setExito(mensaje)
      recargar()
      return true
    } catch (causa) {
      setError(causa)
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function guardarSeguimiento(evento, confirmado = false) {
    evento?.preventDefault()
    const cambios = {}
    if (estado) cambios.estado = estado
    if (comentario.trim()) cambios.comentario = comentario.trim()
    if (horasTexto.trim()) {
      const valor = Number(horasTexto)
      if (!Number.isFinite(valor) || valor < 0) return setError(new Error('Las horas deben ser un número mayor o igual a 0.'))
      cambios.horas_registradas = valor
    }
    if (!Object.keys(cambios).length) return setError(new Error('Escribe un comentario, registra horas o elige un nuevo estado.'))
    if (estado === 'cerrada' && !confirmado) return setConfirmar('cerrar')
    setConfirmar(null)
    const guardado = await ejecutar(() => actualizarIncidencia(incidencia.codigo, cambios), 'Seguimiento registrado en la bitácora.')
    if (guardado) {
      setComentario('')
      setHorasTexto('')
      setEstado('')
    }
  }

  async function asignar(evento) {
    evento.preventDefault()
    const correo = tecnico.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return setError(new Error('Escribe el correo institucional del técnico.'))
    const guardado = await ejecutar(() => actualizarIncidencia(incidencia.codigo, { tecnico_asignado: correo }), 'Técnico asignado.')
    if (guardado) setTecnico('')
  }

  async function agregar(evento) {
    evento.preventDefault()
    const tag = etiqueta.trim().toLowerCase()
    if (!PATRON_TAG.test(tag)) return setError(new Error('La etiqueta debe tener de 2 a 30 caracteres: letras minúsculas, números o guion.'))
    const guardado = await ejecutar(() => agregarTag(incidencia.codigo, tag), 'Etiqueta agregada.')
    if (guardado) setEtiqueta('')
  }

  async function eliminar() {
    setConfirmar(null)
    if (ocupado) return
    setOcupado(true)
    setError(null)
    try {
      await eliminarIncidencia(incidencia.codigo)
      ir('incidencias')
    } catch (causa) {
      setError(causa)
      setOcupado(false)
    }
  }

  const historial = [...(incidencia.historial_seguimiento ?? [])].reverse()
  const detalle = Object.entries(incidencia.detalle_especifico ?? {})

  return (
    <div className={`flex flex-col h-full overflow-hidden ${alCerrar ? 'bg-slate-50/70' : 'grid gap-6'}`}>
      {/* Cabecera del Expediente Digital */}
      {alCerrar ? (
        <div className="bg-navy-950 text-white px-6 py-5 shrink-0 border-b border-navy-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-navy-800 text-slate-300 border border-navy-700">
                {incidencia.codigo}
              </span>
              <InsigniaEstado estado={incidencia.estado} />
              <InsigniaPrioridad prioridad={incidencia.prioridad} />
              <InsigniaCategoria categoria={incidencia.categoria} />
            </div>
            <button
              type="button"
              onClick={alCerrar}
              className="grid size-8 place-items-center rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition"
              aria-label="Cerrar expediente"
              title="Cerrar (Esc)"
            >
              <Icono nombre="x" className="size-4" />
            </button>
          </div>
          <div className="mt-3">
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Expediente Digital de Incidencia
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-300 font-medium line-clamp-1">
              {incidencia.titulo}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <a href="#/incidencias" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            <Icono nombre="left" /> Volver a incidencias
          </a>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Folio codigo={incidencia.codigo} />
            <InsigniaEstado estado={incidencia.estado} />
            <InsigniaPrioridad prioridad={incidencia.prioridad} />
            <InsigniaCategoria categoria={incidencia.categoria} />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{incidencia.titulo}</h1>
        </div>
      )}

      {/* Cuerpo scrolleable del Expediente */}
      <div className={`${alCerrar ? 'flex-1 overflow-y-auto p-5 sm:p-6 space-y-5' : 'grid gap-6'}`}>
        {error && (
          <Alerta>
            <p className="font-semibold">{error.message}</p>
          </Alerta>
        )}
        {exito && !error && <Alerta tipo="exito">{exito}</Alerta>}

        {/* Tarjeta superior de 3 columnas: Reportante, Técnico, Horas */}
        <div className="tarjeta p-4 sm:p-5 bg-white">
          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-y-0 sm:divide-x sm:divide-slate-200">
            <div className="sm:pr-4 py-2 sm:py-0">
              <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
                Reportante
              </span>
              <p className="mt-1 font-bold text-slate-900 text-sm">
                {incidencia.reportante?.nombre ?? '—'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {incidencia.reportante?.rol ?? incidencia.reportante?.correo ?? 'Docente Titular'}
              </p>
            </div>
            <div className="sm:px-4 py-2 sm:py-0">
              <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
                Técnico Asignado
              </span>
              <p className="mt-1 font-bold text-brand-600 text-sm truncate">
                {incidencia.tecnico_nombre || incidencia.tecnico_asignado || 'Sin asignar'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {incidencia.tecnico_asignado ? 'Soporte Redes Campus' : 'Pendiente de asignación'}
              </p>
            </div>
            <div className="sm:pl-4 py-2 sm:py-0">
              <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
                Horas Acumuladas
              </span>
              <p className="mt-1 font-bold text-brand-600 text-sm">
                {horas(incidencia.horas_invertidas ?? 0)} registradas
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">
                {incidencia.estado === 'resuelta' || incidencia.estado === 'cerrada'
                  ? 'Atención concluida'
                  : 'Dentro de SLA (Máx 4h)'}
              </p>
            </div>
          </div>
        </div>

        {/* Diagnóstico de Infraestructura y Detalle Específico */}
        <section className="tarjeta p-5 sm:p-6 bg-white">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Icono nombre="server" className="size-4 text-brand-600" />
              Diagnóstico de Infraestructura de Red
            </h2>
            {incidencia.ubicacion?.edificio && (
              <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-600">
                {incidencia.ubicacion.edificio} · {incidencia.ubicacion.aula_o_zona}
              </span>
            )}
          </div>

          {detalle.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {detalle.map(([clave, valor]) => (
                <div key={clave} className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                  <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 truncate">
                    {ETIQUETAS_DETALLE[clave] ?? clave}
                  </span>
                  <span className="mt-1 block text-sm font-bold text-slate-900 truncate" title={valorDetalle(valor)}>
                    {valorDetalle(valor)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-slate-50/70 border border-slate-200/60 p-3.5">
            <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Descripción del problema
            </span>
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {incidencia.descripcion}
            </p>
          </div>
        </section>

        {/* Evidencias Adjuntas */}
        <section className="tarjeta p-5 sm:p-6 bg-white">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Icono nombre="clip" className="size-4 text-brand-600" />
              Evidencias Adjuntas ({incidencia.evidencias_adjuntas?.length ?? 0})
            </h2>
          </div>
          {(incidencia.evidencias_adjuntas ?? []).length === 0 ? (
            <p className="text-sm text-suave">Esta incidencia no tiene evidencias adjuntas.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {incidencia.evidencias_adjuntas.map((evidencia) => {
                const enlace = evidencia.url ?? evidencia.url_firmada
                const esImagen = evidencia.tipo_mime?.startsWith('image/')
                return (
                  <div key={evidencia.url_storage ?? evidencia.nombre_archivo} className="rounded-xl border border-linea overflow-hidden bg-slate-50/50">
                    {esImagen && enlace && (
                      <div className="h-32 w-full overflow-hidden bg-slate-100 border-b border-linea">
                        <img src={enlace} alt={evidencia.nombre_archivo} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{evidencia.nombre_archivo}</p>
                        <p className="text-[0.68rem] text-slate-500 mt-0.5">{evidencia.peso_kb} KB</p>
                      </div>
                      {enlace && (
                        <a href={enlace} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-600 hover:text-brand-700 shrink-0">
                          Ver ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Etiquetas Técnicas */}
        <section className="tarjeta p-5 sm:p-6 bg-white">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Icono nombre="tag" className="size-4 text-brand-600" />
              Etiquetas Técnicas
            </h2>
            <span className="text-[0.68rem] text-slate-400">Etiquetado dinámico para métricas NoSQL</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(incidencia.tags ?? []).length === 0 && <p className="text-xs text-suave">Sin etiquetas.</p>}
            {(incidencia.tags ?? []).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 text-xs font-medium text-slate-700" style={{ paddingRight: puedeEtiquetar ? '0.35rem' : '0.75rem' }}>
                #{tag}
                {puedeEtiquetar && (
                  <button type="button" aria-label={`Quitar etiqueta ${tag}`} disabled={ocupado} className="grid size-4 place-items-center rounded-full hover:bg-slate-300" onClick={() => ejecutar(() => quitarTag(incidencia.codigo, tag), 'Etiqueta eliminada.')}>
                    <Icono nombre="x" className="size-3" />
                  </button>
                )}
              </span>
            ))}
            {puedeEtiquetar && (
              <form onSubmit={agregar} className="flex items-center gap-1.5 ml-1">
                <input id="detalle-etiqueta" className="campo text-xs py-1 px-2.5 w-32" placeholder="Añadir tag..." maxLength={30} value={etiqueta} onChange={(evento) => setEtiqueta(evento.target.value)} aria-label="Nueva etiqueta" />
                <button className="grid size-7 place-items-center rounded-full bg-brand-600 text-white hover:bg-brand-500 shrink-0" disabled={ocupado || !etiqueta.trim()}>
                  <Icono nombre="plus" className="size-3.5" />
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Línea de Tiempo y Bitácora de Auditoría */}
        <section className="tarjeta p-5 sm:p-6 bg-white">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Icono nombre="clock" className="size-4 text-brand-600" />
              Línea de Tiempo y Bitácora de Auditoría
            </h2>
            <span className="text-xs font-semibold text-slate-400">{historial.length} Eventos</span>
          </div>
          <ol className="relative grid gap-5 border-l-2 border-linea pl-6 ml-2">
            {historial.map((evento, indice) => (
              <li key={`${evento.fecha}-${indice}`} className="relative">
                <span className={`absolute top-1.5 -left-[1.95rem] size-3 rounded-full ring-4 ring-white ${indice === 0 ? 'bg-brand-600' : 'bg-slate-300'}`} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm text-slate-900">{evento.autor}</span>
                  <span className="text-xs text-suave">{fechaHora(evento.fecha)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <InsigniaEstado estado={evento.estado_resultante} />
                  <span className="text-[0.68rem] text-slate-400">Canal: Portal Web Autoservicio</span>
                </div>
                <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200/70 p-3 text-xs sm:text-sm text-slate-700">
                  <p>{evento.comentario}</p>
                  {evento.horas_registradas > 0 && (
                    <p className="mt-1 text-xs text-brand-600 font-semibold">
                      · {horas(evento.horas_registradas)} registradas
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Formulario de Seguimiento / Asignación si aplica */}
        {puedeAtender && incidencia.estado !== 'cerrada' && (
          <section className="tarjeta p-5 sm:p-6 bg-white">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
              <Icono nombre="send" className="size-4 text-brand-600" />
              Registrar nuevo seguimiento en bitácora
            </h2>
            <form onSubmit={guardarSeguimiento} className="grid gap-3">
              {destinos.length > 0 && (
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Cambiar estado
                  <select id="detalle-estado" className="campo text-xs" value={estado} onChange={(evento) => setEstado(evento.target.value)}>
                    <option value="">Mantener «{ESTADOS[incidencia.estado]}»</option>
                    {destinos.map((destino) => (
                      <option key={destino} value={destino}>
                        {ESTADOS[destino]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Comentario de la acción
                <textarea id="detalle-comentario" className="campo text-xs" rows={3} maxLength={1000} value={comentario} onChange={(evento) => setComentario(evento.target.value)} placeholder="Describe la acción realizada o avances..." />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Horas invertidas
                <input id="detalle-horas" className="campo text-xs" inputMode="decimal" placeholder="0" value={horasTexto} onChange={(evento) => setHorasTexto(evento.target.value)} />
              </label>
              <button className="boton boton-primario text-xs" disabled={ocupado}>
                {ocupado ? 'Guardando…' : 'Guardar en bitácora'}
              </button>
            </form>
          </section>
        )}

        {PERMISOS.asigna.includes(rol) && incidencia.estado !== 'cerrada' && incidencia.estado !== 'resuelta' && (
          <section className="tarjeta p-5 sm:p-6 bg-white">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
              <Icono nombre="user" className="size-4 text-brand-600" />
              Asignar técnico responsable
            </h2>
            <form onSubmit={asignar} className="flex gap-2">
              <input id="detalle-tecnico" className="campo text-xs" type="email" placeholder="correo.tecnico@utm.mx" value={tecnico} onChange={(evento) => setTecnico(evento.target.value)} aria-label="Correo del técnico" />
              <button className="boton boton-secundario text-xs shrink-0" disabled={ocupado || !tecnico.trim()}>
                Asignar
              </button>
            </form>
          </section>
        )}

        {PERMISOS.elimina.includes(rol) && (
          <div className="pt-2">
            <button type="button" className="boton boton-peligro text-xs" disabled={ocupado} onClick={() => setConfirmar('eliminar')}>
              <Icono nombre="trash" /> Eliminar incidencia
            </button>
          </div>
        )}
      </div>

      {/* Barra inferior fija */}
      <div className="shrink-0 bg-white border-t border-linea px-6 py-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        {alCerrar ? (
          <button
            type="button"
            className="boton boton-secundario text-xs"
            onClick={alCerrar}
          >
            Cerrar
          </button>
        ) : (
          <a href="#/incidencias" className="boton boton-secundario text-xs">
            Volver
          </a>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="boton boton-secundario text-xs inline-flex items-center gap-1.5"
            onClick={() => window.print()}
          >
            <Icono nombre="clip" className="size-3.5" /> Imprimir Bitácora
          </button>
          {puedeAtender && incidencia.estado !== 'resuelta' && incidencia.estado !== 'cerrada' && (
            <button
              type="button"
              className="boton boton-primario bg-emerald-600 hover:bg-emerald-500 text-xs inline-flex items-center gap-1.5 shadow-sm"
              disabled={ocupado}
              onClick={async () => {
                await ejecutar(
                  () => actualizarIncidencia(incidencia.codigo, { estado: 'resuelta', comentario: 'Incidencia marcada como resuelta.' }),
                  'Incidencia resuelta satisfactoriamente.',
                )
              }}
            >
              <Icono nombre="check" className="size-3.5" /> Resolver Incidencia
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Detalle({ codigo, alCerrar }) {
  const { usuario } = useAuth()
  const carga = useCarga(() => obtenerIncidencia(codigo), [codigo])
  return (
    <Cargable
      carga={carga}
      esqueleto={
        <div className="grid gap-4">
          <Esqueleto className="h-20" />
          <Esqueleto className="h-64" />
        </div>
      }
    >
      {(incidencia) => (
        <Contenido
          key={incidencia.codigo}
          incidencia={incidencia}
          usuario={usuario}
          recargar={carga.recargar}
          alCerrar={alCerrar}
        />
      )}
    </Cargable>
  )
}
