import { ROLES_ANALITICA } from '@utm-desk/db/catalogo'
import { exigirRoles } from './auth.js'

const MS_HORA = 60 * 60 * 1000
const MS_DIA = 24 * MS_HORA

/**
 * tiempo_transcurrido: calendario entre fecha_creacion y fecha_resolucion.
 * horas_trabajo: suma de horas_invertidas registradas en la bitácora.
 */
const CRITERIO =
  'tiempo_transcurrido es calendario (fecha_resolucion - fecha_creacion). horas_trabajo es la suma de horas_invertidas registradas en la bitacora.'

function redondear(valor) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  return Math.round(numero * 100) / 100
}

const pipelineResolucion = [
  {
    $match: {
      estado: { $in: ['resuelta', 'cerrada'] },
      fecha_resolucion: { $type: 'date' },
    },
  },
  {
    $group: {
      _id: '$ubicacion.edificio',
      casos: { $sum: 1 },
      horas_trabajo: { $sum: '$horas_invertidas' },
      tiempo_calendario_ms: {
        $avg: { $subtract: ['$fecha_resolucion', '$fecha_creacion'] },
      },
    },
  },
  {
    $project: {
      _id: 0,
      edificio: '$_id',
      casos: 1,
      horas_trabajo: 1,
      tiempo_transcurrido_promedio_horas: { $divide: ['$tiempo_calendario_ms', MS_HORA] },
      tiempo_transcurrido_promedio_dias: { $divide: ['$tiempo_calendario_ms', MS_DIA] },
    },
  },
  { $sort: { edificio: 1 } },
]

const pipelineEtiquetas = [
  { $unwind: '$tags' },
  { $group: { _id: '$tags', total: { $sum: 1 } } },
  { $sort: { total: -1, _id: 1 } },
  { $limit: 10 },
  { $project: { _id: 0, tag: '$_id', total: 1 } },
]

export async function rutasAnalitica(app) {
  app.get(
    '/analitica/resolucion-por-edificio',
    { preHandler: exigirRoles(...ROLES_ANALITICA) },
    async (_request, reply) => {
      const filas = await app.mongo.collection('incidencias_campus').aggregate(pipelineResolucion).toArray()
      return reply.code(200).send({
        criterio: CRITERIO,
        items: filas.map((fila) => ({
          edificio: fila.edificio,
          casos: fila.casos,
          horas_trabajo: redondear(fila.horas_trabajo),
          tiempo_transcurrido_promedio_horas: redondear(fila.tiempo_transcurrido_promedio_horas),
          tiempo_transcurrido_promedio_dias: redondear(fila.tiempo_transcurrido_promedio_dias),
        })),
      })
    },
  )

  app.get(
    '/analitica/etiquetas-frecuentes',
    { preHandler: exigirRoles(...ROLES_ANALITICA) },
    async (_request, reply) => {
      const filas = await app.mongo.collection('incidencias_campus').aggregate(pipelineEtiquetas).toArray()
      return reply.code(200).send({
        items: filas.map((fila) => ({ tag: fila.tag, total: fila.total })),
      })
    },
  )
}
