import { ObjectId } from 'mongodb'
import { ROLES_REGISTRAN, ROLES_SEGUIMIENTO, TRANSICIONES } from '@utm-desk/db/catalogo'
import {
  altaIncidenciaBody,
  codigoIncidenciaParams,
  listadoIncidenciasQuery,
  patchIncidenciaBody,
} from '../schemas/incidencia.js'
import { exigirRoles, exigirSesion } from './auth.js'

const LIMITE_MAX = 100
const LIMITE_DEFAULT = 20

function normalizarTags(request, _reply, done) {
  const tags = request.body?.tags
  if (Array.isArray(tags)) {
    request.body.tags = tags.map((tag) => String(tag).trim().toLowerCase())
  }
  done()
}

function objetoIdDeSesion(request) {
  try {
    return new ObjectId(request.user.sub)
  } catch {
    return null
  }
}

function filtroVisibilidad(request) {
  if (request.user.rol !== 'reportante') return {}
  const usuarioId = objetoIdDeSesion(request)
  if (!usuarioId) return null
  return { 'reportante.usuario_id': usuarioId }
}

function serializarIncidencia(doc, extras = {}) {
  if (!doc) return null
  const {
    _id,
    reportante,
    fecha_creacion,
    fecha_actualizacion,
    fecha_resolucion,
    historial_seguimiento,
    evidencias_adjuntas,
    ...resto
  } = doc

  return {
    ...resto,
    id: _id?.toString?.() ?? undefined,
    reportante: reportante
      ? {
          ...reportante,
          usuario_id: reportante.usuario_id?.toString?.() ?? reportante.usuario_id,
        }
      : reportante,
    fecha_creacion: fecha_creacion?.toISOString?.() ?? fecha_creacion,
    fecha_actualizacion: fecha_actualizacion?.toISOString?.() ?? fecha_actualizacion,
    fecha_resolucion: fecha_resolucion?.toISOString?.() ?? fecha_resolucion ?? null,
    historial_seguimiento: (historial_seguimiento ?? []).map((entrada) => ({
      ...entrada,
      fecha: entrada.fecha?.toISOString?.() ?? entrada.fecha,
    })),
    evidencias_adjuntas: (evidencias_adjuntas ?? []).map((evidencia) => ({
      ...evidencia,
      fecha_carga: evidencia.fecha_carga?.toISOString?.() ?? evidencia.fecha_carga,
    })),
    ...extras,
  }
}

function resumenListado(doc) {
  const completa = serializarIncidencia(doc)
  return {
    codigo: completa.codigo,
    titulo: completa.titulo,
    categoria: completa.categoria,
    prioridad: completa.prioridad,
    estado: completa.estado,
    ubicacion: completa.ubicacion,
    tags: completa.tags,
    reportante: {
      nombre: completa.reportante?.nombre,
      correo: completa.reportante?.correo,
      perfil: completa.reportante?.perfil,
    },
    horas_invertidas: completa.horas_invertidas,
    fecha_creacion: completa.fecha_creacion,
    fecha_actualizacion: completa.fecha_actualizacion,
    ...(doc.score !== undefined ? { relevancia: doc.score } : {}),
  }
}

