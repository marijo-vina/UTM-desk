import { useState } from 'react'
import { useAuth } from '../auth.jsx'
import { registrarIncidencia, subirEvidencia } from '../api.js'
import { CATEGORIAS, EDIFICIOS, ETIQUETAS_DETALLE, PRIORIDADES, ROLES, valorDetalle } from '../format.js'
import { Alerta, Icono, InsigniaCategoria, InsigniaPrioridad } from '../ui.jsx'

const PISOS = ['Planta Baja', 'Piso 1', 'Piso 2', 'Piso 3', 'Azotea']

const INICIAL = {
  categoria: 'computo_redes',
  titulo: 'Pérdida de conectividad intermitente y caída de VLAN académica',
  descripcion: 'Los equipos pierden red periódicamente durante las sesiones de laboratorio en el segmento asignado.',
  prioridad: 'alta',
  edificio: 'Edificio B',
  piso: 'Piso 2',
  aula: 'Laboratorio B-204 (Cómputo en la Nube)',
  direccion_ip: '10.20.15.44',
  vlan: '120',
  puerto_uplink: 'Gi0/24 - Switch Core B',
  equipos_afectados: '18',
  dispositivo: 'AP Cisco Catalyst 9115AX',
  ssid_o_segmento: 'UTM-Lab-B',
  tipo_dano: 'filtracion',
  riesgo_seguridad: true,
  requiere_insumos: true,
  insumos: 'sellador, lámina',
  contratista_externo: false,
  nombre_contratista: '',
  plataforma: 'Portal de calificaciones',
  periodo_escolar: '2026-1',
  estudiantes_impactados: '35',
  codigo_curso: 'BDN-402',
  tipo_falla: 'error_actas',
  tags: ['wifi', 'laboratorio', 'vlan'],
}

const PASOS = ['Categoría & Datos', 'Evidencias', 'Confirmación']
const PATRON_TAG = /^[a-z0-9áéíóúüñ-]{2,30}$/
const TIPOS_ARCHIVO = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const LIMITE_ARCHIVO = 4 * 1024 * 1024
const ETIQUETA_MIME = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'application/pdf': 'PDF',
}
const entero = (valor) => /^\d+$/.test(String(valor).trim())
const largo = (valor) => String(valor).trim().length

