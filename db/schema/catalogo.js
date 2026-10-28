export const CATEGORIAS = ['computo_redes', 'infraestructura', 'academico']

export const CODIGO_CATEGORIA = {
  computo_redes: 'CR',
  infraestructura: 'IN',
  academico: 'AC',
}

export const PRIORIDADES = ['baja', 'media', 'alta', 'critica']

export const ESTADOS = ['abierta', 'en_proceso', 'en_espera', 'resuelta', 'cerrada']

export const ROLES = ['reportante', 'tecnico', 'soporte', 'coordinador', 'directivo', 'superAdmin']

export const ROLES_REGISTRAN = ['reportante', 'tecnico', 'soporte', 'coordinador', 'superAdmin']

/** Roles que pueden actualizar estado/bitácora (Tabla 6). */
export const ROLES_SEGUIMIENTO = ['tecnico', 'soporte', 'coordinador', 'superAdmin']

/** Analítica oculta a técnico y reportante (RF-11). */
export const ROLES_ANALITICA = ['soporte', 'coordinador', 'directivo', 'superAdmin']

/**
 * Matriz de transiciones (Tabla 6).
 * Misma clave = permitir solo horas/comentario sin cambiar de estado.
 * `en_proceso` y `en_espera` no regresan a `abierta`.
 * `cerrada` es terminal. `resuelta` solo puede pasar a `cerrada` (coordinador).
 */
export const TRANSICIONES = {
  abierta: ['abierta', 'en_proceso', 'en_espera', 'resuelta'],
  en_proceso: ['en_proceso', 'en_espera', 'resuelta'],
  en_espera: ['en_espera', 'en_proceso', 'resuelta'],
  resuelta: ['cerrada'],
  cerrada: [],
}

export const PERFILES = ['docente', 'estudiante', 'administrativo']

export const ZONA_HORARIA = 'America/Merida'

export const PATRON_FOLIO = '^INC-\\d{8}-(CR|IN|AC)-\\d{4}$'

export const TIPOS_EVIDENCIA = ['image/jpeg', 'image/png', 'application/pdf']
