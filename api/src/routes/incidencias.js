import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { ROLES_REGISTRAN, ROLES_SEGUIMIENTO, TIPOS_EVIDENCIA, TRANSICIONES } from '@utm-desk/db/catalogo'
import {
  altaIncidenciaBody,
  codigoIncidenciaParams,
  eliminarEvidenciaBody,
  listadoIncidenciasQuery,
  patchIncidenciaBody,
  tagIncidenciaBody,
  tagIncidenciaParams,
} from '../schemas/incidencia.js'
import { LIMITE_EVIDENCIA_BYTES } from '../services/storage.js'
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

function esPropia(request, incidencia) {
  const usuarioId = objetoIdDeSesion(request)
  if (!usuarioId) return false
  return (
    incidencia.reportante?.usuario_id?.equals?.(usuarioId) ??
    String(incidencia.reportante?.usuario_id) === String(usuarioId)
  )
}

/** null si puede escribir; 401 o 403 si no. El directivo solo consulta. */
function accesoEscritura(request, incidencia) {
  const rol = request.user.rol
  if (rol === 'tecnico' || rol === 'soporte' || rol === 'coordinador') return null
  if (rol === 'reportante') {
    if (!objetoIdDeSesion(request)) return 401
    return esPropia(request, incidencia) ? null : 403
  }
  return 403
}

function responderCodigo(reply, codigo) {
  if (codigo === 401) return reply.code(401).send({ error: 'No autorizado' })
  return reply.code(403).send({ error: 'No tienes permiso para esta operacion' })
}

function normalizarTagBody(request, _reply, done) {
  if (typeof request.body?.tag === 'string') {
    request.body.tag = request.body.tag.trim().toLowerCase()
  }
  done()
}

function normalizarTagParam(request, _reply, done) {
  if (typeof request.params?.tag === 'string') {
    request.params.tag = request.params.tag.trim().toLowerCase()
  }
  done()
}

function nombreSeguro(nombre) {
  const base = String(nombre || 'evidencia').split(/[/\\]/).pop()
  const limpio = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  return limpio || 'evidencia'
}

