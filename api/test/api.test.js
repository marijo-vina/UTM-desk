import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { buildApp } from '../src/app.js'
import { LIMITE_EVIDENCIA_BYTES } from '../src/services/storage.js'

function coincide(actual, esperado) {
  if (actual && esperado && typeof actual.equals === 'function') return actual.equals(esperado)
  if (esperado && typeof esperado.equals === 'function') return esperado.equals(actual)
  return actual === esperado
}

function valorAnidado(fila, clave) {
  return clave.split('.').reduce((acc, parte) => acc?.[parte], fila)
}

function coincideFiltro(fila, filtro) {
  return Object.entries(filtro).every(([clave, valor]) => {
    if (clave === '$text') {
      const busqueda = String(valor.$search ?? '').toLowerCase()
      const texto = `${fila.titulo ?? ''} ${fila.descripcion ?? ''}`.toLowerCase()
      return texto.includes(busqueda)
    }
    const actual = clave.includes('.') ? valorAnidado(fila, clave) : fila[clave]
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      if (Array.isArray(valor.$in)) return valor.$in.some((item) => coincide(actual, item))
      if (valor.$type === 'date') return actual instanceof Date
    }
    return coincide(actual, valor)
  })
}

function valorExpr(doc, expr) {
  if (typeof expr === 'string' && expr.startsWith('$')) {
    return valorAnidado(doc, expr.slice(1))
  }
  if (expr && typeof expr === 'object') {
    if (expr.$subtract) {
      const [izquierda, derecha] = expr.$subtract
      return new Date(valorExpr(doc, izquierda)) - new Date(valorExpr(doc, derecha))
    }
    if (expr.$divide) {
      const [izquierda, derecha] = expr.$divide
      return valorExpr(doc, izquierda) / valorExpr(doc, derecha)
    }
  }
  return expr
}

function interpretarAgregacion(filas, pipeline) {
  let docs = filas.map((fila) => ({ ...fila }))
  for (const etapa of pipeline) {
    if (etapa.$match) {
      docs = docs.filter((doc) => coincideFiltro(doc, etapa.$match))
    } else if (typeof etapa.$unwind === 'string') {
      const campo = etapa.$unwind.slice(1)
      docs = docs.flatMap((doc) => {
        const lista = valorAnidado(doc, campo)
        const arreglo = Array.isArray(lista) ? lista : []
        return arreglo.map((item) => ({ ...doc, [campo]: item }))
      })
    } else if (etapa.$group) {
      const grupos = new Map()
      for (const doc of docs) {
        const id = valorExpr(doc, etapa.$group._id)
        const clave = String(id)
        if (!grupos.has(clave)) grupos.set(clave, { _id: id, _docs: [] })
        grupos.get(clave)._docs.push(doc)
      }
      docs = [...grupos.values()].map((grupo) => {
        const salida = { _id: grupo._id }
        for (const [campo, expr] of Object.entries(etapa.$group)) {
          if (campo === '_id') continue
          if (expr.$sum === 1) salida[campo] = grupo._docs.length
          else if (expr.$sum !== undefined) {
            salida[campo] = grupo._docs.reduce((suma, doc) => suma + (valorExpr(doc, expr.$sum) ?? 0), 0)
          } else if (expr.$avg) {
            const valores = grupo._docs.map((doc) => valorExpr(doc, expr.$avg))
            salida[campo] = valores.reduce((suma, valor) => suma + valor, 0) / valores.length
          }
        }
        return salida
      })
    } else if (etapa.$project) {
      docs = docs.map((doc) => {
        const salida = {}
        const conservaId = !Object.prototype.hasOwnProperty.call(etapa.$project, '_id')
        if (conservaId) salida._id = doc._id
        for (const [campo, expr] of Object.entries(etapa.$project)) {
          if (expr === 0) continue
          salida[campo] = expr === 1 ? doc[campo] : valorExpr(doc, expr)
        }
        return salida
      })
    } else if (etapa.$sort) {
      const claves = Object.entries(etapa.$sort)
      docs.sort((a, b) => {
        for (const [clave, direccion] of claves) {
          if (a[clave] < b[clave]) return -1 * direccion
          if (a[clave] > b[clave]) return 1 * direccion
        }
        return 0
      })
    } else if (etapa.$limit !== undefined) {
      docs = docs.slice(0, etapa.$limit)
    } else {
      throw new Error(`Etapa no soportada en el doble de prueba: ${Object.keys(etapa).join(',')}`)
    }
  }
  return docs
}

