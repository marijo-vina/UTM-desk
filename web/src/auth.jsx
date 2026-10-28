import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { alExpirarSesion, borrarSesion, expiracionDe, guardarSesion, iniciarSesion, leerSesion } from './api.js'

const Contexto = createContext(null)

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion)
  const [aviso, setAviso] = useState('')

  const salir = useCallback((motivo = '') => {
    borrarSesion()
    setSesion(null)
    setAviso(typeof motivo === 'string' ? motivo : '')
    window.location.hash = ''
  }, [])

  const entrar = useCallback(async (correo, contrasena, recordar) => {
    const datos = await iniciarSesion(correo, contrasena)
    guardarSesion(datos, recordar)
    setAviso('')
    setSesion(datos)
    return datos
  }, [])

  useEffect(() => {
    alExpirarSesion(() => salir('Tu sesión expiró. Inicia sesión de nuevo.'))
  }, [salir])

  useEffect(() => {
    const vence = expiracionDe(sesion)
    if (!vence) return undefined
    const espera = Math.max(vence - Date.now(), 0)
    const temporizador = setTimeout(() => salir('Tu sesión expiró. Inicia sesión de nuevo.'), Math.min(espera, 2 ** 31 - 1))
    return () => clearTimeout(temporizador)
  }, [sesion, salir])

  const valor = useMemo(
    () => ({ sesion, usuario: sesion?.usuario ?? null, aviso, entrar, salir }),
    [sesion, aviso, entrar, salir],
  )
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAuth() {
  return useContext(Contexto)
}
