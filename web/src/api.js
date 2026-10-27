const CLAVE = 'utm-desk-sesion'

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

export async function registrarIncidencia(incidencia) {
  return pedir('/incidencias', { metodo: 'POST', cuerpo: incidencia })
}

const rutaIncidencia = (codigo) => `/incidencias/${encodeURIComponent(codigo)}`

export async function obtenerIncidencia(codigo) {
  return pedir(rutaIncidencia(codigo))
}

export const actualizarIncidencia = (codigo, cambios) =>
  pedir(rutaIncidencia(codigo), { metodo: 'PATCH', cuerpo: cambios })

export const eliminarIncidencia = (codigo) => pedir(rutaIncidencia(codigo), { metodo: 'DELETE' })

export const agregarTag = (codigo, tag) =>
  pedir(`${rutaIncidencia(codigo)}/tags`, { metodo: 'POST', cuerpo: { tag } })

export const quitarTag = (codigo, tag) =>
  pedir(`${rutaIncidencia(codigo)}/tags/${encodeURIComponent(tag)}`, { metodo: 'DELETE' })

export function analiticaPorEdificio() {
  return pedir('/analitica/resolucion-por-edificio')
}

export function analiticaEtiquetas() {
  return pedir('/analitica/etiquetas-frecuentes')
}

/** GET /incidencias?categoria&estado&edificio&q&pagina&limite */
export async function listarIncidencias({
  q = '',
  categoria = '',
  estado = '',
  edificio = '',
  page = 1,
  limit = 10,
} = {}) {
  const pagina = Math.max(1, Number(page) || 1)
  const limite = Math.max(1, Number(limit) || 10)
  const datos = await pedir('/incidencias', {
    consulta: { q, categoria, estado, edificio, pagina, limite },
  })
  const items = Array.isArray(datos) ? datos : datos?.items ?? datos?.incidencias ?? datos?.data ?? []
  const total = Number.isFinite(datos?.total) ? datos.total : items.length
  const paginas = Number.isFinite(datos?.paginas)
    ? datos.paginas
    : Number.isFinite(datos?.pages)
      ? datos.pages
      : Math.max(1, Math.ceil(total / limite))
  return {
    items,
    total,
    pagina: Number.isFinite(datos?.pagina) ? datos.pagina : pagina,
    paginas,
    limite: Number.isFinite(datos?.limite) ? datos.limite : limite,
  }
}