function responderErrorMongo(error, reply) {
  if (error.code === 121) {
    return reply.code(400).send({ error: 'El documento no cumple el esquema' })
  }
  return null
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

  app.post(
    '/incidencias/:codigo/evidencias',
    {
      schema: { params: codigoIncidenciaParams },
      preHandler: exigirSesion,
    },
    async (request, reply) => {
      const { codigo } = request.params
      const coleccion = app.mongo.collection('incidencias_campus')
      const incidencia = await coleccion.findOne({ codigo })
      if (!incidencia) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      const acceso = accesoEscritura(request, incidencia)
      if (acceso) return responderCodigo(reply, acceso)

      let archivo
      try {
        archivo = await request.file()
      } catch (error) {
        if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.code(413).send({ error: 'El archivo supera 5 MB' })
        }
        throw error
      }
      if (!archivo) return reply.code(400).send({ error: 'Falta el archivo' })

      if (!TIPOS_EVIDENCIA.includes(archivo.mimetype)) {
        archivo.file.resume()
        return reply.code(415).send({ error: 'Tipo de archivo no permitido' })
      }

      let buffer
      try {
        buffer = await archivo.toBuffer()
      } catch (error) {
        if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
          return reply.code(413).send({ error: 'El archivo supera 5 MB' })
        }
        throw error
      }
      if (buffer.length > LIMITE_EVIDENCIA_BYTES) {
        return reply.code(413).send({ error: 'El archivo supera 5 MB' })
      }
      if (buffer.length === 0) {
        return reply.code(400).send({ error: 'El archivo esta vacio' })
      }

      const nombre = nombreSeguro(archivo.filename)
      const ruta = `${codigo}/${Date.now()}-${randomBytes(4).toString('hex')}-${nombre}`
      await app.storage.subirEvidencia({
        ruta,
        buffer,
        contentType: archivo.mimetype,
      })

      const evidencia = {
        nombre_archivo: nombre,
        tipo_mime: archivo.mimetype,
        peso_kb: Math.ceil(buffer.length / 1024),
        url_storage: ruta,
        fecha_carga: new Date(),
      }

      try {
        const resultado = await coleccion.updateOne(
          { codigo },
          {
            $push: { evidencias_adjuntas: evidencia },
            $set: { fecha_actualizacion: new Date() },
          },
        )
        if (resultado.matchedCount === 0) {
          await app.storage.eliminarObjeto(ruta)
          return reply.code(404).send({ error: 'Incidencia no encontrada' })
        }
      } catch (error) {
        await app.storage.eliminarObjeto(ruta).catch(() => {})
        const respuesta = responderErrorMongo(error, reply)
        if (respuesta) return respuesta
        throw error
      }

      return reply.code(201).send({
        nombre_archivo: evidencia.nombre_archivo,
        tipo_mime: evidencia.tipo_mime,
        peso_kb: evidencia.peso_kb,
        url_storage: evidencia.url_storage,
        fecha_carga: evidencia.fecha_carga.toISOString(),
      })
    },
  )

  app.delete(
    '/incidencias/:codigo/evidencias',
    {
      schema: { params: codigoIncidenciaParams, body: eliminarEvidenciaBody },
      preHandler: exigirRoles('coordinador'),
    },
    async (request, reply) => {
      const { codigo } = request.params
      const { url_storage } = request.body
      const coleccion = app.mongo.collection('incidencias_campus')
      const incidencia = await coleccion.findOne({ codigo })
      if (!incidencia) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      const existe = (incidencia.evidencias_adjuntas ?? []).some(
        (item) => item.url_storage === url_storage,
      )
      if (!existe) {
        return reply.code(404).send({ error: 'Evidencia no encontrada' })
      }

      await app.storage.eliminarObjeto(url_storage)
      const resultado = await coleccion.updateOne(
        { codigo },
        {
          $pull: { evidencias_adjuntas: { url_storage } },
          $set: { fecha_actualizacion: new Date() },
        },
      )
      if (resultado.matchedCount === 0) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      return reply.code(200).send({ codigo, url_storage, eliminada: true })
    },
  )

  app.post(
    '/incidencias/:codigo/tags',
    {
      schema: { params: codigoIncidenciaParams, body: tagIncidenciaBody },
      preValidation: normalizarTagBody,
      preHandler: exigirSesion,
    },
    async (request, reply) => {
      const { codigo } = request.params
      const coleccion = app.mongo.collection('incidencias_campus')
      const incidencia = await coleccion.findOne({ codigo })
      if (!incidencia) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      const acceso = accesoEscritura(request, incidencia)
      if (acceso) return responderCodigo(reply, acceso)

      try {
        const resultado = await coleccion.updateOne(
          { codigo },
          {
            $addToSet: { tags: request.body.tag },
            $set: { fecha_actualizacion: new Date() },
          },
        )
        if (resultado.matchedCount === 0) {
          return reply.code(404).send({ error: 'Incidencia no encontrada' })
        }
      } catch (error) {
        const respuesta = responderErrorMongo(error, reply)
        if (respuesta) return respuesta
        throw error
      }

      const actualizada = await coleccion.findOne({ codigo })
      return reply.code(200).send({ codigo, tags: actualizada?.tags ?? [] })
    },
  )

  app.delete(
    '/incidencias/:codigo/tags/:tag',
    {
      schema: { params: tagIncidenciaParams },
      preValidation: normalizarTagParam,
      preHandler: exigirSesion,
    },
    async (request, reply) => {
      const { codigo, tag } = request.params
      const coleccion = app.mongo.collection('incidencias_campus')
      const incidencia = await coleccion.findOne({ codigo })
      if (!incidencia) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      const acceso = accesoEscritura(request, incidencia)
      if (acceso) return responderCodigo(reply, acceso)

      const resultado = await coleccion.updateOne(
        { codigo },
        {
          $pull: { tags: tag },
          $set: { fecha_actualizacion: new Date() },
        },
      )
      if (resultado.matchedCount === 0) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      const actualizada = await coleccion.findOne({ codigo })
      return reply.code(200).send({ codigo, tags: actualizada?.tags ?? [] })
    },
  )

  app.delete(
    '/incidencias/:codigo',
    {
      schema: { params: codigoIncidenciaParams },
      preHandler: exigirRoles('coordinador'),
    },
    async (request, reply) => {
      const { codigo } = request.params
      const coleccion = app.mongo.collection('incidencias_campus')
      const incidencia = await coleccion.findOne({ codigo })
      if (!incidencia) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      const rutas = (incidencia.evidencias_adjuntas ?? []).map((item) => item.url_storage)
      await app.storage.eliminarObjetos(rutas)
      const resultado = await coleccion.deleteOne({ codigo })
      if (resultado.deletedCount === 0) {
        return reply.code(404).send({ error: 'Incidencia no encontrada' })
      }

      return reply.code(200).send({ codigo, eliminada: true })
    },
  )
}