export async function rutasIncidencias(app) {
  app.post(
    '/incidencias',
    {
      schema: { body: altaIncidenciaBody },
      preValidation: normalizarTags,
      preHandler: exigirRoles(...ROLES_REGISTRAN),
    },
    async (request, reply) => {
      const cuerpo = request.body

      const usuarioId = objetoIdDeSesion(request)
      if (!usuarioId) return reply.code(401).send({ error: 'No autorizado' })

      const usuario = await app.mongo.collection('usuarios').findOne({ _id: usuarioId, activo: true })
      if (!usuario) return reply.code(401).send({ error: 'No autorizado' })
      if (!usuario.perfil) {
        return reply.code(400).send({ error: 'El usuario no tiene perfil institucional' })
      }

      const ahora = new Date()
      const { codigo } = await app.folios.siguiente(cuerpo.categoria)
      const documento = {
        codigo,
        titulo: cuerpo.titulo.trim(),
        descripcion: cuerpo.descripcion.trim(),
        categoria: cuerpo.categoria,
        prioridad: cuerpo.prioridad,
        estado: 'abierta',
        reportante: {
          usuario_id: usuario._id,
          nombre: usuario.nombre,
          perfil: usuario.perfil,
          correo: usuario.correo,
        },
        ubicacion: cuerpo.ubicacion,
        detalle_especifico: cuerpo.detalle_especifico,
        tags: cuerpo.tags ?? [],
        historial_seguimiento: [
          {
            fecha: ahora,
            autor: 'sistema',
            estado_resultante: 'abierta',
            comentario: 'Incidencia registrada.',
            horas_registradas: 0,
          },
        ],
        evidencias_adjuntas: [],
        horas_invertidas: 0,
        fecha_creacion: ahora,
        fecha_actualizacion: ahora,
      }

      try {
        await app.mongo.collection('incidencias_campus').insertOne(documento)
      } catch (error) {
        if (error.code === 121) {
          return reply.code(400).send({ error: 'El documento no cumple el esquema' })
        }
        if (error.code === 11000) {
          return reply.code(409).send({ error: 'El folio ya existe' })
        }
        throw error
      }

      return reply.code(201).send({
        codigo: documento.codigo,
        estado: documento.estado,
        categoria: documento.categoria,
        titulo: documento.titulo,
        fecha_creacion: documento.fecha_creacion.toISOString(),
      })
    },
  )

  app.get(
    '/incidencias',
    {
      schema: { querystring: listadoIncidenciasQuery },
      preHandler: exigirSesion,
    },
    async (request, reply) => {
      const visibilidad = filtroVisibilidad(request)
      if (visibilidad === null) return reply.code(401).send({ error: 'No autorizado' })

      const { categoria, estado, edificio, q } = request.query
      const pagina = Math.max(1, Number(request.query.pagina) || 1)
      const limite = Math.min(LIMITE_MAX, Math.max(1, Number(request.query.limite) || LIMITE_DEFAULT))
      const salto = (pagina - 1) * limite

      const filtro = { ...visibilidad }
      if (categoria) filtro.categoria = categoria
      if (estado) filtro.estado = estado
      if (edificio) filtro['ubicacion.edificio'] = edificio

      const coleccion = app.mongo.collection('incidencias_campus')
      let items
      let total

      if (q) {
        filtro.$text = { $search: q }
        total = await coleccion.countDocuments(filtro)
        items = await coleccion
          .find(filtro, { projection: { score: { $meta: 'textScore' } } })
          .sort({ score: { $meta: 'textScore' } })
          .skip(salto)
          .limit(limite)
          .toArray()
      } else {
        total = await coleccion.countDocuments(filtro)
        items = await coleccion
          .find(filtro)
          .sort({ fecha_creacion: -1 })
          .skip(salto)
          .limit(limite)
          .toArray()
      }

      return reply.code(200).send({
        items: items.map(resumenListado),
        total,
        pagina,
        limite,
      })
    },
  )

  app.get(
    '/incidencias/:codigo',
    {
      schema: { params: codigoIncidenciaParams },
      preHandler: exigirSesion,
    },
    async (request, reply) => {
      const { codigo } = request.params
      const incidencia = await app.mongo.collection('incidencias_campus').findOne({ codigo })
      if (!incidencia) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      if (request.user.rol === 'reportante') {
        const usuarioId = objetoIdDeSesion(request)
        if (!usuarioId) return reply.code(401).send({ error: 'No autorizado' })
        const esPropia = incidencia.reportante?.usuario_id?.equals?.(usuarioId)
          ?? String(incidencia.reportante?.usuario_id) === String(usuarioId)
        if (!esPropia) {
          return reply.code(403).send({ error: 'No tienes permiso para esta operacion' })
        }
      }

      const evidencias = await app.storage.firmarEvidencias(incidencia.evidencias_adjuntas ?? [])
      const expediente = serializarIncidencia({
        ...incidencia,
        evidencias_adjuntas: evidencias,
      })

      return reply.code(200).send(expediente)
    },
  )

  app.patch(
    '/incidencias/:codigo',
    {
      schema: { params: codigoIncidenciaParams, body: patchIncidenciaBody },
      preHandler: exigirRoles(...ROLES_SEGUIMIENTO),
    },
    async (request, reply) => {
      const { codigo } = request.params
      const cuerpo = request.body
      const coleccion = app.mongo.collection('incidencias_campus')

      const incidencia = await coleccion.findOne({ codigo })
      if (!incidencia) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      if (cuerpo.tecnico_asignado !== undefined && request.user.rol !== 'coordinador') {
        return reply.code(403).send({ error: 'No tienes permiso para esta operacion' })
      }

      const estadoActual = incidencia.estado
      const estadoNuevo = cuerpo.estado ?? estadoActual
      const permitidos = TRANSICIONES[estadoActual] ?? []

      if (!permitidos.includes(estadoNuevo)) {
        return reply.code(409).send({ error: 'Transicion de estado no permitida' })
      }

      if (estadoNuevo === 'cerrada' && request.user.rol !== 'coordinador') {
        return reply.code(403).send({ error: 'No tienes permiso para esta operacion' })
      }

      const ahora = new Date()
      const horas = cuerpo.horas_registradas ?? 0
      const $set = {
        estado: estadoNuevo,
        fecha_actualizacion: ahora,
      }

      if (cuerpo.tecnico_asignado !== undefined) {
        $set.tecnico_asignado = cuerpo.tecnico_asignado.trim()
      }

      if (estadoNuevo === 'resuelta' && estadoActual !== 'resuelta') {
        $set.fecha_resolucion = ahora
      }

      const update = {
        $set,
        $push: {
          historial_seguimiento: {
            fecha: ahora,
            autor: request.user.nombre,
            estado_resultante: estadoNuevo,
            comentario: cuerpo.comentario.trim(),
            horas_registradas: horas,
          },
        },
      }

      if (cuerpo.horas_registradas !== undefined) {
        update.$inc = { horas_invertidas: horas }
      }

      const resultado = await coleccion.updateOne({ codigo, estado: estadoActual }, update)
      if (resultado.matchedCount === 0) {
        return reply.code(409).send({ error: 'Transicion de estado no permitida' })
      }

      const actualizada = await coleccion.findOne({ codigo })
      return reply.code(200).send(serializarIncidencia(actualizada))
    },
  )
}
