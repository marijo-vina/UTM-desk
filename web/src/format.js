export const ZONA = 'America/Merida'

export const CATEGORIAS = {
  computo_redes: { nombre: 'Cómputo y telecom', largo: 'Cómputo y Telecomunicaciones', descripcion: 'Redes, VLAN, switches, puntos de acceso y equipos.', icono: 'wifi' },
  infraestructura: { nombre: 'Infraestructura física', largo: 'Infraestructura Física', descripcion: 'Daños en edificios, instalaciones eléctricas, climas y mobiliario.', icono: 'building' },
  academico: { nombre: 'Sistemas académicos', largo: 'Sistemas Académicos', descripcion: 'Portal de calificaciones, aula virtual, correo y bibliotecas.', icono: 'book' },
}

export const ESTADOS = {
  abierta: 'Abierta',
  en_proceso: 'En proceso',
  en_espera: 'En espera',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
}

export const PRIORIDADES = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
}

export const ROLES = {
  reportante: 'Reportante',
  tecnico: 'Técnico',
  soporte: 'Soporte TI',
  coordinador: 'Coordinador',
  directivo: 'Directivo',
}

export const EDIFICIOS = ['Edificio A', 'Edificio B', 'Edificio C', 'Edificio D', 'Biblioteca']

export const PERMISOS = {
  registra: ['reportante', 'tecnico', 'soporte', 'coordinador'],
  atiende: ['tecnico', 'soporte', 'coordinador'],
  etiqueta: ['tecnico', 'soporte', 'coordinador'],
  asigna: ['coordinador'],
  elimina: ['coordinador'],
  analitica: ['coordinador', 'directivo'],
}

/** Tabla 6: abierta / en_proceso / en_espera van entre si o a resuelta; solo coordinador pasa resuelta a cerrada. */
export function transiciones(estado, rol) {
  if (!PERMISOS.atiende.includes(rol)) return []
  if (['abierta', 'en_proceso', 'en_espera'].includes(estado)) {
    return ['abierta', 'en_proceso', 'en_espera', 'resuelta'].filter((destino) => destino !== estado)
  }
  if (estado === 'resuelta' && rol === 'coordinador') return ['cerrada']
  return []
}

const fechaCorta = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric' })
const fechaLarga = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function fecha(iso) {
  if (!iso) return '—'
  const valor = new Date(iso)
  return Number.isNaN(valor.getTime()) ? '—' : fechaCorta.format(valor).replace('.', '')
}

export function fechaHora(iso) {
  if (!iso) return '—'
  const valor = new Date(iso)
  return Number.isNaN(valor.getTime()) ? '—' : fechaLarga.format(valor).replace('.', '')
}

export function horas(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return '—'
  return `${Number.isInteger(valor) ? valor : valor.toFixed(1)} h`
}

export function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}

export const ETIQUETAS_DETALLE = {
  direccion_ip: 'Dirección IP',
  vlan: 'VLAN',
  puerto_uplink: 'Puerto uplink',
  equipos_afectados: 'Equipos afectados',
  dispositivo: 'Dispositivo',
  ssid_o_segmento: 'SSID o segmento',
  tipo_dano: 'Tipo de daño',
  riesgo_seguridad: 'Riesgo de seguridad',
  requiere_insumos: 'Requiere insumos',
  insumos: 'Insumos',
  contratista_externo: 'Contratista externo',
  nombre_contratista: 'Contratista',
  plataforma: 'Plataforma',
  periodo_escolar: 'Periodo escolar',
  estudiantes_impactados: 'Estudiantes impactados',
  codigo_curso: 'Código de curso',
  tipo_falla: 'Tipo de falla',
}

export function valorDetalle(valor) {
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (Array.isArray(valor)) return valor.join(', ')
  return String(valor)
}
