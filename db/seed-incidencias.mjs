import { conectar } from './mongo.mjs'

const TECNICO = 'tec.jmartinez@utm.mx'
const ZONA = 'America/Merida'

const REPORTANTES = {
  ana: 'ana.lopez@utm.mx',
  tecnico: 'tec.jmartinez@utm.mx',
  soporte: 'soporte@utm.mx',
  coordinador: 'coordinador@utm.mx',
}

const TICKETS = [
  ['ana', 2, 'computo_redes', 1, 'abierta', 'alta', 'Edificio B', 'Laboratorio B-204', 'Punto de acceso sin servicio en el laboratorio B-204', 'El identificador UTM-Lab-B no responde durante la practica.', { direccion_ip: '10.20.15.44', vlan: 120, puerto_uplink: 'Gi0/24', equipos_afectados: 18, dispositivo: 'AP del laboratorio B-204' }, ['wifi', 'laboratorio'], ['ap-b204.jpg', 'image/jpeg', 842], 0],
  ['ana', 6, 'computo_redes', 2, 'en_proceso', 'media', 'Edificio A', 'Laboratorio A-101', 'Switch del laboratorio A-101 reinicia solo', 'Los equipos pierden red cada quince minutos.', { direccion_ip: '10.20.11.2', vlan: 110, puerto_uplink: 'Gi0/1', equipos_afectados: 24, dispositivo: 'Switch de acceso A-101' }, ['switch', 'laboratorio'], ['switch-a101.png', 'image/png', 640], 1.5],
  ['ana', 8, 'computo_redes', 3, 'en_espera', 'critica', 'Edificio C', 'Aula C-203', 'VLAN del aula C-203 sin salida a internet', 'Las computadoras quedan aisladas en la VLAN 130.', { direccion_ip: '10.20.30.1', vlan: 130, puerto_uplink: 'Gi0/12', equipos_afectados: 30, ssid_o_segmento: 'UTM-Aulas' }, ['vlan', 'internet'], ['vlan-c203.pdf', 'application/pdf', 980], 2],
  ['ana', 20, 'computo_redes', 4, 'resuelta', 'baja', 'Edificio D', 'Cubiculo D-12', 'Equipo del cubiculo D-12 no enciende', 'La computadora de escritorio no da video.', { direccion_ip: '10.20.40.12', vlan: 140, puerto_uplink: 'Gi0/8', equipos_afectados: 1, dispositivo: 'PC del cubiculo D-12' }, ['equipo', 'cubiculo'], null, 1],
  ['ana', 30, 'computo_redes', 5, 'cerrada', 'alta', 'Edificio B', 'Laboratorio B-101', 'Caida del servidor local del laboratorio B-101', 'El servidor de practicas no acepta sesiones.', { direccion_ip: '10.20.15.10', vlan: 120, puerto_uplink: 'Gi0/2', equipos_afectados: 20, dispositivo: 'Servidor de practicas B-101' }, ['servidor', 'laboratorio'], ['servidor-b101.pdf', 'application/pdf', 1500], 4],
  ['soporte', 1, 'computo_redes', 6, 'abierta', 'baja', 'Biblioteca', 'Sala de consulta 2', 'Dos equipos de la sala de consulta sin red', 'Las PCs 4 y 5 no obtienen direccion.', { direccion_ip: '10.20.50.4', vlan: 150, puerto_uplink: 'Gi0/4', equipos_afectados: 2 }, ['red', 'biblioteca'], null, 0],
  ['coordinador', 4, 'computo_redes', 7, 'en_proceso', 'alta', 'Edificio A', 'Auditorio', 'Proyector del auditorio sin red para la videoconferencia', 'El equipo no alcanza el segmento de presentaciones.', { direccion_ip: '10.20.10.30', vlan: 100, puerto_uplink: 'Gi0/20', equipos_afectados: 1, dispositivo: 'Proyector del auditorio', ssid_o_segmento: 'UTM-Eventos' }, ['auditorio', 'videoconferencia'], ['auditorio.png', 'image/png', 720], 2],
  ['ana', 12, 'computo_redes', 8, 'resuelta', 'media', 'Edificio C', 'Laboratorio C-301', 'Puntos de acceso del laboratorio C-301 saturados', 'La practica de redes no logra asociar mas de diez equipos.', { direccion_ip: '10.20.30.44', vlan: 130, puerto_uplink: 'Gi0/16', equipos_afectados: 16, dispositivo: 'AP del laboratorio C-301' }, ['wifi', 'laboratorio'], ['ap-c301.jpg', 'image/jpeg', 510], 3],
  ['ana', 3, 'infraestructura', 9, 'abierta', 'critica', 'Edificio C', 'Aula C-101', 'Filtracion en el aula C-101', 'Goteo sobre contactos electricos del aula.', { tipo_dano: 'filtracion', riesgo_seguridad: true, requiere_insumos: true, insumos: ['sellador', 'lamina'], contratista_externo: true, nombre_contratista: 'Impermeabilizaciones del Sur' }, ['filtracion', 'riesgo-electrico'], ['filtracion-c101.pdf', 'application/pdf', 1250], 0],
  ['tecnico', 7, 'infraestructura', 10, 'en_proceso', 'alta', 'Edificio D', 'Pasillo principal', 'Luminarias fundidas en el pasillo del edificio D', 'Cuatro lamparas quedan apagadas desde la tarde.', { tipo_dano: 'luminaria', riesgo_seguridad: false, requiere_insumos: true, insumos: ['tubo-led'], contratista_externo: false }, ['luminaria', 'pasillo'], ['pasillo-d.jpg', 'image/jpeg', 430], 1],
  ['ana', 11, 'infraestructura', 11, 'en_espera', 'media', 'Edificio A', 'Sanitarios planta baja', 'Fuga en el lavabo de los sanitarios', 'El agua escurre hacia el pasillo.', { tipo_dano: 'fuga', riesgo_seguridad: false, requiere_insumos: true, insumos: ['empaque'], contratista_externo: false }, ['fuga', 'sanitarios'], null, 0.5],
  ['soporte', 15, 'infraestructura', 12, 'resuelta', 'alta', 'Edificio B', 'Azotea', 'Charco en la azotea del edificio B', 'El agua se estanca junto a la bajante.', { tipo_dano: 'filtracion', riesgo_seguridad: true, requiere_insumos: true, insumos: ['sellador'], contratista_externo: true, nombre_contratista: 'Impermeabilizaciones del Sur' }, ['azotea', 'filtracion'], ['azotea-b.pdf', 'application/pdf', 860], 3],
  ['ana', 25, 'infraestructura', 13, 'cerrada', 'media', 'Edificio C', 'Aula C-210', 'Clima del aula C-210 no enfria', 'El equipo enciende y no baja la temperatura.', { tipo_dano: 'climatizacion', riesgo_seguridad: false, requiere_insumos: true, insumos: ['filtro'], contratista_externo: true, nombre_contratista: 'Climas del Sureste' }, ['clima', 'aula'], ['clima-c210.jpg', 'image/jpeg', 390], 2],
  ['coordinador', 2, 'infraestructura', 14, 'abierta', 'baja', 'Edificio D', 'Cubiculo D-04', 'Cerradura del cubiculo D-04 no asegura', 'La puerta cierra y el pestillo no entra.', { tipo_dano: 'cerradura', riesgo_seguridad: true, requiere_insumos: false, contratista_externo: false }, ['cerradura', 'cubiculo'], null, 0],
  ['ana', 5, 'infraestructura', 15, 'en_proceso', 'critica', 'Biblioteca', 'Sala de lectura', 'Filtracion sobre la sala de lectura', 'El techo gotea encima de dos mesas.', { tipo_dano: 'filtracion', riesgo_seguridad: true, requiere_insumos: true, insumos: ['lona', 'cubeta'], contratista_externo: false }, ['filtracion', 'biblioteca'], ['sala-lectura.jpg', 'image/jpeg', 770], 1.5],
  ['ana', 18, 'infraestructura', 16, 'resuelta', 'baja', 'Edificio A', 'Aula A-220', 'Luminaria fundida en el aula A-220', 'Una lampara del fondo queda intermitente.', { tipo_dano: 'luminaria', riesgo_seguridad: false, requiere_insumos: true, insumos: ['tubo-led'], contratista_externo: false }, ['luminaria', 'aula'], ['aula-a220.png', 'image/png', 280], 1],
  ['ana', 1, 'academico', 17, 'abierta', 'media', 'Edificio A', 'Cubiculo A-312', 'No se pueden asentar actas del grupo BDN-402', 'El portal de calificaciones rechaza el guardado del grupo.', { plataforma: 'Portal de calificaciones', codigo_curso: 'BDN-402', periodo_escolar: '2026-1', estudiantes_impactados: 35, tipo_falla: 'error_actas' }, ['actas', 'portal-calificaciones'], null, 0],
  ['ana', 6, 'academico', 18, 'en_proceso', 'alta', 'Edificio B', 'Laboratorio B-204', 'El aula virtual no abre la practica de redes', 'El grupo no entra al curso durante la sesion.', { plataforma: 'Aula virtual', codigo_curso: 'RED-210', periodo_escolar: '2026-1', estudiantes_impactados: 28, tipo_falla: 'acceso_lms' }, ['aula-virtual', 'laboratorio'], ['lms-b204.png', 'image/png', 540], 2],
  ['soporte', 9, 'academico', 19, 'en_espera', 'baja', 'Edificio C', 'Direccion academica', 'Bloqueo de correo de tres estudiantes', 'Las cuentas rechazan el inicio de sesion.', { plataforma: 'Correo institucional', periodo_escolar: '2026-1', estudiantes_impactados: 3, tipo_falla: 'bloqueo_correo' }, ['correo', 'cuentas'], null, 0.5],
  ['ana', 14, 'academico', 20, 'resuelta', 'critica', 'Edificio D', 'Sala de maestros', 'El portal rechazo el cierre de actas del turno vespertino', 'Ningun docente del edificio pudo guardar.', { plataforma: 'Portal de calificaciones', periodo_escolar: '2026-1', estudiantes_impactados: 120, tipo_falla: 'error_actas' }, ['actas', 'portal-calificaciones'], ['actas-d.pdf', 'application/pdf', 640], 3],
  ['coordinador', 22, 'academico', 21, 'cerrada', 'media', 'Biblioteca', 'Mostrador de prestamo', 'El sistema de prestamo no registra devoluciones', 'Los prestamos del dia quedan abiertos.', { plataforma: 'Sistema de biblioteca', periodo_escolar: '2026-1', estudiantes_impactados: 40, tipo_falla: 'prestamo' }, ['biblioteca', 'prestamo'], ['prestamo.jpg', 'image/jpeg', 360], 2],
  ['ana', 4, 'academico', 22, 'abierta', 'alta', 'Edificio A', 'Aula A-105', 'El aula virtual saca al grupo A-105 a media clase', 'La sesion se cierra sola despues de diez minutos.', { plataforma: 'Aula virtual', codigo_curso: 'POO-115', periodo_escolar: '2026-1', estudiantes_impactados: 32, tipo_falla: 'acceso_lms' }, ['aula-virtual', 'sesion'], ['lms-a105.png', 'image/png', 480], 0],
  ['tecnico', 8, 'academico', 23, 'en_proceso', 'media', 'Edificio B', 'Aula B-110', 'No carga la lista del grupo BDN-318', 'La pantalla de asistencia queda en blanco.', { plataforma: 'Portal de calificaciones', codigo_curso: 'BDN-318', periodo_escolar: '2026-1', estudiantes_impactados: 27, tipo_falla: 'lista_grupo' }, ['lista', 'portal-calificaciones'], null, 1],
  ['ana', 16, 'academico', 24, 'resuelta', 'alta', 'Edificio C', 'Aula C-110', 'Error al firmar actas del aula C-110', 'El portal muestra un fallo al confirmar la firma.', { plataforma: 'Portal de calificaciones', codigo_curso: 'MAT-201', periodo_escolar: '2026-1', estudiantes_impactados: 33, tipo_falla: 'error_actas' }, ['actas', 'firma'], ['actas-c110.pdf', 'application/pdf', 410], 2],
]

