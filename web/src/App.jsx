import { useAuth } from './auth.jsx'
import Analitica from './pages/Analitica.jsx'
import Detalle from './pages/Detalle.jsx'
import Incidencias from './pages/Incidencias.jsx'
import Inicio from './pages/Inicio.jsx'
import Login from './pages/Login.jsx'
import NuevaIncidencia from './pages/NuevaIncidencia.jsx'
import { useRuta } from './router.js'
import Shell, { rutaPermitida } from './Shell.jsx'
import { NoAutorizado } from './ui.jsx'

const TITULOS = {
  inicio: 'Panel de operaciones',
  incidencias: 'Incidencias',
  nueva: 'Nueva incidencia',
  analitica: 'Analítica y reportes',
}

export default function App() {
  const { usuario } = useAuth()
  const { partes } = useRuta()

  if (!usuario) return <Login />

  const clave = partes[0] ?? 'inicio'
  const conocida = clave in TITULOS
  const permitida = conocida && rutaPermitida(clave, usuario.rol)

  let pantalla = <NoAutorizado />
  if (!conocida) pantalla = <Inicio />
  else if (permitida) {
    if (clave === 'inicio') pantalla = <Inicio />
    else if (clave === 'incidencias') pantalla = partes[1] ? <Detalle key={partes[1]} codigo={partes[1]} /> : <Incidencias />
    else if (clave === 'nueva') pantalla = <NuevaIncidencia />
    else pantalla = <Analitica />
  }

  return (
    <Shell actual={conocida ? clave : 'inicio'} titulo={TITULOS[clave] ?? TITULOS.inicio}>
      {pantalla}
    </Shell>
  )
}