function cuerpoMultipart({ nombre, mime, contenido }) {
  const boundary = '----UtmDeskBoundary'
  const archivo = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido)
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="archivo"; filename="${nombre}"\r\nContent-Type: ${mime}\r\n\r\n`,
      'utf8',
    ),
    archivo,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ])
  return {
    payload,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

function crearCursor(filas, opciones = {}) {
  let resultado = [...filas]
  const proyeccion = opciones.projection

  return {
    sort(orden) {
      if (orden.score?.$meta === 'textScore') {
        resultado.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      } else if (orden.fecha_creacion === -1) {
        resultado.sort((a, b) => b.fecha_creacion - a.fecha_creacion)
      }
      return this
    },
    skip(n) {
      resultado = resultado.slice(n)
      return this
    },
    limit(n) {
      resultado = resultado.slice(0, n)
      return this
    },
    async toArray() {
      return resultado.map((fila) => {
        const copia = { ...fila }
        if (proyeccion?.score?.$meta === 'textScore') {
          copia.score = fila.score ?? 1
        }
        return copia
      })
    },
  }
}

function crearMongo() {
  const usuarios = []
  const incidencias = []
  const db = {
    collection(nombre) {
      const filas = nombre === 'usuarios' ? usuarios : incidencias
      return {
        async findOne(filtro) {
          return filas.find((fila) => coincideFiltro(fila, filtro)) ?? null
        },
        async countDocuments(filtro = {}) {
          return filas.filter((fila) => coincideFiltro(fila, filtro)).length
        },
        find(filtro = {}, opciones = {}) {
          const encontradas = filas
            .filter((fila) => coincideFiltro(fila, filtro))
            .map((fila) => {
              if (!filtro.$text) return { ...fila }
              const q = String(filtro.$text.$search).toLowerCase()
              const enTitulo = String(fila.titulo ?? '')
                .toLowerCase()
                .includes(q)
              return { ...fila, score: enTitulo ? 10 : 5 }
            })
          return crearCursor(encontradas, opciones)
        },
        async insertOne(doc) {
          if (filas.some((fila) => fila.codigo === doc.codigo)) {
            const error = new Error('duplicate')
            error.code = 11000
            throw error
          }
          if (doc.codigo === 'RECHAZO-121') {
            const error = new Error('Document failed validation')
            error.code = 121
            throw error
          }
          filas.push(doc)
          return { insertedId: new ObjectId() }
        },
        async updateOne(filtro, update) {
          const indice = filas.findIndex((fila) => coincideFiltro(fila, filtro))
          if (indice === -1) return { matchedCount: 0, modifiedCount: 0 }
          const doc = filas[indice]
          if (update.$set) Object.assign(doc, update.$set)
          if (update.$inc) {
            for (const [clave, valor] of Object.entries(update.$inc)) {
              doc[clave] = (doc[clave] ?? 0) + valor
            }
          }
          if (update.$push) {
            for (const [clave, valor] of Object.entries(update.$push)) {
              if (!Array.isArray(doc[clave])) doc[clave] = []
              doc[clave].push(valor)
            }
          }
          if (update.$addToSet) {
            for (const [clave, valor] of Object.entries(update.$addToSet)) {
              if (!Array.isArray(doc[clave])) doc[clave] = []
              if (!doc[clave].includes(valor)) doc[clave].push(valor)
            }
          }
          if (update.$pull) {
            for (const [clave, valor] of Object.entries(update.$pull)) {
              if (!Array.isArray(doc[clave])) continue
              doc[clave] = doc[clave].filter((item) => {
                if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
                  return !Object.entries(valor).every(([k, v]) => coincide(item[k], v))
                }
                return item !== valor
              })
            }
          }
          return { matchedCount: 1, modifiedCount: 1 }
        },
        async deleteOne(filtro) {
          const indice = filas.findIndex((fila) => coincideFiltro(fila, filtro))
          if (indice === -1) return { deletedCount: 0 }
          filas.splice(indice, 1)
          return { deletedCount: 1 }
        },
        aggregate(pipeline) {
          const resultado = interpretarAgregacion(filas, pipeline)
          return { async toArray() { return resultado } }
        },
      }
    },
  }
  return { db, usuarios, incidencias }
}

async function crearApp(mongo, folios, storage) {
  return buildApp({
    mongo,
    folios,
    storage,
    jwtSecret: 'secreto-de-prueba',
    logger: false,
  })
}

const altaComputo = {
  titulo: 'Punto de acceso sin servicio',
  descripcion: 'El identificador UTM-Lab-B no responde durante la practica.',
  categoria: 'computo_redes',
  prioridad: 'alta',
  ubicacion: { edificio: 'Edificio B', aula_o_zona: 'Laboratorio B-204' },
  detalle_especifico: {
    direccion_ip: '10.20.15.44',
    vlan: 120,
    puerto_uplink: 'Gi0/24',
    equipos_afectados: 18,
  },
  tags: [' WiFi ', 'laboratorio'],
}

test('login, alta y rechazos del primer corte', async (t) => {
  const { db, usuarios, incidencias } = crearMongo()
  const hash = await bcrypt.hash('utmdesk123', 4)
  const reportanteId = new ObjectId()
  const directivoId = new ObjectId()
  usuarios.push(
    {
      _id: reportanteId,
      correo: 'ana.lopez@utm.mx',
      hash_contrasena: hash,
      nombre: 'Ana López Ruiz',
      rol: 'reportante',
      perfil: 'docente',
      activo: true,
    },
    {
      _id: directivoId,
      correo: 'directivo@utm.mx',
      hash_contrasena: hash,
      nombre: 'Dirección UTM',
      rol: 'directivo',
      perfil: 'administrativo',
      activo: true,
    },
  )

  let consecutivo = 0
  const folios = {
    async siguiente(categoria) {
      consecutivo += 1
      const cat = categoria === 'computo_redes' ? 'CR' : 'IN'
      return { codigo: `INC-20261022-${cat}-${String(consecutivo).padStart(4, '0')}` }
    },
  }
  const app = await crearApp(db, folios)
  t.after(() => app.close())

  const sinClave = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { correo: 'ana.lopez@utm.mx', contrasena: 'otra' },
  })
  assert.equal(sinClave.statusCode, 401)
  assert.equal(sinClave.json().error, 'No autorizado')

  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { correo: 'ana.lopez@utm.mx', contrasena: 'utmdesk123' },
  })
  assert.equal(login.statusCode, 200)
  const { token, usuario } = login.json()
  assert.equal(usuario.rol, 'reportante')
  assert.equal(usuario.nombre, 'Ana López Ruiz')

  const sinToken = await app.inject({ method: 'POST', url: '/incidencias', payload: altaComputo })
  assert.equal(sinToken.statusCode, 401)

  const loginDirectivo = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { correo: 'directivo@utm.mx', contrasena: 'utmdesk123' },
  })
  const comoDirectivo = await app.inject({
    method: 'POST',
    url: '/incidencias',
    headers: { authorization: `Bearer ${loginDirectivo.json().token}` },
    payload: altaComputo,
  })
  assert.equal(comoDirectivo.statusCode, 403)

  const alta = await app.inject({
    method: 'POST',
    url: '/incidencias',
    headers: { authorization: `Bearer ${token}` },
    payload: altaComputo,
  })
  assert.equal(alta.statusCode, 201)
  assert.equal(alta.json().codigo, 'INC-20261022-CR-0001')
  assert.equal(alta.json().estado, 'abierta')

  const guardada = incidencias[0]
  assert.equal(guardada.reportante.correo, 'ana.lopez@utm.mx')
  assert.equal(guardada.reportante.perfil, 'docente')
  assert.equal(String(guardada.reportante.usuario_id), String(reportanteId))
  assert.deepEqual(guardada.tags, ['wifi', 'laboratorio'])
  assert.equal(guardada.historial_seguimiento[0].autor, 'sistema')
  assert.equal(guardada.historial_seguimiento[0].estado_resultante, 'abierta')
  assert.equal(guardada.estado, 'abierta')
  assert.equal(guardada.fecha_resolucion, undefined)

  const cruce = await app.inject({
    method: 'POST',
    url: '/incidencias',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      ...altaComputo,
      categoria: 'infraestructura',
      detalle_especifico: altaComputo.detalle_especifico,
    },
  })
  assert.equal(cruce.statusCode, 400)
  assert.equal(cruce.json().error, 'Datos invalidos')

  const infra = await app.inject({
    method: 'POST',
    url: '/incidencias',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      titulo: 'Filtracion en el aula',
      descripcion: 'Goteo sobre contactos electricos del aula.',
      categoria: 'infraestructura',
      prioridad: 'critica',
      ubicacion: { edificio: 'Edificio C', aula_o_zona: 'Aula C-101' },
      detalle_especifico: {
        tipo_dano: 'filtracion',
        riesgo_seguridad: true,
        requiere_insumos: true,
        contratista_externo: false,
      },
    },
  })
  assert.equal(infra.statusCode, 400)
})

test('M2: listado, filtros, busqueda textual y detalle', async (t) => {
  const { db, usuarios, incidencias } = crearMongo()
  const hash = await bcrypt.hash('utmdesk123', 4)
  const anaId = new ObjectId()
  const otroId = new ObjectId()
  const soporteId = new ObjectId()

  usuarios.push(
    {
      _id: anaId,
      correo: 'ana.lopez@utm.mx',
      hash_contrasena: hash,
      nombre: 'Ana López Ruiz',
      rol: 'reportante',
      perfil: 'docente',
      activo: true,
    },
    {
      _id: otroId,
      correo: 'otro@utm.mx',
      hash_contrasena: hash,
      nombre: 'Otro Reportante',
      rol: 'reportante',
      perfil: 'estudiante',
      activo: true,
    },
    {
      _id: soporteId,
      correo: 'soporte@utm.mx',
      hash_contrasena: hash,
      nombre: 'Mesa UTM Desk',
      rol: 'soporte',
      perfil: 'administrativo',
      activo: true,
    },
  )

  const ahora = new Date('2026-10-22T18:00:00.000Z')
  const antes = new Date('2026-10-21T18:00:00.000Z')

  incidencias.push(
    {
      _id: new ObjectId(),
      codigo: 'INC-20261022-CR-0001',
      titulo: 'Punto de acceso sin servicio',
      descripcion: 'Wifi caido en laboratorio',
      categoria: 'computo_redes',
      prioridad: 'alta',
      estado: 'abierta',
      reportante: {
        usuario_id: anaId,
        nombre: 'Ana López Ruiz',
        perfil: 'docente',
        correo: 'ana.lopez@utm.mx',
      },
      ubicacion: { edificio: 'Edificio B', aula_o_zona: 'Lab B-204' },
      detalle_especifico: {
        direccion_ip: '10.20.15.44',
        vlan: 120,
        puerto_uplink: 'Gi0/24',
        equipos_afectados: 18,
      },
      tags: ['wifi'],
      historial_seguimiento: [
        {
          fecha: ahora,
          autor: 'sistema',
          estado_resultante: 'abierta',
          comentario: 'Incidencia registrada.',
          horas_registradas: 0,
        },
      ],
      evidencias_adjuntas: [
        {
          nombre_archivo: 'ap-b204.jpg',
          tipo_mime: 'image/jpeg',
          peso_kb: 842,
          url_storage: 'evidencias/2026/10/22/INC-20261022-CR-0001/ap-b204.jpg',
          fecha_carga: ahora,
        },
      ],
      horas_invertidas: 0,
      fecha_creacion: ahora,
      fecha_actualizacion: ahora,
    },
    {
      _id: new ObjectId(),
      codigo: 'INC-20261021-IN-0002',
      titulo: 'Filtracion en aula',
      descripcion: 'Goteo sobre contactos',
      categoria: 'infraestructura',
      prioridad: 'critica',
      estado: 'en_proceso',
      reportante: {
        usuario_id: otroId,
        nombre: 'Otro Reportante',
        perfil: 'estudiante',
        correo: 'otro@utm.mx',
      },
      ubicacion: { edificio: 'Edificio C', aula_o_zona: 'Aula C-101' },
      detalle_especifico: {
        tipo_dano: 'filtracion',
        riesgo_seguridad: true,
        requiere_insumos: false,
        contratista_externo: false,
      },
      tags: ['filtracion'],
      historial_seguimiento: [
        {
          fecha: antes,
          autor: 'sistema',
          estado_resultante: 'abierta',
          comentario: 'Incidencia registrada.',
          horas_registradas: 0,
        },
      ],
      evidencias_adjuntas: [],
      horas_invertidas: 1,
      fecha_creacion: antes,
      fecha_actualizacion: antes,
    },
  )

  const storage = {
    async firmarEvidencias(evidencias = []) {
      return evidencias.map((evidencia) => ({
        ...evidencia,
        url_firmada: `https://signed.example/${evidencia.url_storage}?exp=1h`,
      }))
    },
  }

  const app = await crearApp(db, { async siguiente() {} }, storage)
  t.after(() => app.close())

  const loginAna = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { correo: 'ana.lopez@utm.mx', contrasena: 'utmdesk123' },
  })
  const tokenAna = loginAna.json().token

  const loginSoporte = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { correo: 'soporte@utm.mx', contrasena: 'utmdesk123' },
  })
  const tokenSoporte = loginSoporte.json().token

  const sinToken = await app.inject({ method: 'GET', url: '/incidencias' })
  assert.equal(sinToken.statusCode, 401)

  const soloAna = await app.inject({
    method: 'GET',
    url: '/incidencias',
    headers: { authorization: `Bearer ${tokenAna}` },
  })
  assert.equal(soloAna.statusCode, 200)
  assert.equal(soloAna.json().total, 1)
  assert.equal(soloAna.json().items.length, 1)
  assert.equal(soloAna.json().items[0].codigo, 'INC-20261022-CR-0001')

  const todas = await app.inject({
    method: 'GET',
    url: '/incidencias?pagina=1&limite=10',
    headers: { authorization: `Bearer ${tokenSoporte}` },
  })
  assert.equal(todas.statusCode, 200)
  assert.equal(todas.json().total, 2)
  assert.equal(todas.json().items[0].codigo, 'INC-20261022-CR-0001')
  assert.equal(todas.json().items[1].codigo, 'INC-20261021-IN-0002')

  const filtradas = await app.inject({
    method: 'GET',
    url: '/incidencias?categoria=infraestructura&estado=en_proceso&edificio=Edificio%20C',
    headers: { authorization: `Bearer ${tokenSoporte}` },
  })
  assert.equal(filtradas.statusCode, 200)
  assert.equal(filtradas.json().total, 1)
  assert.equal(filtradas.json().items[0].codigo, 'INC-20261021-IN-0002')

  const busqueda = await app.inject({
    method: 'GET',
    url: '/incidencias?q=acceso',
    headers: { authorization: `Bearer ${tokenSoporte}` },
  })
  assert.equal(busqueda.statusCode, 200)
  assert.equal(busqueda.json().total, 1)
  assert.equal(busqueda.json().items[0].codigo, 'INC-20261022-CR-0001')
  assert.ok(busqueda.json().items[0].relevancia > 0)

  const vacia = await app.inject({
    method: 'GET',
    url: '/incidencias?q=xyzsinmatch',
    headers: { authorization: `Bearer ${tokenSoporte}` },
  })
  assert.equal(vacia.statusCode, 200)
  assert.deepEqual(vacia.json().items, [])
  assert.equal(vacia.json().total, 0)

  const detalle = await app.inject({
    method: 'GET',
    url: '/incidencias/INC-20261022-CR-0001',
    headers: { authorization: `Bearer ${tokenAna}` },
  })
  assert.equal(detalle.statusCode, 200)
  assert.equal(detalle.json().codigo, 'INC-20261022-CR-0001')
  assert.equal(detalle.json().evidencias_adjuntas.length, 1)
  assert.match(
    detalle.json().evidencias_adjuntas[0].url_firmada,
    /^https:\/\/signed\.example\//,
  )

  const ajena = await app.inject({
    method: 'GET',
    url: '/incidencias/INC-20261021-IN-0002',
    headers: { authorization: `Bearer ${tokenAna}` },
  })
  assert.equal(ajena.statusCode, 403)

  const inexistente = await app.inject({
    method: 'GET',
    url: '/incidencias/INC-20990101-CR-9999',
    headers: { authorization: `Bearer ${tokenSoporte}` },
  })
  assert.equal(inexistente.statusCode, 404)
})

