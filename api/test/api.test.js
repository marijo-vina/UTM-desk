import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import { ObjectId } from 'mongodb'
import { buildApp } from '../src/app.js'

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
    return coincide(actual, valor)
  })
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
