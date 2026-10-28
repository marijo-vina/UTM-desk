import { fecha } from '../format.js'
import { Folio, Icono, InsigniaCategoria, InsigniaEstado, InsigniaPrioridad } from '../ui.jsx'

export default function TablaIncidencias({ items, mostrarReportante = false, onVer }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead>
          <tr className="border-b border-linea text-[0.68rem] tracking-wider text-suave uppercase">
            <th className="px-4 py-3 font-semibold">Folio</th>
            <th className="px-4 py-3 font-semibold">Título</th>
            <th className="px-4 py-3 font-semibold">Categoría</th>
            <th className="px-4 py-3 font-semibold">Prioridad</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">{mostrarReportante ? 'Reportante / técnico' : 'Técnico'}</th>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((incidencia) => (
            <tr key={incidencia.codigo} className="border-b border-linea/70 transition last:border-0 hover:bg-brand-50/50">
              <td className="px-4 py-3.5 align-top">
                <Folio codigo={incidencia.codigo} />
              </td>
              <td className="max-w-xs px-4 py-3.5 align-top">
                <p className="truncate font-semibold">{incidencia.titulo}</p>
                <p className="mt-0.5 truncate text-xs text-suave">
                  {incidencia.ubicacion?.edificio} · {incidencia.ubicacion?.aula_o_zona}
                </p>
              </td>
              <td className="px-4 py-3.5 align-top">
                <InsigniaCategoria categoria={incidencia.categoria} />
              </td>
              <td className="px-4 py-3.5 align-top">
                <InsigniaPrioridad prioridad={incidencia.prioridad} />
              </td>
              <td className="px-4 py-3.5 align-top">
                <InsigniaEstado estado={incidencia.estado} />
              </td>
              <td className="px-4 py-3.5 align-top text-xs text-suave">
                {mostrarReportante && incidencia.reportante?.nombre && <p className="font-medium text-tinta">{incidencia.reportante.nombre}</p>}
                <p>{incidencia.tecnico_nombre || incidencia.tecnico_asignado || 'Sin asignar'}</p>
              </td>
              <td className="px-4 py-3.5 align-top text-xs whitespace-nowrap text-suave">{fecha(incidencia.fecha_creacion)}</td>
              <td className="px-4 py-3.5 text-right align-top">
                {onVer ? (
                  <button
                    type="button"
                    onClick={() => onVer(incidencia)}
                    className="boton boton-secundario px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                  >
                    <Icono nombre="eye" className="size-3.5" /> Ver
                  </button>
                ) : (
                  <a href={`#/incidencias/${encodeURIComponent(incidencia.codigo)}`} className="boton boton-secundario px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
                    <Icono nombre="eye" className="size-3.5" /> Ver
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
