import {
  ANALITICA_ETIQUETAS_SEMILLA,
  ANALITICA_POR_EDIFICIO_SEMILLA,
  INCIDENCIAS_SEMILLA,
} from './catalogo_datos.js'

const CLAVE = 'utm-desk-sesion'
const CLAVE_LOCAL_INCIDENCIAS = 'utm-desk-incidencias-locales'

let alExpirar = () => {}

/** Registra qué hacer cuando la API responde 401 con una sesión activa. */
export function alExpirarSesion(funcion) {
  alExpirar = funcion
}

function decodificar(token) {
  try {
    const carga = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(carga))))
  } catch {
    return null
  }
}

export function expiracionDe(sesion) {
  const exp = decodificar(sesion?.token ?? '')?.exp
  return typeof exp === 'number' ? exp * 1000 : null
}

export function leerSesion() {
  for (const almacen of [sessionStorage, localStorage]) {
    const crudo = almacen.getItem(CLAVE)
    if (!crudo) continue
    try {
      const sesion = JSON.parse(crudo)
      const vence = expiracionDe(sesion)
      if (sesion?.token && sesion?.usuario && (!vence || vence > Date.now())) return sesion
    } catch {
      /* sesion corrupta: se descarta abajo */
    }
    almacen.removeItem(CLAVE)
  }
  return null
}

export function guardarSesion(sesion, recordar) {
  borrarSesion()
  ;(recordar ? localStorage : sessionStorage).setItem(CLAVE, JSON.stringify(sesion))
}

export function borrarSesion() {
  sessionStorage.removeItem(CLAVE)
  localStorage.removeItem(CLAVE)
}

export class ErrorApi extends Error {
  constructor(mensaje, { status = 0, detalles, noDisponible = false, sinConexion = false } = {}) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.status = status
    this.detalles = detalles
    this.noDisponible = noDisponible
    this.sinConexion = sinConexion
  }
}

function consultaLimpia(consulta) {
  const parametros = new URLSearchParams()
  for (const [clave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== null && String(valor).trim() !== '')
      parametros.set(clave, String(valor).trim())
  }
  const texto = parametros.toString()
  return texto ? `?${texto}` : ''
}

async function pedir(ruta, { metodo = 'GET', cuerpo, consulta, autenticado = true } = {}) {
  const headers = {}
  const token = autenticado ? leerSesion()?.token : null
  if (token) headers.Authorization = `Bearer ${token}`
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'

  let respuesta
  try {
    respuesta = await fetch(`/api${ruta}${consultaLimpia(consulta)}`, {
      method: metodo,
      headers,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    })
  } catch {
    throw new ErrorApi('No hay conexión con el servidor. Verifica que la API esté en ejecución.', {
      sinConexion: true,
    })
  }

  const datos = await respuesta.json().catch(() => ({}))
  if (respuesta.ok) return datos

  const rutaInexistente = [404, 405].includes(respuesta.status) && /^Route /.test(datos?.message ?? '')
  if (rutaInexistente) {
    throw new ErrorApi('Esta consulta aún no está disponible en la API.', {
      status: respuesta.status,
      noDisponible: true,
    })
  }
  if (respuesta.status === 401 && token) {
    alExpirar()
    throw new ErrorApi('Tu sesión expiró. Inicia sesión de nuevo.', { status: 401 })
  }
  if (respuesta.status >= 500 && !datos?.error) {
    throw new ErrorApi('El servidor no respondió. Verifica que la API esté en ejecución.', {
      status: respuesta.status,
    })
  }
  throw new ErrorApi(datos?.error || 'No se pudo completar la operación.', {
    status: respuesta.status,
    detalles: datos?.detalles,
  })
}

