"use strict";

const EMAIL_UTM = "^[a-z0-9._%+-]+@utm\\.mx$";
const FOLIO = "^INC-[0-9]{8}-(CR|IN|AC)-[0-9]{4}$";
const IPV4 =
  "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$";
const TAG = "^[a-z0-9-]{2,30}$";
const AUTOR_BITACORA = "^(sistema|[a-z0-9._%+-]+@utm\\.mx)$";
const RUTA_EVIDENCIA =
  "^evidencias/[0-9]{4}/[0-9]{2}/[0-9]{2}/INC-[0-9]{8}-(CR|IN|AC)-[0-9]{4}/.+$";

const ESTADOS = ["abierta", "en_proceso", "en_espera", "resuelta", "cerrada"];
const PRIORIDADES = ["baja", "media", "alta", "critica"];
const CATEGORIAS = ["computo_redes", "infraestructura", "academico"];
const ROLES = ["reportante", "tecnico", "soporte", "coordinador", "directivo"];
const PERFILES = ["docente", "estudiante", "administrativo"];
const TIPOS_DANO = [
  "filtracion",
  "electrica",
  "hidraulica",
  "estructural",
  "climatizacion",
  "mobiliario",
  "iluminacion",
  "plaga",
  "otro",
];
const TIPOS_FALLA = [
  "error_actas",
  "acceso",
  "disponibilidad",
  "calificaciones",
  "aula_virtual",
  "correo_institucional",
  "otro",
];
const ENTERO = ["int", "long", "double"];
const NUMERO = ["int", "long", "double"];

const reportante = {
  bsonType: "object",
  additionalProperties: false,
  required: ["usuario_id", "nombre", "perfil", "correo"],
  properties: {
    usuario_id: { bsonType: "objectId" },
    nombre: { bsonType: "string", minLength: 3, maxLength: 120 },
    perfil: { enum: PERFILES },
    correo: { bsonType: "string", pattern: EMAIL_UTM },
  },
};

const ubicacion = {
  bsonType: "object",
  additionalProperties: false,
  required: ["edificio", "aula_o_zona"],
  properties: {
    edificio: { bsonType: "string", minLength: 3, maxLength: 80 },
    aula_o_zona: { bsonType: "string", minLength: 2, maxLength: 80 },
  },
};

const historialItem = {
  bsonType: "object",
  additionalProperties: false,
  required: ["fecha", "autor", "estado_resultante", "comentario", "horas_registradas"],
  properties: {
    fecha: { bsonType: "date" },
    autor: { bsonType: "string", pattern: AUTOR_BITACORA },
    estado_resultante: { enum: ESTADOS },
    comentario: { bsonType: "string", minLength: 1, maxLength: 500 },
    horas_registradas: { bsonType: NUMERO, minimum: 0, maximum: 24 },
  },
};

const evidenciaItem = {
  bsonType: "object",
  additionalProperties: false,
  required: ["nombre_archivo", "tipo_mime", "peso_kb", "url_storage", "fecha_carga"],
  properties: {
    nombre_archivo: { bsonType: "string", minLength: 5, maxLength: 120 },
    tipo_mime: { enum: ["image/jpeg", "image/png", "application/pdf"] },
    peso_kb: { bsonType: ENTERO, minimum: 1, maximum: 5120 },
    url_storage: { bsonType: "string", pattern: RUTA_EVIDENCIA },
    fecha_carga: { bsonType: "date" },
  },
};

const detalleComputo = {
  bsonType: "object",
  additionalProperties: false,
  required: ["direccion_ip", "vlan", "puerto_uplink", "equipos_afectados"],
  properties: {
    direccion_ip: { bsonType: "string", pattern: IPV4 },
    vlan: { bsonType: ENTERO, minimum: 1, maximum: 4094 },
    puerto_uplink: { bsonType: "string", minLength: 2, maxLength: 40 },
    equipos_afectados: { bsonType: ENTERO, minimum: 1, maximum: 500 },
    dispositivo: { bsonType: "string", minLength: 2, maxLength: 120 },
    ssid_o_segmento: { bsonType: "string", minLength: 2, maxLength: 80 },
  },
};

const detalleInfraestructura = {
  bsonType: "object",
  additionalProperties: false,
  required: ["tipo_dano", "riesgo_seguridad", "requiere_insumos", "contratista_externo"],
  properties: {
    tipo_dano: { enum: TIPOS_DANO },
    riesgo_seguridad: { bsonType: "bool" },
    requiere_insumos: { bsonType: "bool" },
    contratista_externo: { bsonType: "bool" },
    insumos: {
      bsonType: "array",
      minItems: 1,
      maxItems: 20,
      items: { bsonType: "string", minLength: 2, maxLength: 60 },
    },
    nombre_contratista: { bsonType: "string", minLength: 3, maxLength: 120 },
  },
  allOf: [
    {
      oneOf: [
        {
          properties: { requiere_insumos: { enum: [true] } },
          required: ["insumos"],
        },
        {
          properties: { requiere_insumos: { enum: [false] } },
          not: { required: ["insumos"] },
        },
      ],
    },
    {
      oneOf: [
        {
          properties: { contratista_externo: { enum: [true] } },
          required: ["nombre_contratista"],
        },
        {
          properties: { contratista_externo: { enum: [false] } },
          not: { required: ["nombre_contratista"] },
        },
      ],
    },
  ],
};