function diasAtras(dias) {
  const fecha = new Date()
  fecha.setUTCHours(15, 0, 0, 0)
  fecha.setUTCDate(fecha.getUTCDate() - dias)
  return fecha
}

function partesMerida(fecha) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha)
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value
  return `${valor('year')}${valor('month')}${valor('day')}`
}

function codigoDe(categoria, fecha, numero) {
  const sigla = { computo_redes: 'CR', infraestructura: 'IN', academico: 'AC' }[categoria]
  return `INC-${partesMerida(fecha)}-${sigla}-${String(numero).padStart(4, '0')}`
}

function evidencia(codigo, fecha, archivo) {
  const [nombre, tipo, peso] = archivo
  const dia = codigo.slice(4, 12)
  return {
    nombre_archivo: nombre,
    tipo_mime: tipo,
    peso_kb: peso,
    url_storage: `evidencias/${dia.slice(0, 4)}/${dia.slice(4, 6)}/${dia.slice(6, 8)}/${codigo}/${nombre}`,
    fecha_carga: fecha,
  }
}

function historial(estado, creacion, fin, horas) {
  const alta = {
    fecha: creacion,
    autor: 'sistema',
    estado_resultante: 'abierta',
    comentario: 'Incidencia registrada.',
    horas_registradas: 0,
  }
  if (estado === 'abierta') return [alta]
  if (estado === 'en_proceso' || estado === 'en_espera') {
    return [
      alta,
      {
        fecha: fin,
        autor: TECNICO,
        estado_resultante: estado,
        comentario: estado === 'en_proceso' ? 'Se inicio la atencion.' : 'La atencion queda en espera de un insumo.',
        horas_registradas: horas,
      },
    ]
  }
  const resuelta = {
    fecha: fin,
    autor: TECNICO,
    estado_resultante: 'resuelta',
    comentario: 'Se corrigio la falla reportada.',
    horas_registradas: horas,
  }
  if (estado === 'resuelta') return [alta, resuelta]
  const cierre = new Date(fin.getTime() + 60 * 60 * 1000)
  return [
    alta,
    resuelta,
    {
      fecha: cierre,
      autor: 'coordinador@utm.mx',
      estado_resultante: 'cerrada',
      comentario: 'Coordinacion cierra la incidencia.',
      horas_registradas: 0,
    },
  ]
}

