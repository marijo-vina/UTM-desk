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
