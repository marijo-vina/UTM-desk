import { createClient } from '@supabase/supabase-js'

const SEGUNDOS_FIRMA = 3600

/**
 * Firma rutas de evidencias en Supabase Storage (1 h).
 * Sin credenciales, deja url_firmada en null para no tumbar el detalle.
 */
export function crearStorage({ url, serviceRoleKey, bucket } = {}) {
  if (!url || !serviceRoleKey || !bucket) {
    return {
      async firmarEvidencias(evidencias = []) {
        return evidencias.map((evidencia) => ({
          ...evidencia,
          url_firmada: null,
        }))
      },
    }
  }

  const cliente = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async firmarEvidencias(evidencias = []) {
      return Promise.all(
        evidencias.map(async (evidencia) => {
          const ruta = evidencia.url_storage
          const { data, error } = await cliente.storage
            .from(bucket)
            .createSignedUrl(ruta, SEGUNDOS_FIRMA)
          if (error) {
            const fallo = new Error(error.message || 'No se pudo firmar la evidencia')
            fallo.statusCode = 502
            throw fallo
          }
          return {
            ...evidencia,
            url_firmada: data.signedUrl,
          }
        }),
      )
    },
  }
}