test('M3: ciclo de vida atomico, matriz Tabla 6 y bitacora', async (t) => {
  const { db, usuarios, incidencias } = crearMongo()
  const hash = await bcrypt.hash('utmdesk123', 4)
  const tecnicoId = new ObjectId()
  const coordinadorId = new ObjectId()
  const reportanteId = new ObjectId()

  usuarios.push(
    {
      _id: tecnicoId,
      correo: 'tec.jmartinez@utm.mx',
      hash_contrasena: hash,
      nombre: 'J. Martínez',
      rol: 'tecnico',
      perfil: 'administrativo',
      activo: true,
    },
    {
      _id: coordinadorId,
      correo: 'coordinador@utm.mx',
      hash_contrasena: hash,
      nombre: 'Coordinación de soporte',
      rol: 'coordinador',
      perfil: 'administrativo',
      activo: true,
    },
    {
      _id: reportanteId,
      correo: 'ana.lopez@utm.mx',
      hash_contrasena: hash,
      nombre: 'Ana López Ruiz',
      rol: 'reportante',
      perfil: 'docente',
      activo: true,
    },
  )

  const creacion = new Date('2026-10-20T15:00:00.000Z')
  incidencias.push(
    {
      _id: new ObjectId(),
      codigo: 'INC-20261020-CR-0001',
      titulo: 'Switch inestable',
      descripcion: 'Reinicios periodicos',
      categoria: 'computo_redes',
      prioridad: 'alta',
      estado: 'abierta',
      reportante: {
        usuario_id: reportanteId,
        nombre: 'Ana López Ruiz',
        perfil: 'docente',
        correo: 'ana.lopez@utm.mx',
      },
      ubicacion: { edificio: 'Edificio A', aula_o_zona: 'Lab A-101' },
      detalle_especifico: {
        direccion_ip: '10.20.11.2',
        vlan: 110,
        puerto_uplink: 'Gi0/1',
        equipos_afectados: 24,
      },
      tags: ['switch'],
      historial_seguimiento: [
        {
          fecha: creacion,
          autor: 'sistema',
          estado_resultante: 'abierta',
          comentario: 'Incidencia registrada.',
          horas_registradas: 0,
        },
      ],
      evidencias_adjuntas: [],
      horas_invertidas: 0,
      fecha_creacion: creacion,
      fecha_actualizacion: creacion,
    },
    {
      _id: new ObjectId(),
      codigo: 'INC-20261018-IN-0002',
      titulo: 'Ticket resuelto pendiente de cierre',
      descripcion: 'Ya se reparo',
      categoria: 'infraestructura',
      prioridad: 'media',
      estado: 'resuelta',
      reportante: {
        usuario_id: reportanteId,
        nombre: 'Ana López Ruiz',
        perfil: 'docente',
        correo: 'ana.lopez@utm.mx',
      },
      ubicacion: { edificio: 'Edificio B', aula_o_zona: 'Pasillo' },
      detalle_especifico: {
        tipo_dano: 'luminaria',
        riesgo_seguridad: false,
        requiere_insumos: false,
        contratista_externo: false,
      },
      tags: ['luminaria'],
      historial_seguimiento: [
        {
          fecha: creacion,
          autor: 'sistema',
          estado_resultante: 'abierta',
          comentario: 'Incidencia registrada.',
          horas_registradas: 0,
        },
      ],
      evidencias_adjuntas: [],
      horas_invertidas: 2,
      fecha_creacion: creacion,
      fecha_actualizacion: creacion,
      fecha_resolucion: creacion,
    },
  )

  const app = await crearApp(db, { async siguiente() {} })
  t.after(() => app.close())

  const loginTecnico = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { correo: 'tec.jmartinez@utm.mx', contrasena: 'utmdesk123' },
  })
  const tokenTecnico = loginTecnico.json().token

  const loginCoord = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { correo: 'coordinador@utm.mx', contrasena: 'utmdesk123' },
  })
  const tokenCoord = loginCoord.json().token

  const loginAna = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { correo: 'ana.lopez@utm.mx', contrasena: 'utmdesk123' },
  })
  const tokenAna = loginAna.json().token

  const comoReportante = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenAna}` },
    payload: { estado: 'en_proceso', comentario: 'Intento de avance' },
  })
  assert.equal(comoReportante.statusCode, 403)

  const avance = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenTecnico}` },
    payload: {
      estado: 'en_proceso',
      comentario: 'Se inicia la atencion.',
      horas_registradas: 1.5,
    },
  })
  assert.equal(avance.statusCode, 200)
  assert.equal(avance.json().estado, 'en_proceso')
  assert.equal(avance.json().horas_invertidas, 1.5)
  assert.equal(avance.json().historial_seguimiento.length, 2)
  assert.equal(avance.json().historial_seguimiento[1].autor, 'J. Martínez')
  assert.equal(avance.json().fecha_resolucion, null)

  const regresoAbierta = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenTecnico}` },
    payload: { estado: 'abierta', comentario: 'No permitido' },
  })
  assert.equal(regresoAbierta.statusCode, 409)

  const asignaTecnico = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenTecnico}` },
    payload: {
      comentario: 'Intento de asignar',
      tecnico_asignado: 'tec.jmartinez@utm.mx',
    },
  })
  assert.equal(asignaTecnico.statusCode, 403)

  const coordAsigna = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenCoord}` },
    payload: {
      comentario: 'Se asigna tecnico.',
      tecnico_asignado: 'tec.jmartinez@utm.mx',
    },
  })
  assert.equal(coordAsigna.statusCode, 200)
  assert.equal(coordAsigna.json().tecnico_asignado, 'tec.jmartinez@utm.mx')
  assert.equal(coordAsigna.json().estado, 'en_proceso')

  const aResuelta = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenTecnico}` },
    payload: {
      estado: 'resuelta',
      comentario: 'Falla corregida.',
      horas_registradas: 2,
    },
  })
  assert.equal(aResuelta.statusCode, 200)
  assert.equal(aResuelta.json().estado, 'resuelta')
  assert.ok(aResuelta.json().fecha_resolucion)
  assert.equal(aResuelta.json().horas_invertidas, 3.5)

  const cierreTecnico = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenTecnico}` },
    payload: { estado: 'cerrada', comentario: 'Cierre no autorizado' },
  })
  assert.equal(cierreTecnico.statusCode, 403)

  const cierreCoord = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenCoord}` },
    payload: { estado: 'cerrada', comentario: 'Coordinacion cierra la incidencia.' },
  })
  assert.equal(cierreCoord.statusCode, 200)
  assert.equal(cierreCoord.json().estado, 'cerrada')
  assert.equal(cierreCoord.json().historial_seguimiento.length, 5)

  const sobreCerrada = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261020-CR-0001',
    headers: { authorization: `Bearer ${tokenCoord}` },
    payload: { comentario: 'Ya no se puede' },
  })
  assert.equal(sobreCerrada.statusCode, 409)

  const noExiste = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20990101-CR-9999',
    headers: { authorization: `Bearer ${tokenTecnico}` },
    payload: { estado: 'en_proceso', comentario: 'Nada' },
  })
  assert.equal(noExiste.statusCode, 404)

  const soloHorasResuelta = await app.inject({
    method: 'PATCH',
    url: '/incidencias/INC-20261018-IN-0002',
    headers: { authorization: `Bearer ${tokenTecnico}` },
    payload: { comentario: 'Horas extra no permitidas en resuelta' },
  })
  assert.equal(soloHorasResuelta.statusCode, 409)
})

