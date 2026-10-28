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
    <div className="grid gap-6 animate-aparece">
      <div>
        {alCerrar ? (
          <div className="flex items-center justify-between pb-2 border-b border-linea">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Expediente Digital de Incidencia
            </span>
            <button
              type="button"
              onClick={alCerrar}
              className="grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              aria-label="Cerrar modal"
            >
              <Icono nombre="x" className="size-5" />
            </button>
          </div>
        ) : (
          <a href="#/incidencias" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
            <Icono nombre="left" /> Volver a incidencias
          </a>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <Folio codigo={incidencia.codigo} />
          <InsigniaEstado estado={incidencia.estado} />
          <InsigniaPrioridad prioridad={incidencia.prioridad} />
          <InsigniaCategoria categoria={incidencia.categoria} />
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{incidencia.titulo}</h1>
      </div>

      {error && (
        <Alerta>
          <p className="font-semibold">{error.message}</p>
        </Alerta>
      )}
      {exito && !error && <Alerta tipo="exito">{exito}</Alerta>}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6">
          <Seccion titulo="Descripción" icono="list">
            <p className="text-sm leading-relaxed whitespace-pre-line">{incidencia.descripcion}</p>
          </Seccion>

          {detalle.length > 0 && (
            <Seccion titulo="Detalle específico" icono="server">
              <dl className="grid gap-x-8 sm:grid-cols-2">
                {detalle.map(([clave, valor]) => (
                  <Dato key={clave} etiqueta={ETIQUETAS_DETALLE[clave] ?? clave}>
                    {valorDetalle(valor)}
                  </Dato>
                ))}
              </dl>
            </Seccion>
          )}

          <Seccion titulo="Etiquetas" icono="tag">
            <div className="flex flex-wrap gap-1.5">
              {(incidencia.tags ?? []).length === 0 && <p className="text-sm text-suave">Sin etiquetas.</p>}
              {(incidencia.tags ?? []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 text-xs font-medium text-slate-700" style={{ paddingRight: puedeEtiquetar ? '0.25rem' : '0.625rem' }}>
                  #{tag}
                  {puedeEtiquetar && (
                    <button type="button" aria-label={`Quitar etiqueta ${tag}`} disabled={ocupado} className="grid size-4 place-items-center rounded-full hover:bg-slate-300" onClick={() => ejecutar(() => quitarTag(incidencia.codigo, tag), 'Etiqueta eliminada.')}>
                      <Icono nombre="x" className="size-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {puedeEtiquetar && (
              <form onSubmit={agregar} className="mt-3 flex gap-2">
                <input id="detalle-etiqueta" className="campo" placeholder="Nueva etiqueta" maxLength={30} value={etiqueta} onChange={(evento) => setEtiqueta(evento.target.value)} aria-label="Nueva etiqueta" />
                <button className="boton boton-secundario" disabled={ocupado || !etiqueta.trim()}>
                  Agregar
                </button>
              </form>
            )}
          </Seccion>

          <Seccion titulo={`Evidencias (${incidencia.evidencias_adjuntas?.length ?? 0})`} icono="clip">
            {(incidencia.evidencias_adjuntas ?? []).length === 0 ? (
              <p className="text-sm text-suave">Esta incidencia no tiene evidencias adjuntas.</p>
            ) : (
              <ul className="grid gap-2">
                {incidencia.evidencias_adjuntas.map((evidencia) => {
                  const enlace = evidencia.url ?? evidencia.url_firmada
                  return (
                    <li key={evidencia.url_storage ?? evidencia.nombre_archivo} className="flex items-center justify-between gap-3 rounded-xl border border-linea px-3.5 py-2.5 text-sm">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                          <Icono nombre="clip" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{evidencia.nombre_archivo}</span>
                          <span className="block text-xs text-suave">
                            {evidencia.tipo_mime} · {evidencia.peso_kb} KB · {fechaHora(evidencia.fecha_carga)}
                          </span>
                        </span>
                      </span>
                      {enlace && (
                        <a href={enlace} target="_blank" rel="noreferrer" className="boton boton-secundario px-3 py-1.5 text-xs">
                          Abrir
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Seccion>

          <Seccion titulo="Historial de seguimiento" icono="clock">
            <ol className="relative grid gap-5 border-l-2 border-linea pl-6">
              {historial.map((evento, indice) => (
                <li key={`${evento.fecha}-${indice}`} className="relative">
                  <span className={`absolute top-1 -left-[1.95rem] size-3 rounded-full ring-4 ring-white ${indice === 0 ? 'bg-brand-600' : 'bg-slate-300'}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <InsigniaEstado estado={evento.estado_resultante} />
                    <span className="text-xs text-suave">{fechaHora(evento.fecha)}</span>
                  </div>
                  <p className="mt-1.5 text-sm">{evento.comentario}</p>
                  <p className="mt-0.5 text-xs text-suave">
                    {evento.autor}
                    {evento.horas_registradas > 0 && ` · ${horas(evento.horas_registradas)} registradas`}
                  </p>
                </li>
              ))}
            </ol>
          </Seccion>
        </div>

        <aside className="grid content-start gap-6">
          <Seccion titulo="Información" icono="user">
            <dl>
              <Dato etiqueta="Reportante">{incidencia.reportante?.nombre ?? '—'}</Dato>
              <Dato etiqueta="Ubicación">
                {incidencia.ubicacion?.edificio}
                <span className="block text-xs font-normal text-suave">{incidencia.ubicacion?.aula_o_zona}</span>
              </Dato>
              <Dato etiqueta="Técnico">{incidencia.tecnico_nombre || incidencia.tecnico_asignado || 'Sin asignar'}</Dato>
              <Dato etiqueta="Horas invertidas">{horas(incidencia.horas_invertidas ?? 0)}</Dato>
              <Dato etiqueta="Creada">{fechaHora(incidencia.fecha_creacion)}</Dato>
              {incidencia.fecha_resolucion && <Dato etiqueta="Resuelta">{fechaHora(incidencia.fecha_resolucion)}</Dato>}
            </dl>
          </Seccion>

          {puedeAtender && incidencia.estado !== 'cerrada' && (
            <Seccion titulo="Registrar seguimiento" icono="send">
              <form onSubmit={guardarSeguimiento} className="grid gap-3">
                {destinos.length > 0 && (
                  <label className="grid gap-1.5 text-sm font-medium">
                    Cambiar estado
                    <select id="detalle-estado" className="campo" value={estado} onChange={(evento) => setEstado(evento.target.value)}>
                      <option value="">Mantener «{ESTADOS[incidencia.estado]}»</option>
                      {destinos.map((destino) => (
                        <option key={destino} value={destino}>
                          {ESTADOS[destino]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="grid gap-1.5 text-sm font-medium">
                  Comentario
                  <textarea id="detalle-comentario" className="campo" rows={3} maxLength={1000} value={comentario} onChange={(evento) => setComentario(evento.target.value)} placeholder="Describe la acción realizada…" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Horas de trabajo
                  <input id="detalle-horas" className="campo" inputMode="decimal" placeholder="0" value={horasTexto} onChange={(evento) => setHorasTexto(evento.target.value)} />
                </label>
                <button className="boton boton-primario" disabled={ocupado}>
                  {ocupado ? 'Guardando…' : 'Guardar en bitácora'}
                </button>
                <p className="text-xs text-suave">El historial es de solo adición: no se edita ni se borra.</p>
              </form>
            </Seccion>
          )}

          {PERMISOS.asigna.includes(rol) && incidencia.estado !== 'cerrada' && incidencia.estado !== 'resuelta' && (
            <Seccion titulo="Asignar técnico" icono="user">
              <form onSubmit={asignar} className="grid gap-3">
                <input id="detalle-tecnico" className="campo" type="email" placeholder="correo.tecnico@utm.mx" value={tecnico} onChange={(evento) => setTecnico(evento.target.value)} aria-label="Correo del técnico" />
                <button className="boton boton-secundario" disabled={ocupado || !tecnico.trim()}>
                  Asignar
                </button>
              </form>
            </Seccion>
          )}

          {PERMISOS.elimina.includes(rol) && (
            <button type="button" className="boton boton-peligro" disabled={ocupado} onClick={() => setConfirmar('eliminar')}>
              <Icono nombre="trash" /> Eliminar incidencia
            </button>
          )}
        </aside>
      </div>

      {confirmar === 'eliminar' && (
        <Modal titulo="¿Eliminar esta incidencia?" alCerrar={() => setConfirmar(null)}>
          <p className="mt-2 text-sm text-suave">Se borrará el expediente {incidencia.codigo} junto con sus evidencias. Esta acción no se puede deshacer.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="boton boton-secundario" onClick={() => setConfirmar(null)}>
              Cancelar
            </button>
            <button type="button" id="confirmar-eliminar" className="boton boton-peligro" onClick={eliminar}>
              Eliminar definitivamente
            </button>
          </div>
        </Modal>
      )}
      {confirmar === 'cerrar' && (
        <Modal titulo="¿Cerrar esta incidencia?" alCerrar={() => setConfirmar(null)}>
          <p className="mt-2 text-sm text-suave">El estado «Cerrada» es final: no se puede reabrir.</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="boton boton-secundario" onClick={() => setConfirmar(null)}>
              Cancelar
            </button>
            <button type="button" id="confirmar-cerrar" className="boton boton-primario" onClick={() => guardarSeguimiento(null, true)}>
              Sí, cerrar
            </button>
          </div>
        </Modal>
      )}

      {alCerrar && (
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-linea bg-white/95 px-6 py-4 backdrop-blur-md sm:-mx-8 sm:-mb-8 sm:px-8">
          <button
            type="button"
            className="boton boton-secundario text-xs"
            onClick={alCerrar}
          >
            Cerrar
          </button>
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
                className="boton boton-primario bg-emerald-600 hover:bg-emerald-500 text-xs inline-flex items-center gap-1.5"
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
      )}
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