function pesoLegible(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const SLA_PRIORIDAD = {
  baja: 'Atención inicial < 24 horas, resolución < 72 horas hábiles.',
  media: 'Atención inicial < 8 horas, resolución < 24 horas hábiles.',
  alta: 'Atención inicial < 2 horas, resolución < 8 horas hábiles.',
  critica: 'Atención inmediata (< 30 min), resolución urgente prioritaria de infraestructura central.',
}

function listaInsumos(texto) {
  return texto
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function validarPaso1(f) {
  const e = {}
  if (largo(f.titulo) < 3 || largo(f.titulo) > 160) e.titulo = 'El título debe tener entre 3 y 160 caracteres.'
  if (largo(f.descripcion) < 3 || largo(f.descripcion) > 4000) e.descripcion = 'La descripción debe tener entre 3 y 4000 caracteres.'
  if (!f.edificio) e.edificio = 'Selecciona un edificio.'
  if (largo(f.aula) < 1 || largo(f.aula) > 80) e.aula = 'Indica el aula o zona (máximo 80 caracteres).'

  if (f.categoria === 'computo_redes') {
    if (largo(f.direccion_ip) < 1 || largo(f.direccion_ip) > 64) e.direccion_ip = 'Indica la dirección IP.'
    if (!entero(f.vlan) || Number(f.vlan) > 4094) e.vlan = 'La VLAN debe ser un entero entre 0 y 4094.'
    if (largo(f.puerto_uplink) < 1 || largo(f.puerto_uplink) > 40) e.puerto_uplink = 'Indica el puerto uplink.'
    if (!entero(f.equipos_afectados)) e.equipos_afectados = 'Indica un entero (0 o más).'
  } else if (f.categoria === 'infraestructura') {
    if (largo(f.tipo_dano) < 1 || largo(f.tipo_dano) > 160) e.tipo_dano = 'Indica el tipo de daño.'
    if (f.requiere_insumos && !listaInsumos(f.insumos).length) e.insumos = 'Enumera al menos un insumo.'
    if (f.contratista_externo && largo(f.nombre_contratista) < 1) e.nombre_contratista = 'Indica el contratista.'
  } else {
    if (largo(f.plataforma) < 1 || largo(f.plataforma) > 160) e.plataforma = 'Indica la plataforma afectada.'
    if (largo(f.periodo_escolar) < 1 || largo(f.periodo_escolar) > 20) e.periodo_escolar = 'Indica el periodo escolar.'
    if (!entero(f.estudiantes_impactados)) e.estudiantes_impactados = 'Indica un número entero.'
  }
  return e
}

function detalleDe(f) {
  const texto = (campo) => String(f[campo] ?? '').trim()
  const agregarOpcionales = (detalle, campos) => {
    for (const campo of campos) if (texto(campo)) detalle[campo] = texto(campo)
    return detalle
  }
  if (f.categoria === 'computo_redes') {
    return agregarOpcionales(
      {
        direccion_ip: texto('direccion_ip'),
        vlan: Number(f.vlan),
        puerto_uplink: texto('puerto_uplink'),
        equipos_afectados: Number(f.equipos_afectados),
      },
      ['dispositivo', 'ssid_o_segmento'],
    )
  }
  if (f.categoria === 'infraestructura') {
    const detalle = {
      tipo_dano: texto('tipo_dano'),
      riesgo_seguridad: Boolean(f.riesgo_seguridad),
      requiere_insumos: Boolean(f.requiere_insumos),
      contratista_externo: Boolean(f.contratista_externo),
    }
    if (f.requiere_insumos) detalle.insumos = listaInsumos(f.insumos)
    if (f.contratista_externo) detalle.nombre_contratista = texto('nombre_contratista')
    return detalle
  }
  return agregarOpcionales(
    {
      plataforma: texto('plataforma'),
      periodo_escolar: texto('periodo_escolar'),
      estudiantes_impactados: Number(f.estudiantes_impactados),
    },
    ['codigo_curso', 'tipo_falla'],
  )
}

function cuerpoDe(f) {
  const cuerpo = {
    titulo: f.titulo.trim(),
    descripcion: f.descripcion.trim(),
    categoria: f.categoria,
    prioridad: f.prioridad,
    ubicacion: {
      edificio: f.edificio,
      aula_o_zona: f.piso ? `${f.aula.trim()} (${f.piso})` : f.aula.trim(),
    },
    detalle_especifico: detalleDe(f),
  }
  if (f.tags.length) cuerpo.tags = f.tags
  return cuerpo
}

export default function NuevaIncidencia() {
  const { usuario } = useAuth()
  const [f, setF] = useState(INICIAL)
  const [paso, setPaso] = useState(1)
  const [errores, setErrores] = useState({})
  const [etiqueta, setEtiqueta] = useState('')
  const [errorEtiqueta, setErrorEtiqueta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorApi, setErrorApi] = useState(null)
  const [creada, setCreada] = useState(null)
  const [archivos, setArchivos] = useState([])
  const [avisoArchivo, setAvisoArchivo] = useState('')
  const [arrastrando, setArrastrando] = useState(false)
  const [avisoEvidencias, setAvisoEvidencias] = useState('')

  const poner = (campo, valor) => {
    setF((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => (actual[campo] ? { ...actual, [campo]: undefined } : actual))
  }

  function avanzar() {
    if (paso === 1) {
      const e = validarPaso1(f)
      setErrores(e)
      if (Object.values(e).some(Boolean)) return
    }
    setPaso((actual) => actual + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function agregarEtiqueta() {
    const tag = etiqueta.trim().toLowerCase()
    if (!tag) return
    if (!PATRON_TAG.test(tag)) {
      setErrorEtiqueta('Usa letras minúsculas, números o guion (2-30 car).')
      return
    }
    if (f.tags.includes(tag)) {
      setErrorEtiqueta('Esa etiqueta ya está agregada.')
      return
    }
    setErrorEtiqueta('')
    setEtiqueta('')
    setF((actual) => ({ ...actual, tags: [...actual.tags, tag] }))
  }

  function agregarArchivos(lista) {
    const entrantes = [...(lista ?? [])]
    if (!entrantes.length) return
    const aceptados = []
    const rechazos = []
    for (const file of entrantes) {
      if (!TIPOS_ARCHIVO.has(file.type)) {
        rechazos.push(`${file.name} no es JPEG, PNG ni PDF.`)
        continue
      }
      if (file.size === 0) {
        rechazos.push(`${file.name} está vacío.`)
        continue
      }
      if (file.size > LIMITE_ARCHIVO) {
        rechazos.push(`${file.name} supera 4 MB.`)
        continue
      }
      aceptados.push({
        id: `${file.name}:${file.size}:${file.lastModified}`,
        file,
        nombre: file.name,
        tipo: file.type,
        bytes: file.size,
      })
    }
    if (aceptados.length) {
      setArchivos((actual) => {
        const ids = new Set(actual.map((item) => item.id))
        return [...actual, ...aceptados.filter((item) => !ids.has(item.id))]
      })
    }
    setAvisoArchivo(rechazos.join(' '))
  }

  function quitarArchivo(id) {
    setArchivos((actual) => actual.filter((item) => item.id !== id))
  }

  async function enviar() {
    if (enviando) return
    const problemas = validarPaso1(f)
    if (Object.values(problemas).some(Boolean)) {
      setErrores(problemas)
      setPaso(1)
      return
    }
    setEnviando(true)
    setErrorApi(null)
    try {
      const res = await registrarIncidencia(cuerpoDe(f))
      const fallos = []
      for (const item of archivos) {
        try {
          await subirEvidencia(res.codigo, item.file)
        } catch (causa) {
          fallos.push(`${item.nombre}: ${causa.message}`)
        }
      }
      setAvisoEvidencias(fallos.join(' '))
      setCreada(res)
    } catch (causa) {
      setErrorApi(causa)
    } finally {
      setEnviando(false)
    }
  }

  function reiniciar() {
    setF(INICIAL)
    setPaso(1)
    setErrores({})
    setErrorApi(null)
    setCreada(null)
    setArchivos([])
    setAvisoArchivo('')
    setAvisoEvidencias('')
  }

  if (creada) {
    return (
      <div className="mx-auto max-w-xl animate-aparece py-6">
        <div className="tarjeta p-8 text-center shadow-lg">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
            <Icono nombre="check" className="size-8 stroke-[2.5]" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Incidencia Registrada Exitosamente</h1>
          <p className="mt-2 text-sm text-slate-500">
            Tu reporte ha sido asignado al clúster operativo en estado <span className="font-semibold text-brand-600">Abierta</span>.
          </p>
          <div className="mx-auto mt-6 w-fit rounded-2xl border border-dashed border-brand-400 bg-brand-50/70 px-8 py-4">
            <p className="text-[0.68rem] font-bold tracking-widest text-brand-700 uppercase">Folio de Rastreo NoSQL</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-brand-900">{creada.codigo}</p>
          </div>
          {avisoEvidencias && (
            <div className="mt-6 text-left">
              <Alerta>
                <p className="font-semibold">La incidencia quedó registrada, pero no se pudieron adjuntar todas las evidencias.</p>
                <p className="mt-1">{avisoEvidencias}</p>
              </Alerta>
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={`#/incidencias/${encodeURIComponent(creada.codigo)}`} className="boton boton-primario">
              <Icono nombre="eye" /> Ver Expediente
            </a>
            <a href="#/incidencias" className="boton boton-secundario">
              Ir a Mis Incidencias
            </a>
            <button type="button" className="boton boton-secundario" onClick={reiniciar}>
              Registrar Otra
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 animate-aparece">
      {/* Encabezado contextual */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold tracking-widest text-slate-400 uppercase">
            Operaciones &gt; Asistente NoSQL
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Registrar Nueva Incidencia
          </h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Captura el incidente con metadatos contextuales para el enrutamiento inteligente del clúster.
          </p>
        </div>

        {usuario && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 shadow-xs">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
              {usuario.nombre ? usuario.nombre[0] : 'U'}
            </span>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800">{usuario.nombre}</p>
              <p className="text-[0.65rem] text-slate-500">
                Gestión Activa UTM · {ROLES[usuario.rol] ?? usuario.rol}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Barra Stepper */}
      <div className="tarjeta p-4 sm:p-5">
        <ol className="flex items-center justify-between" aria-label="Progreso">
          {PASOS.map((nombre, indice) => {
            const num = indice + 1
            const hecho = num < paso
            const activo = num === paso
            return (
              <li key={nombre} className="flex flex-1 items-center last:flex-none">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid size-8 place-items-center rounded-full text-xs font-bold transition ${
                      hecho
                        ? 'bg-emerald-500 text-white'
                        : activo
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {hecho ? <Icono nombre="check" className="size-4 stroke-[3]" /> : num}
                  </span>
                  <span
                    className={`text-xs font-semibold sm:text-sm ${
                      activo ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {nombre}
                  </span>
                </div>
                {num < PASOS.length && (
                  <div className={`mx-4 h-0.5 flex-1 rounded ${hecho ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </li>
            )
          })}
        </ol>
      </div>

      {/* Contenido del Wizard */}
      <div className="tarjeta p-6 sm:p-8">
        {paso === 1 && (
          <div className="grid gap-7">
            {/* Sección 1: Definición General */}
            <div className="border-b border-slate-100 pb-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="text-brand-600 font-mono">99</span> Definición General
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold text-slate-500 uppercase">
                  Paso 1 de 3
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="nueva-titulo" className="font-semibold text-slate-700">
                    Título o Asunto de la Incidencia <span className="text-red-500">*</span>
                  </label>
                  <span className="text-slate-400">Sé específico para acelerar la asignación técnica</span>
                </div>
                <input
                  id="nueva-titulo"
                  className="campo mt-1.5"
                  placeholder="Ej. Pérdida de conectividad intermitente y caída de VLAN académica"
                  value={f.titulo}
                  onChange={(e) => poner('titulo', e.target.value)}
                />
                {errores.titulo && <p className="mt-1 text-xs text-red-500">{errores.titulo}</p>}
              </div>

              <div className="mt-4">
                <label htmlFor="nueva-descripcion" className="block text-xs font-semibold text-slate-700">
                  Descripción Detallada <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="nueva-descripcion"
                  rows={3}
                  className="campo mt-1.5"
                  placeholder="Describe qué ocurre, desde cuándo y qué impacto tiene..."
                  value={f.descripcion}
                  onChange={(e) => poner('descripcion', e.target.value)}
                />
                {errores.descripcion && <p className="mt-1 text-xs text-red-500">{errores.descripcion}</p>}
              </div>

              {/* Clasificación de Área UTM (3 cards) */}
              <div className="mt-6">
                <p className="text-xs font-semibold text-slate-700">
                  Clasificación de Área UTM <span className="text-red-500">*</span>{' '}
                  <span className="font-normal text-slate-400">(Activa el esquema NoSQL correspondiente)</span>
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {/* Cómputo & Telecom */}
                  <button
                    type="button"
                    onClick={() => poner('categoria', 'computo_redes')}
                    className={`relative rounded-2xl border p-4 text-left transition ${
                      f.categoria === 'computo_redes'
                        ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
                        <Icono nombre="wifi" className="size-5" />
                      </span>
                      {f.categoria === 'computo_redes' && (
                        <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                          <Icono nombre="check" className="size-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">Cómputo &amp; Telecom</p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-500">
                      Switches, Access Points, cableado estructurado, IPs, DNS y servidores UTM.
                    </p>
                  </button>

                  {/* Infraestructura Física */}
                  <button
                    type="button"
                    onClick={() => poner('categoria', 'infraestructura')}
                    className={`relative rounded-2xl border p-4 text-left transition ${
                      f.categoria === 'infraestructura'
                        ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-xl bg-teal-600 text-white shadow-sm">
                        <Icono nombre="building" className="size-5" />
                      </span>
                      {f.categoria === 'infraestructura' && (
                        <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                          <Icono nombre="check" className="size-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">Infraestructura Física</p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-500">
                      Climatización, luminarias, daños de obra civil, filtraciones y subestación.
                    </p>
                  </button>

                  {/* Sistemas Académicos */}
                  <button
                    type="button"
                    onClick={() => poner('categoria', 'academico')}
                    className={`relative rounded-2xl border p-4 text-left transition ${
                      f.categoria === 'academico'
                        ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
                        <Icono nombre="book" className="size-5" />
                      </span>
                      {f.categoria === 'academico' && (
                        <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                          <Icono nombre="check" className="size-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">Sistemas Académicos</p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-500">
                      Moodle UTM, actas de calificaciones, SIAU, reinscripciones y campus virtual.
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Sección 2: Sub-esquema NoSQL dinámico */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-brand-100 text-brand-700">
                    <Icono nombre="server" className="size-3.5" />
                  </span>
                  <h3 className="text-xs font-bold text-slate-800">
                    {f.categoria === 'computo_redes'
                      ? 'Parámetros de Red y Dispositivos de Telecomunicaciones'
                      : f.categoria === 'infraestructura'
                      ? 'Parámetros de Infraestructura y Mantenimiento Físico'
                      : 'Parámetros de Plataforma Académica y Gestión Estudiantil'}
                  </h3>
                </div>
                <span className="rounded-full bg-brand-100/80 px-2.5 py-0.5 text-[0.65rem] font-bold text-brand-800">
                  Sub-esquema NoSQL
                </span>
              </div>

              {/* Sub-esquema Cómputo */}
              {f.categoria === 'computo_redes' && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Dirección IP Afectada</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="10.20.15.44"
                      value={f.direccion_ip}
                      onChange={(e) => poner('direccion_ip', e.target.value)}
                    />
                    {errores.direccion_ip && <p className="mt-1 text-xs text-red-500">{errores.direccion_ip}</p>}
                  </div>

                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Identificador VLAN</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="120"
                      value={f.vlan}
                      onChange={(e) => poner('vlan', e.target.value)}
                    />
                    {errores.vlan && <p className="mt-1 text-xs text-red-500">{errores.vlan}</p>}
                  </div>

                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Puerto Uplink Switch</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="Gi0/24 - Switch Core B"
                      value={f.puerto_uplink}
                      onChange={(e) => poner('puerto_uplink', e.target.value)}
                    />
                    {errores.puerto_uplink && <p className="mt-1 text-xs text-red-500">{errores.puerto_uplink}</p>}
                  </div>

                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Equipos / Nodos Afectados</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="18"
                      value={f.equipos_afectados}
                      onChange={(e) => poner('equipos_afectados', e.target.value)}
                    />
                    {errores.equipos_afectados && (
                      <p className="mt-1 text-xs text-red-500">{errores.equipos_afectados}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Dispositivo de Red</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="AP Cisco Catalyst 9115AX"
                      value={f.dispositivo}
                      onChange={(e) => poner('dispositivo', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">SSID Inalámbrico</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="UTM-Lab-B"
                      value={f.ssid_o_segmento}
                      onChange={(e) => poner('ssid_o_segmento', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Sub-esquema Infraestructura */}
              {f.categoria === 'infraestructura' && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Tipo de Daño</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="Filtración, luminaria, etc."
                      value={f.tipo_dano}
                      onChange={(e) => poner('tipo_dano', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Insumos Requeridos</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="sellador, lámina..."
                      value={f.insumos}
                      onChange={(e) => poner('insumos', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Nombre del Contratista</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="Si aplica contratista externo"
                      value={f.nombre_contratista}
                      onChange={(e) => poner('nombre_contratista', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Sub-esquema Académico */}
              {f.categoria === 'academico' && (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Plataforma Afectada</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="Portal de calificaciones, Moodle..."
                      value={f.plataforma}
                      onChange={(e) => poner('plataforma', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Periodo Escolar</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="2026-1"
                      value={f.periodo_escolar}
                      onChange={(e) => poner('periodo_escolar', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Estudiantes Impactados</label>
                    <input
                      className="campo mt-1 text-xs"
                      placeholder="35"
                      value={f.estudiantes_impactados}
                      onChange={(e) => poner('estudiantes_impactados', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sección 3: Localización y Prioridad */}
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              {/* Localización en Campus UTM */}
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-teal-50 text-teal-700">
                    <Icono nombre="building" className="size-3.5" />
                  </span>
                  <h3 className="text-xs font-bold text-slate-800">Localización en Campus UTM</h3>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Edificio Universitario</label>
                    <select
                      className="campo mt-1 text-xs"
                      value={f.edificio}
                      onChange={(e) => poner('edificio', e.target.value)}
                    >
                      <option value="">Selecciona edificio...</option>
                      {EDIFICIOS.map((ed) => (
                        <option key={ed} value={ed}>
                          {ed}
                        </option>
                      ))}
                    </select>
                    {errores.edificio && <p className="mt-1 text-xs text-red-500">{errores.edificio}</p>}
                  </div>

                  <div>
                    <label className="block text-[0.72rem] font-semibold text-slate-600">Nivel / Piso</label>
                    <select
                      className="campo mt-1 text-xs"
                      value={f.piso}
                      onChange={(e) => poner('piso', e.target.value)}
                    >
                      {PISOS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-[0.72rem] font-semibold text-slate-600">Aula o Zona Específica</label>
                  <input
                    className="campo mt-1 text-xs"
                    placeholder="Laboratorio B-204 (Cómputo en la Nube)"
                    value={f.aula}
                    onChange={(e) => poner('aula', e.target.value)}
                  />
                  {errores.aula && <p className="mt-1 text-xs text-red-500">{errores.aula}</p>}
                </div>
              </div>

              {/* Nivel de Prioridad del Ticket */}
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-orange-50 text-orange-700">
                    <Icono nombre="alert" className="size-3.5" />
                  </span>
                  <h3 className="text-xs font-bold text-slate-800">! Nivel de Prioridad del Ticket</h3>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {Object.entries(PRIORIDADES).map(([clave, etiquetaP]) => {
                    const activa = f.prioridad === clave
                    const puntos = {
                      baja: 'bg-slate-400',
                      media: 'bg-blue-500',
                      alta: 'bg-orange-500',
                      critica: 'bg-red-500',
                    }
                    return (
                      <button
                        key={clave}
                        type="button"
                        onClick={() => poner('prioridad', clave)}
                        className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-semibold transition ${
                          activa
                            ? 'border-brand-500 bg-white ring-2 ring-brand-500/20 shadow-xs'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                        }`}
                      >
                        <span
                          className={`size-2.5 rounded-full ${puntos[clave]} ${
                            clave === 'critica' && activa ? 'animate-pulse' : ''
                          }`}
                        />
                        <span>{etiquetaP}</span>
                        {activa && <Icono nombre="check" className="ml-auto size-3 text-brand-600 stroke-[3]" />}
                      </button>
                    )
                  })}
                </div>

                {/* SLA Box */}
                <div className="mt-3.5 rounded-xl bg-slate-50 p-3 text-[0.7rem] text-slate-600">
                  <span className="font-bold text-slate-800">
                    SLA Estimado para {PRIORIDADES[f.prioridad]}:
                  </span>{' '}
                  {SLA_PRIORIDAD[f.prioridad]}
                </div>
              </div>
            </div>

            {/* Botón Siguiente */}
            <div className="flex justify-end pt-3">
              <button
                type="button"
                id="nueva-continuar"
                onClick={avanzar}
                className="boton boton-primario px-6 py-2.5 text-sm"
              >
                Continuar a Evidencias <Icono nombre="right" className="size-4" />
              </button>
            </div>
          </div>
        )}

        {paso === 2 && (
          <div className="grid gap-6">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Documentación y Evidencias Adjuntas</h2>
              <p className="mt-1 text-xs text-slate-500">
                Puedes adjuntar capturas de pantalla, archivos de configuración o reportes en PDF.
              </p>

              {/* Upload Dropzone */}
              <div
                onDragEnter={(e) => {
                  e.preventDefault()
                  setArrastrando(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setArrastrando(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  if (!e.currentTarget.contains(e.relatedTarget)) setArrastrando(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setArrastrando(false)
                  agregarArchivos(e.dataTransfer.files)
                }}
                className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  arrastrando
                    ? 'border-brand-500 bg-brand-50/50'
                    : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/20'
                }`}
              >
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <Icono nombre="clip" className="size-6" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  Arrastra evidencias aquí o haz clic para seleccionar
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Formatos admitidos: JPEG, PNG, PDF (Máximo 4 MB por archivo)
                </p>
                <input
                  type="file"
                  className="hidden"
                  id="evidencia-input"
                  multiple
                  accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                  onChange={(e) => {
                    agregarArchivos(e.target.files)
                    e.target.value = ''
                  }}
                />
                <label
                  htmlFor="evidencia-input"
                  className="boton boton-secundario mt-4 inline-flex cursor-pointer text-xs"
                >
                  Explorar Archivos
                </label>
              </div>
              {archivos.length > 0 && (
                <ul className="mt-3 grid gap-2">
                  {archivos.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-emerald-600">
                          <Icono nombre="check" className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">{item.nombre}</span>
                          <span className="block text-xs text-slate-500">
                            {ETIQUETA_MIME[item.tipo] ?? item.tipo} · {pesoLegible(item.bytes)} · listo para enviar
                          </span>
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarArchivo(item.id)}
                        className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600"
                        aria-label={`Quitar ${item.nombre}`}
                      >
                        <Icono nombre="x" className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {avisoArchivo && <p className="mt-2 text-xs text-red-600">{avisoArchivo}</p>}
            </div>

            {/* Etiquetas */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold text-slate-800">Etiquetas y Taxonomía de Búsqueda</h3>
              <p className="mt-1 text-[0.72rem] text-slate-500">
                Agrega etiquetas para catalogar este incidente en la analítica institucional.
              </p>

              <div className="mt-3 flex gap-2">
                <input
                  className="campo text-xs"
                  placeholder="ej. wifi, laboratorio, switch-poe"
                  value={etiqueta}
                  onChange={(e) => {
                    setEtiqueta(e.target.value)
                    setErrorEtiqueta('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      agregarEtiqueta()
                    }
                  }}
                />
                <button type="button" onClick={agregarEtiqueta} className="boton boton-secundario text-xs">
                  <Icono nombre="tag" className="size-3.5" /> Agregar
                </button>
              </div>
              {errorEtiqueta && <p className="mt-1 text-xs text-red-500">{errorEtiqueta}</p>}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-1.5 pl-3 text-xs font-medium text-slate-700"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => setF((act) => ({ ...act, tags: act.tags.filter((x) => x !== t) }))}
                      className="grid size-4 place-items-center rounded-full hover:bg-slate-200"
                    >
                      <Icono nombre="x" className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3">
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="boton boton-secundario px-4 py-2 text-xs font-semibold"
              >
                <Icono nombre="left" className="size-4" /> Volver a Datos
              </button>
              <button
                type="button"
                onClick={() => setPaso(3)}
                className="boton boton-primario px-6 py-2.5 text-sm"
              >
                Continuar a Confirmación <Icono nombre="right" className="size-4" />
              </button>
            </div>
          </div>
        )}

        {paso === 3 && (
          <div className="grid gap-6">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Confirmación y Expediente Previsto</h2>
              <p className="mt-1 text-xs text-slate-500">
                Verifica los datos capturados antes de emitir el folio al clúster de incidencias.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <InsigniaCategoria categoria={f.categoria} />
                    <InsigniaPrioridad prioridad={f.prioridad} />
                  </div>
                  <h3 className="mt-2 text-base font-bold text-slate-900">{f.titulo}</h3>
                  <p className="mt-1 text-xs text-slate-600">{f.descripcion}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaso(1)}
                  className="boton boton-secundario text-xs"
                >
                  Editar
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <p className="text-slate-400">Ubicación</p>
                  <p className="mt-0.5 font-bold text-slate-800">
                    {f.edificio} · {f.piso} · {f.aula}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Etiquetas registradas</p>
                  <p className="mt-0.5 font-mono text-slate-700">{f.tags.join(', ') || 'Sin etiquetas'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-slate-400">Evidencias adjuntas</p>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {archivos.length ? archivos.map((item) => item.nombre).join(', ') : 'Sin archivos'}
                  </p>
                </div>
              </div>

              {/* Detalle específico */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[0.68rem] font-bold tracking-wider text-slate-400 uppercase">
                  Parámetros NoSQL Específicos
                </p>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {Object.entries(detalleDe(f)).map(([k, val]) => (
                    <div key={k}>
                      <span className="text-slate-400">{ETIQUETAS_DETALLE[k] ?? k}:</span>{' '}
                      <span className="font-semibold text-slate-800">{valorDetalle(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {errorApi && (
              <Alerta>
                <p className="font-semibold">{errorApi.message}</p>
              </Alerta>
            )}

            <div className="flex items-center justify-between pt-3">
              <button
                type="button"
                onClick={() => setPaso(2)}
                className="boton boton-secundario px-4 py-2 text-xs font-semibold"
                disabled={enviando}
              >
                <Icono nombre="left" className="size-4" /> Volver a Evidencias
              </button>
              <button
                type="button"
                id="nueva-enviar"
                onClick={enviar}
                disabled={enviando}
                className="boton boton-primario px-7 py-2.5 text-sm shadow-lg shadow-brand-500/25"
              >
                {enviando ? 'Emitiendo Folio…' : 'Registrar Incidencia'}
                <Icono nombre="send" className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
