import { useEffect, useState } from 'react'

/** Carga datos reales de la API; expone recargar() y descarta respuestas obsoletas. */
export function useCarga(funcion, dependencias) {
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    setEstado((previo) => ({ ...previo, cargando: true, error: null }))
    funcion()
      .then((datos) => vigente && setEstado({ cargando: false, datos, error: null }))
      .catch((error) => vigente && setEstado({ cargando: false, datos: null, error }))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, version])

  return { ...estado, recargar: () => setVersion((valor) => valor + 1) }
}

export function useRetraso(valor, milisegundos = 350) {
  const [retrasado, setRetrasado] = useState(valor)
  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(valor), milisegundos)
    return () => clearTimeout(temporizador)
  }, [valor, milisegundos])
  return retrasado
}
