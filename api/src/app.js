import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import { rutasAnalitica } from './routes/analitica.js'
import { rutasAuth } from './routes/auth.js'
import { rutasIncidencias } from './routes/incidencias.js'
import { crearStorage, ERROR_EVIDENCIA_GRANDE, LIMITE_EVIDENCIA_BYTES } from './services/storage.js'

export async function buildApp(options) {
  const app = Fastify({
    logger: options.logger ?? false,
    ajv: { customOptions: { coerceTypes: false, allErrors: true } },
    rewriteUrl(request) {
      const url = request.url || '/'
      if (url === '/api' || url.startsWith('/api/') || url.startsWith('/api?')) {
        return url.replace(/^\/api/, '') || '/'
      }
      return url
    },
  })

  await app.register(cors, { origin: options.corsOrigin ?? true })
  await app.register(jwt, {
    secret: options.jwtSecret,
    sign: { expiresIn: options.jwtExpiresIn ?? '8h' },
  })

  await app.register(multipart, {
    throwFileSizeLimit: true,
    limits: {
      fileSize: LIMITE_EVIDENCIA_BYTES,
      files: 1,
    },
  })

  app.decorate('mongo', options.mongo)
  app.decorate('folios', options.folios)
  app.decorate('storage', options.storage ?? crearStorage())

  app.setErrorHandler((error, request, reply) => {
    if (error.validation || error.code === 'FST_ERR_VALIDATION') {
      const detalles = Array.isArray(error.validation)
        ? error.validation.map((item) => ({
            campo: item.instancePath || item.schemaPath,
            mensaje: item.message,
          }))
        : undefined
      return reply.code(400).send({ error: 'Datos invalidos', detalles })
    }
    if (error.code === 'FST_REQ_FILE_TOO_LARGE' || error.statusCode === 413) {
      return reply.code(413).send({ error: ERROR_EVIDENCIA_GRANDE })
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message })
    }
    request.log.error(error)
    return reply.code(500).send({ error: 'Error interno' })
  })

  app.get('/salud', async () => ({ servicio: 'utm-desk', estado: 'ok' }))
  await app.register(rutasAuth)
  await app.register(rutasIncidencias)
  await app.register(rutasAnalitica)

  return app
}