function documento(fila, cuentas) {
  const [quien, dias, categoria, numero, estado, prioridad, edificio, aula, titulo, descripcion, detalle, tags, archivo, horas] = fila
  const cuenta = cuentas.get(REPORTANTES[quien])
  const creacion = diasAtras(dias)
  const fin = diasAtras(Math.max(dias - 2, 0))
  const codigo = codigoDe(categoria, creacion, numero)
  const eventos = historial(estado, creacion, fin, horas)
  const cierre = eventos.at(-1).fecha
  const doc = {
    codigo,
    titulo,
    descripcion,
    categoria,
    prioridad,
    estado,
    reportante: {
      usuario_id: cuenta._id,
      nombre: cuenta.nombre,
      perfil: cuenta.perfil,
      correo: cuenta.correo,
    },
    ubicacion: { edificio, aula_o_zona: aula },
    detalle_especifico: detalle,
    tags,
    historial_seguimiento: eventos,
    evidencias_adjuntas: archivo ? [evidencia(codigo, creacion, archivo)] : [],
    horas_invertidas: horas,
    fecha_creacion: creacion,
    fecha_actualizacion: cierre,
  }
  if (estado === 'resuelta' || estado === 'cerrada') doc.fecha_resolucion = fin
  if (estado !== 'abierta') doc.tecnico_asignado = TECNICO
  return doc
}

const { cliente, db } = await conectar()
try {
  const cuentas = new Map(
    (await db.collection('usuarios').find({}).toArray()).map((cuenta) => [cuenta.correo, cuenta]),
  )
  for (const correo of Object.values(REPORTANTES)) {
    if (!cuentas.has(correo)) throw new Error(`Falta la cuenta ${correo}. Corre npm run db:seed primero.`)
  }
  const incidencias = db.collection('incidencias_campus')
  for (const fila of TICKETS) {
    const doc = documento(fila, cuentas)
    await incidencias.replaceOne({ codigo: doc.codigo }, doc, { upsert: true })
  }
  const total = await incidencias.countDocuments()
  const conResolucion = await incidencias.countDocuments({ fecha_resolucion: { $exists: true } })
  const conEvidencia = await incidencias.countDocuments({ 'evidencias_adjuntas.0': { $exists: true } })
  const edificios = await incidencias.distinct('ubicacion.edificio')
  console.log(`incidencias: ${total}`)
  console.log(`con fecha de resolucion: ${conResolucion}`)
  console.log(`con evidencia: ${conEvidencia}`)
  console.log(`edificios: ${edificios.length} (${edificios.join(', ')})`)
} finally {
  await cliente.close()
}