test('M4: evidencias y etiquetas', async (t) => {
  const { db, usuarios, incidencias } = crearMongo()
  const hash = await bcrypt.hash('utmdesk123', 4)
  const ana = {
    _id: new ObjectId(),
    correo: 'ana.lopez@utm.mx',
    hash_contrasena: hash,
    nombre: 'Ana López Ruiz',
    rol: 'reportante',
    perfil: 'docente',
    activo: true,
  }
  const otro = {
    _id: new ObjectId(),
    correo: 'otro@utm.mx',
    hash_contrasena: hash,
    nombre: 'Otro Reportante',
    rol: 'reportante',
    perfil: 'estudiante',
    activo: true,
  }
  const soporte = {
    _id: new ObjectId(),
    correo: 'soporte@utm.mx',
    hash_contrasena: hash,
    nombre: 'Mesa UTM Desk',
    rol: 'soporte',
    perfil: 'administrativo',
    activo: true,
  }
  const tecnico = {
    _id: new ObjectId(),
    correo: 'tec.jmartinez@utm.mx',
    hash_contrasena: hash,
    nombre: 'J. Martínez',
    rol: 'tecnico',
    perfil: 'administrativo',
    activo: true,
  }
  const coordinador = {
    _id: new ObjectId(),
    correo: 'coordinador@utm.mx',
    hash_contrasena: hash,
    nombre: 'Coordinación de soporte',
    rol: 'coordinador',
    perfil: 'administrativo',
    activo: true,
  }
  const directivo = {
    _id: new ObjectId(),
    correo: 'directivo@utm.mx',
    hash_contrasena: hash,
    nombre: 'Dirección UTM',
    rol: 'directivo',
    perfil: 'administrativo',
    activo: true,
  }
  usuarios.push(ana, otro, soporte, tecnico, coordinador, directivo)

  const creacion = new Date('2026-10-22T12:00:00.000Z')
  function ticket(codigo, dueno, extra = {}) {
    return {
      _id: new ObjectId(),
      codigo,
      titulo: 'Ticket de prueba',
      descripcion: 'Descripcion de prueba larga',
      categoria: 'computo_redes',
      prioridad: 'media',
      estado: 'abierta',
      reportante: {
        usuario_id: dueno._id,
        nombre: dueno.nombre,
        perfil: dueno.perfil,
        correo: dueno.correo,
      },
      ubicacion: { edificio: 'Edificio A', aula_o_zona: 'Aula 1' },
      detalle_especifico: {
        direccion_ip: '10.0.0.1',
        vlan: 10,
        puerto_uplink: 'Gi0/1',
        equipos_afectados: 1,
      },
      tags: ['wifi'],
      historial_seguimiento: [
        {
          fecha: creacion,
          autor: 'sistema',
          estado_resultante: 'abierta',
          comentario: 'Incidencia registrada.',
          horas_registradas: 0,
        },
      ],
      evidencias_adjuntas: [],
      horas_invertidas: 0,
      fecha_creacion: creacion,
      fecha_actualizacion: creacion,
      ...extra,
    }
  }

  const propia = ticket('INC-20261022-CR-0001', ana, {
    evidencias_adjuntas: [
      {
        nombre_archivo: 'previa.jpg',
        tipo_mime: 'image/jpeg',
        peso_kb: 10,
        url_storage: 'INC-20261022-CR-0001/previa.jpg',
        fecha_carga: creacion,
      },
    ],
  })
  const ajena = ticket('INC-20261021-IN-0002', otro)
  incidencias.push(propia, ajena)

  const subidas = []
  const borrados = []
  const storage = {
    async firmarEvidencias(evidencias = []) {
      return evidencias
    },
    async subirEvidencia({ ruta, buffer, contentType }) {
      subidas.push({ ruta, bytes: buffer.length, contentType })
      return ruta
    },
    async eliminarObjeto(ruta) {
      borrados.push(ruta)
    },
    async eliminarObjetos(rutas = []) {
      borrados.push(...rutas.filter(Boolean))
    },
  }

  const app = await crearApp(db, { async siguiente() {} }, storage)
  t.after(() => app.close())

  async function tokenDe(correo) {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { correo, contrasena: 'utmdesk123' },
    })
    assert.equal(respuesta.statusCode, 200)
    return respuesta.json().token
  }

  const tokenAna = await tokenDe('ana.lopez@utm.mx')
  const tokenSoporte = await tokenDe('soporte@utm.mx')
  const tokenTecnico = await tokenDe('tec.jmartinez@utm.mx')
  const tokenCoord = await tokenDe('coordinador@utm.mx')
  const tokenDirectivo = await tokenDe('directivo@utm.mx')

  const sinToken = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/evidencias',
    ...cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'jpeg-bytes' }),
  })
  assert.equal(sinToken.statusCode, 401)

  const alta = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/evidencias',
    headers: {
      authorization: `Bearer ${tokenAna}`,
      ...cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'jpeg-bytes' }).headers,
    },
    payload: cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'jpeg-bytes' }).payload,
  })
  assert.equal(alta.statusCode, 201)
  assert.equal(alta.json().nombre_archivo, 'foto.jpg')
  assert.equal(alta.json().tipo_mime, 'image/jpeg')
  assert.equal(alta.json().peso_kb, 1)
  assert.match(alta.json().url_storage, /^INC-20261022-CR-0001\/\d+-[a-f0-9]+-foto\.jpg$/)
  assert.equal(subidas.length, 1)
  assert.equal(propia.evidencias_adjuntas.length, 2)
  assert.equal(propia.evidencias_adjuntas[1].url_storage, alta.json().url_storage)
  assert.equal(propia.historial_seguimiento.length, 1)
  assert.equal('buffer' in propia.evidencias_adjuntas[1], false)

  const ajenaAna = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261021-IN-0002/evidencias',
    headers: {
      authorization: `Bearer ${tokenAna}`,
      'content-type': cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'x' }).headers['content-type'],
    },
    payload: cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'x' }).payload,
  })
  assert.equal(ajenaAna.statusCode, 403)

  const comoDirectivo = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/evidencias',
    headers: {
      authorization: `Bearer ${tokenDirectivo}`,
      'content-type': cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'x' }).headers['content-type'],
    },
    payload: cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'x' }).payload,
  })
  assert.equal(comoDirectivo.statusCode, 403)
  assert.equal(subidas.length, 1)

  const tipoInvalido = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/evidencias',
    headers: {
      authorization: `Bearer ${tokenSoporte}`,
      'content-type': cuerpoMultipart({ nombre: 'nota.txt', mime: 'text/plain', contenido: 'hola' }).headers['content-type'],
    },
    payload: cuerpoMultipart({ nombre: 'nota.txt', mime: 'text/plain', contenido: 'hola' }).payload,
  })
  assert.equal(tipoInvalido.statusCode, 415)
  assert.equal(subidas.length, 1)

  const grande = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/evidencias',
    headers: {
      authorization: `Bearer ${tokenSoporte}`,
      'content-type': cuerpoMultipart({
        nombre: 'grande.jpg',
        mime: 'image/jpeg',
        contenido: Buffer.alloc(LIMITE_EVIDENCIA_BYTES + 1),
      }).headers['content-type'],
    },
    payload: cuerpoMultipart({
      nombre: 'grande.jpg',
      mime: 'image/jpeg',
      contenido: Buffer.alloc(LIMITE_EVIDENCIA_BYTES + 1),
    }).payload,
  })
  assert.equal(grande.statusCode, 413)
  assert.equal(subidas.length, 1)

  const inexistente = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20990101-CR-9999/evidencias',
    headers: {
      authorization: `Bearer ${tokenSoporte}`,
      'content-type': cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'jpeg' }).headers['content-type'],
    },
    payload: cuerpoMultipart({ nombre: 'foto.jpg', mime: 'image/jpeg', contenido: 'jpeg' }).payload,
  })
  assert.equal(inexistente.statusCode, 404)

  const borraTecnico = await app.inject({
    method: 'DELETE',
    url: '/incidencias/INC-20261022-CR-0001/evidencias',
    headers: { authorization: `Bearer ${tokenTecnico}` },
    payload: { url_storage: 'INC-20261022-CR-0001/previa.jpg' },
  })
  assert.equal(borraTecnico.statusCode, 403)

  const borraMal = await app.inject({
    method: 'DELETE',
    url: '/incidencias/INC-20261022-CR-0001/evidencias',
    headers: { authorization: `Bearer ${tokenCoord}` },
    payload: { url_storage: 'INC-20261022-CR-0001/no-existe.jpg' },
  })
  assert.equal(borraMal.statusCode, 404)
  assert.equal(borrados.length, 0)

  const borra = await app.inject({
    method: 'DELETE',
    url: '/incidencias/INC-20261022-CR-0001/evidencias',
    headers: { authorization: `Bearer ${tokenCoord}` },
    payload: { url_storage: 'INC-20261022-CR-0001/previa.jpg' },
  })
  assert.equal(borra.statusCode, 200)
  assert.deepEqual(borrados, ['INC-20261022-CR-0001/previa.jpg'])
  assert.equal(
    propia.evidencias_adjuntas.some((item) => item.url_storage === 'INC-20261022-CR-0001/previa.jpg'),
    false,
  )

  const tag = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/tags',
    headers: { authorization: `Bearer ${tokenAna}` },
    payload: { tag: ' Laboratorio ' },
  })
  assert.equal(tag.statusCode, 200)
  assert.deepEqual(tag.json().tags, ['wifi', 'laboratorio'])

  const repetida = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/tags',
    headers: { authorization: `Bearer ${tokenAna}` },
    payload: { tag: 'laboratorio' },
  })
  assert.equal(repetida.statusCode, 200)
  assert.deepEqual(repetida.json().tags, ['wifi', 'laboratorio'])

  const invalida = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/tags',
    headers: { authorization: `Bearer ${tokenAna}` },
    payload: { tag: 'aula virtual' },
  })
  assert.equal(invalida.statusCode, 400)

  const quitaAusente = await app.inject({
    method: 'DELETE',
    url: '/incidencias/INC-20261022-CR-0001/tags/no-esta',
    headers: { authorization: `Bearer ${tokenAna}` },
  })
  assert.equal(quitaAusente.statusCode, 200)
  assert.deepEqual(quitaAusente.json().tags, ['wifi', 'laboratorio'])

  const quita = await app.inject({
    method: 'DELETE',
    url: '/incidencias/INC-20261022-CR-0001/tags/WiFi',
    headers: { authorization: `Bearer ${tokenAna}` },
  })
  assert.equal(quita.statusCode, 200)
  assert.deepEqual(quita.json().tags, ['laboratorio'])

  const tagAjena = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261021-IN-0002/tags',
    headers: { authorization: `Bearer ${tokenAna}` },
    payload: { tag: 'laboratorio' },
  })
  assert.equal(tagAjena.statusCode, 403)

  const tagDirectivo = await app.inject({
    method: 'POST',
    url: '/incidencias/INC-20261022-CR-0001/tags',
    headers: { authorization: `Bearer ${tokenDirectivo}` },
    payload: { tag: 'laboratorio' },
  })
  assert.equal(tagDirectivo.statusCode, 403)
})

