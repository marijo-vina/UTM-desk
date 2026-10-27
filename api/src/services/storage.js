import { createClient } from '@supabase/supabase-js'

/** Tope de RF-02: mayor a 5 MB responde 413. */
export const LIMITE_EVIDENCIA_BYTES = 5 * 1024 * 1024

const SEGUNDOS_FIRMA = 3600

function errorHttp(mensaje, statusCode) {
  const error = new Error(mensaje)
  error.statusCode = statusCode
  return error
}

/**
 * Firma, sube y borra evidencias en Supabase Storage.
 * Sin credenciales, la firma deja url_firmada en null y la escritura responde 503.
 */
export function crearStorage({ url, serviceRoleKey, bucket } = {}) {
  if (!url || !serviceRoleKey || !bucket) {
    const noConfigurado = () => {
      throw errorHttp('Storage no esta configurado', 503)
    }
    return {
      async firmarEvidencias(evidencias = []) {
        return evidencias.map((evidencia) => ({
          ...evidencia,
          url_firmada: null,
        }))
      },
      async subirEvidencia() {
        noConfigurado()
      },
      async eliminarObjeto() {
        noConfigurado()
      },
      async eliminarObjetos() {
        noConfigurado()
      },
    }
  }

  const cliente = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  async function eliminarObjetos(rutas = []) {
    const limpias = [...new Set(rutas.filter(Boolean))]
    if (limpias.length === 0) return
    const { error } = await cliente.storage.from(bucket).remove(limpias)
    if (error) throw errorHttp(error.message || 'No se pudo eliminar la evidencia', 502)
  }

  return {
    async firmarEvidencias(evidencias = []) {
      return Promise.all(
        evidencias.map(async (evidencia) => {
          const ruta = evidencia.url_storage
          const { data, error } = await cliente.storage
            .from(bucket)
            .createSignedUrl(ruta, SEGUNDOS_FIRMA)
          if (error) throw errorHttp(error.message || 'No se pudo firmar la evidencia', 502)
          return {
            ...evidencia,
            url_firmada: data.signedUrl,
          }
        }),
      )
    },

    async subirEvidencia({ ruta, buffer, contentType }) {
      const { error } = await cliente.storage.from(bucket).upload(ruta, buffer, {
        contentType,
        upsert: false,
      })
      if (error) throw errorHttp(error.message || 'No se pudo guardar la evidencia', 502)
      return ruta
    },

    async eliminarObjeto(ruta) {
      await eliminarObjetos([ruta])
    },

    eliminarObjetos,
  }
}
