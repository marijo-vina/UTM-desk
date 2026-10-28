import { useMemo, useSyncExternalStore } from 'react'

const suscribir = (aviso) => {
  window.addEventListener('hashchange', aviso)
  return () => window.removeEventListener('hashchange', aviso)
}
const instantanea = () => window.location.hash

export function useRuta() {
  const hash = useSyncExternalStore(suscribir, instantanea)
  return useMemo(() => {
    const crudo = hash.replace(/^#\/?/, '')
    const [camino, consulta = ''] = crudo.split('?')
    const partes = camino
      .split('/')
      .filter(Boolean)
      .map((parte) => decodeURIComponent(parte))
    return { partes, consulta: new URLSearchParams(consulta) }
  }, [hash])
}

export function ir(ruta) {
  window.location.hash = `#/${ruta}`
}

export function enlace(ruta) {
  return `#/${ruta}`
}