test('M5: analitica y borrado de ticket', async (t) => {
  const { db, usuarios, incidencias } = crearMongo()
  const hash = await bcrypt.hash('utmdesk123', 4)
  const cuentas = [
    ['ana.lopez@utm.mx', 'Ana López Ruiz', 'reportante', 'docente'],
    ['tec.jmartinez@utm.mx', 'J. Martínez', 'tecnico', 'administrativo'],
    ['soporte@utm.mx', 'Mesa UTM Desk', 'soporte', 'administrativo'],
    ['directivo@utm.mx', 'Dirección UTM', 'directivo', 'administrativo'],
    ['coordinador@utm.mx', 'Coordinación de soporte', 'coordinador', 'administrativo'],
  ].map(([correo, nombre, rol, perfil]) => ({
    _id: new ObjectId(),
    correo,
    hash_contrasena: hash,
    nombre,
    rol,
    perfil,
    activo: true,
  }))
  usuarios.push(...cuentas)
  const ana = cuentas[0]

  const borrados = []
  const storage = {
    async firmarEvidencias(evidencias = []) {
      return evidencias
    },
    async subirEvidencia() {},
    async eliminarObjeto(ruta) {
      borrados.push(ruta)
    },
    async eliminarObjetos(rutas = []) {
      borrados.push(...rutas.filter(Boolean))
    },
  }

  const app = await crearApp(db, { async siguiente() {} }, storage)
  t.after(() => app.close())

  async function tokenDe(correo) {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { correo, contrasena: 'utmdesk123' },
    })
    assert.equal(respuesta.statusCode, 200)
    return respuesta.json().token
  }

  const tokenAna = await tokenDe('ana.lopez@utm.mx')
  const tokenTecnico = await tokenDe('tec.jmartinez@utm.mx')
  const tokenSoporte = await tokenDe('soporte@utm.mx')
  const tokenDirectivo = await tokenDe('directivo@utm.mx')
  const tokenCoord = await tokenDe('coordinador@utm.mx')

  const sinToken = await app.inject({ method: 'GET', url: '/analitica/resolucion-por-edificio' })
  assert.equal(sinToken.statusCode, 401)

  const vacia = await app.inject({
    method: 'GET',
    url: '/analitica/resolucion-por-edificio',
    headers: { authorization: `Bearer ${tokenDirectivo}` },
  })
  assert.equal(vacia.statusCode, 200)
  assert.deepEqual(vacia.json().items, [])

  const etiquetasVacias = await app.inject({
    method: 'GET',
    url: '/analitica/etiquetas-frecuentes',
    headers: { authorization: `Bearer ${tokenSoporte}` },
  })
  assert.equal(etiquetasVacias.statusCode, 200)
  assert.deepEqual(etiquetasVacias.json().items, [])

  const inicio = new Date('2026-10-01T00:00:00.000Z')
  const mas24 = new Date('2026-10-02T00:00:00.000Z')
  const mas48 = new Date('2026-10-03T00:00:00.000Z')
  const bajas = Array.from({ length: 12 }, (_, indice) => `t${String(indice + 1).padStart(2, '0')}`)

  function base(codigo, extra) {
    return {
      _id: new ObjectId(),
      codigo,
      titulo: codigo,
      descripcion: 'Seguimiento de prueba',
      categoria: 'computo_redes',
      prioridad: 'baja',
      estado: 'abierta',
      reportante: {
        usuario_id: ana._id,
        nombre: ana.nombre,
        perfil: ana.perfil,
        correo: ana.correo,
      },
      ubicacion: { edificio: 'Edificio A', aula_o_zona: 'Aula 1' },
      detalle_especifico: { direccion_ip: '10.0.0.2', vlan: 1, puerto_uplink: 'Gi0/2', equipos_afectados: 1 },
      tags: [],
      historial_seguimiento: [],
      evidencias_adjuntas: [],
      horas_invertidas: 0,
      fecha_creacion: inicio,
      fecha_actualizacion: inicio,
      ...extra,
    }
  }

  incidencias.push(
    base('INC-20261001-CR-0001', {
      estado: 'resuelta',
      ubicacion: { edificio: 'Edificio A', aula_o_zona: 'Lab' },
      tags: ['wifi', 'alfa'],
      horas_invertidas: 1.5,
      fecha_creacion: inicio,
      fecha_resolucion: mas48,
    }),
    base('INC-20261001-CR-0002', {
      estado: 'cerrada',
      ubicacion: { edificio: 'Edificio B', aula_o_zona: 'Pasillo' },
      tags: ['wifi', 'beta'],
      horas_invertidas: 4,
      fecha_creacion: inicio,
      fecha_resolucion: mas24,
    }),
    base('INC-20261001-CR-0003', {
      estado: 'abierta',
      horas_invertidas: 99,
      tags: ['wifi', 'alfa', 'beta', ...bajas],
    }),
    base('INC-20261001-IN-0004', {
      categoria: 'infraestructura',
      evidencias_adjuntas: [
        {
          nombre_archivo: 'fuga.pdf',
          tipo_mime: 'application/pdf',
          peso_kb: 20,
          url_storage: 'INC-20261001-IN-0004/fuga.pdf',
          fecha_carga: inicio,
        },
      ],
    }),
  )

  for (const token of [tokenAna, tokenTecnico]) {
    const bloqueada = await app.inject({
      method: 'GET',
      url: '/analitica/etiquetas-frecuentes',
      headers: { authorization: `Bearer ${token}` },
    })
    assert.equal(bloqueada.statusCode, 403)
  }

  const resolucion = await app.inject({
    method: 'GET',
    url: '/analitica/resolucion-por-edificio',
    headers: { authorization: `Bearer ${tokenDirectivo}` },
  })
  assert.equal(resolucion.statusCode, 200)
  assert.match(resolucion.json().criterio, /calendario/)
  assert.match(resolucion.json().criterio, /horas_invertidas/)
  assert.deepEqual(
    resolucion.json().items.map((item) => item.edificio),
    ['Edificio A', 'Edificio B'],
  )
  const edificioA = resolucion.json().items[0]
  assert.equal(edificioA.casos, 1)
  assert.equal(edificioA.horas_trabajo, 1.5)
  assert.equal(edificioA.tiempo_transcurrido_promedio_horas, 48)
  assert.equal(edificioA.tiempo_transcurrido_promedio_dias, 2)
  assert.notEqual(edificioA.horas_trabajo, edificioA.tiempo_transcurrido_promedio_horas)
  const edificioB = resolucion.json().items[1]
  assert.equal(edificioB.casos, 1)
  assert.equal(edificioB.horas_trabajo, 4)
  assert.equal(edificioB.tiempo_transcurrido_promedio_horas, 24)

  const etiquetas = await app.inject({
    method: 'GET',
    url: '/analitica/etiquetas-frecuentes',
    headers: { authorization: `Bearer ${tokenSoporte}` },
  })
  assert.equal(etiquetas.statusCode, 200)
  assert.equal(etiquetas.json().items.length, 10)
  assert.deepEqual(etiquetas.json().items[0], { tag: 'wifi', total: 3 })
  assert.deepEqual(etiquetas.json().items[1], { tag: 'alfa', total: 2 })
  assert.deepEqual(etiquetas.json().items[2], { tag: 'beta', total: 2 })
  assert.equal(etiquetas.json().items[3].tag, 't01')
  assert.equal(etiquetas.json().items[9].tag, 't07')
  assert.equal(
    etiquetas.json().items.some((item) => item.tag === 't08'),
    false,
  )

  const borraTecnico = await app.inject({
    method: 'DELETE',
    url: '/incidencias/INC-20261001-IN-0004',
    headers: { authorization: `Bearer ${tokenTecnico}` },
  })
  assert.equal(borraTecnico.statusCode, 403)
  assert.equal(incidencias.some((item) => item.codigo === 'INC-20261001-IN-0004'), true)

  const borraMal = await app.inject({
    method: 'DELETE',
    url: '/incidencias/INC-20990101-AC-9999',
    headers: { authorization: `Bearer ${tokenCoord}` },
  })
  assert.equal(borraMal.statusCode, 404)

  const borra = await app.inject({
    method: 'DELETE',
    url: '/incidencias/INC-20261001-IN-0004',
    headers: { authorization: `Bearer ${tokenCoord}` },
  })
  assert.equal(borra.statusCode, 200)
  assert.deepEqual(borrados, ['INC-20261001-IN-0004/fuga.pdf'])
  assert.equal(incidencias.some((item) => item.codigo === 'INC-20261001-IN-0004'), false)
})