export async function iniciarSesion(correo, contrasena) {
  try {
    return await pedir('/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena }, autenticado: false })
  } catch (error) {
    if (error.status === 401) throw new ErrorApi('Correo o contraseña incorrectos.', { status: 401 })
    throw error
  }
}

/** Almacén local de incidencias registradas en la sesión actual */
function leerIncidenciasLocales() {
  try {
    const crudo = sessionStorage.getItem(CLAVE_LOCAL_INCIDENCIAS)
    return crudo ? JSON.parse(crudo) : []
  } catch {
    return []
  }
}

function guardarIncidenciaLocal(incidencia) {
  try {
    const lista = leerIncidenciasLocales()
    lista.unshift(incidencia)
    sessionStorage.setItem(CLAVE_LOCAL_INCIDENCIAS, JSON.stringify(lista))
  } catch {
    /* ignore */
  }
}

export async function registrarIncidencia(incidencia) {
  const respuesta = await pedir('/incidencias', { metodo: 'POST', cuerpo: incidencia })
  // Cachear para visualización inmediata
  guardarIncidenciaLocal({
    ...incidencia,
    codigo: respuesta.codigo,
    estado: respuesta.estado ?? 'abierta',
    fecha_creacion: respuesta.fecha_creacion ?? new Date().toISOString(),
    fecha_actualizacion: new Date().toISOString(),
    historial_seguimiento: [
      {
        fecha: new Date().toISOString(),
        autor: 'sistema',
        estado_resultante: 'abierta',
        comentario: 'Incidencia registrada en portal.',
        horas_registradas: 0,
      },
    ],
    evidencias_adjuntas: [],
  })
  return respuesta
}

const rutaIncidencia = (codigo) => `/incidencias/${encodeURIComponent(codigo)}`

export async function obtenerIncidencia(codigo) {
  try {
    return await pedir(rutaIncidencia(codigo))
  } catch (error) {
    if (error.noDisponible) {
      const locales = leerIncidenciasLocales()
      const todas = [...locales, ...INCIDENCIAS_SEMILLA]
      const encontrada = todas.find((item) => item.codigo === codigo)
      if (encontrada) return encontrada
    }
    throw error
  }
}

export const actualizarIncidencia = (codigo, cambios) =>
  pedir(rutaIncidencia(codigo), { metodo: 'PATCH', cuerpo: cambios })

export const eliminarIncidencia = (codigo) => pedir(rutaIncidencia(codigo), { metodo: 'DELETE' })

export const agregarTag = (codigo, tag) =>
  pedir(`${rutaIncidencia(codigo)}/tags`, { metodo: 'POST', cuerpo: { tag } })

export const quitarTag = (codigo, tag) =>
  pedir(`${rutaIncidencia(codigo)}/tags/${encodeURIComponent(tag)}`, { metodo: 'DELETE' })

export async function analiticaPorEdificio() {
  try {
    return await pedir('/analitica/resolucion-por-edificio')
  } catch (error) {
    if (error.noDisponible) {
      return ANALITICA_POR_EDIFICIO_SEMILLA
    }
    throw error
  }
}

export async function analiticaEtiquetas() {
  try {
    return await pedir('/analitica/etiquetas-frecuentes')
  } catch (error) {
    if (error.noDisponible) {
      return ANALITICA_ETIQUETAS_SEMILLA
    }
    throw error
  }
}

/** GET /incidencias?categoria&estado&edificio&q&page&limit */
export async function listarIncidencias({
  q = '',
  categoria = '',
  estado = '',
  edificio = '',
  page = 1,
  limit = 10,
} = {}) {
  try {
    const datos = await pedir('/incidencias', {
      consulta: { q, categoria, estado, edificio, page, limit },
    })
    const items = Array.isArray(datos) ? datos : datos?.items ?? datos?.incidencias ?? datos?.data ?? []
    const total = Number.isFinite(datos?.total) ? datos.total : items.length
    const paginas = Number.isFinite(datos?.paginas)
      ? datos.paginas
      : Number.isFinite(datos?.pages)
      ? datos.pages
      : Math.max(1, Math.ceil(total / limit))
    return { items, total, pagina: page, paginas, limite: limit }
  } catch (error) {
    if (error.noDisponible) {
      // Fallback enriquecido: combina nuevas creadas con las semillas oficiales
      const locales = leerIncidenciasLocales()
      let todas = [...locales, ...INCIDENCIAS_SEMILLA]

      if (q) {
        const busqueda = q.toLowerCase()
        todas = todas.filter(
          (i) =>
            i.codigo.toLowerCase().includes(busqueda) ||
            i.titulo.toLowerCase().includes(busqueda) ||
            i.descripcion?.toLowerCase().includes(busqueda),
        )
      }
      if (categoria) {
        todas = todas.filter((i) => i.categoria === categoria)
      }
      if (estado) {
        todas = todas.filter((i) => i.estado === estado)
      }
      if (edificio) {
        todas = todas.filter((i) => i.ubicacion?.edificio === edificio)
      }

      const total = todas.length
      const inicio = (page - 1) * limit
      const items = todas.slice(inicio, inicio + limit)
      const paginas = Math.max(1, Math.ceil(total / limit))

      return { items, total, pagina: page, paginas, limite: limit }
    }
    throw error
  }
}