const detalleAcademico = {
  bsonType: "object",
  additionalProperties: false,
  required: ["plataforma", "periodo_escolar", "estudiantes_impactados"],
  properties: {
    plataforma: { bsonType: "string", minLength: 3, maxLength: 80 },
    periodo_escolar: { bsonType: "string", pattern: "^20[0-9]{2}-[123]$" },
    estudiantes_impactados: { bsonType: ENTERO, minimum: 1, maximum: 5000 },
    codigo_curso: { bsonType: "string", pattern: "^[A-Z]{2,6}-[0-9]{3}$" },
    tipo_falla: { enum: TIPOS_FALLA },
  },
};

const usuarios = {
  $jsonSchema: {
    bsonType: "object",
    additionalProperties: false,
    required: ["correo", "password_hash", "nombre", "rol", "activo"],
    properties: {
      _id: { bsonType: "objectId" },
      correo: { bsonType: "string", pattern: EMAIL_UTM },
      password_hash: {
        bsonType: "string",
        pattern: "^pbkdf2\\$sha256\\$120000\\$.+$",
      },
      nombre: { bsonType: "string", minLength: 3, maxLength: 120 },
      rol: { enum: ROLES },
      activo: { bsonType: "bool" },
    },
  },
};

const incidenciasCampus = {
  $jsonSchema: {
    bsonType: "object",
    additionalProperties: false,
    required: [
      "codigo",
      "titulo",
      "descripcion",
      "categoria",
      "prioridad",
      "estado",
      "reportante",
      "ubicacion",
      "detalle_especifico",
      "tags",
      "historial_seguimiento",
      "evidencias_adjuntas",
      "horas_invertidas",
      "fecha_creacion",
      "fecha_actualizacion",
    ],
    properties: {
      _id: { bsonType: "objectId" },
      codigo: { bsonType: "string", pattern: FOLIO },
      titulo: { bsonType: "string", minLength: 8, maxLength: 160 },
      descripcion: { bsonType: "string", minLength: 16, maxLength: 2000 },
      categoria: { enum: CATEGORIAS },
      prioridad: { enum: PRIORIDADES },
      estado: { enum: ESTADOS },
      reportante,
      ubicacion,
      detalle_especifico: { bsonType: "object" },
      tags: {
        bsonType: "array",
        minItems: 1,
        maxItems: 15,
        uniqueItems: true,
        items: { bsonType: "string", pattern: TAG },
      },
      historial_seguimiento: {
        bsonType: "array",
        minItems: 1,
        maxItems: 200,
        items: historialItem,
      },
      evidencias_adjuntas: {
        bsonType: "array",
        maxItems: 20,
        items: evidenciaItem,
      },
      horas_invertidas: { bsonType: NUMERO, minimum: 0, maximum: 400 },
      fecha_creacion: { bsonType: "date" },
      fecha_actualizacion: { bsonType: "date" },
      fecha_resolucion: { bsonType: "date" },
      tecnico_asignado: { bsonType: "string", pattern: EMAIL_UTM },
    },
    allOf: [
      {
        oneOf: [
          {
            properties: {
              categoria: { enum: ["computo_redes"] },
              codigo: { pattern: "^INC-[0-9]{8}-CR-[0-9]{4}$" },
              detalle_especifico: detalleComputo,
            },
          },
          {
            properties: {
              categoria: { enum: ["infraestructura"] },
              codigo: { pattern: "^INC-[0-9]{8}-IN-[0-9]{4}$" },
              detalle_especifico: detalleInfraestructura,
            },
          },
          {
            properties: {
              categoria: { enum: ["academico"] },
              codigo: { pattern: "^INC-[0-9]{8}-AC-[0-9]{4}$" },
              detalle_especifico: detalleAcademico,
            },
          },
        ],
      },
      {
        oneOf: [
          {
            properties: {
              estado: { enum: ["abierta", "en_proceso", "en_espera"] },
            },
            not: { required: ["fecha_resolucion"] },
          },
          {
            properties: {
              estado: { enum: ["resuelta", "cerrada"] },
            },
            required: ["fecha_resolucion"],
          },
        ],
      },
    ],
  },
};

const collectionOptions = {
  validationLevel: "strict",
  validationAction: "error",
};

module.exports = {
  EMAIL_UTM,
  ESTADOS,
  PRIORIDADES,
  CATEGORIAS,
  ROLES,
  PERFILES,
  TIPOS_DANO,
  TIPOS_FALLA,
  usuarios,
  incidenciasCampus,
  collectionOptions,
};
