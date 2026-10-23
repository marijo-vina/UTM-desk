"use strict";

require("dotenv").config();

const path = require("path");
const { MongoClient } = require("mongodb");
const indexes = require("./schema/indexes");
const {
  usuarios: validatorUsuarios,
  incidenciasCampus,
  collectionOptions,
  CATEGORIAS,
  ESTADOS,
  ROLES,
} = require("./schema/validators");
const { usuarios, incidencias, PASSWORD_SEMILLA } = require("./seed/datos");

const DB_NAME = process.env.DB_NAME || "utm_desk";
const VERIFY_ONLY = process.argv.includes("--verify-only");

function buildUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const user = process.env.MONGO_USER;
  const pass = process.env.MONGO_PASS;
  const cluster = process.env.MONGO_CLUSTER;
  if (user && pass && cluster) {
    return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${cluster}/?retryWrites=true&w=majority&appName=utm-desk`;
  }
  return null;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function verifySeed() {
  const roles = new Set(usuarios.map((u) => u.rol));
  for (const rol of ROLES) {
    if (!roles.has(rol)) fail(`Falta un usuario con rol ${rol}`);
  }

  if (incidencias.length < 20 || incidencias.length > 30) {
    fail(`RNF-08 pide 20 a 30 incidencias; hay ${incidencias.length}`);
  }

  const edificios = new Set(incidencias.map((d) => d.ubicacion.edificio));
  if (edificios.size < 4) fail(`RNF-08 pide al menos 4 edificios; hay ${edificios.size}`);

  const categorias = new Set(incidencias.map((d) => d.categoria));
  for (const cat of CATEGORIAS) {
    if (!categorias.has(cat)) fail(`Falta la categoría ${cat}`);
  }

  const estados = new Set(incidencias.map((d) => d.estado));
  for (const est of ESTADOS) {
    if (!estados.has(est)) fail(`Falta el estado ${est}`);
  }

  const conResolucion = incidencias.filter((d) => d.fecha_resolucion);
  if (conResolucion.length < 8) {
    fail(`RNF-08 pide 8 o más con fecha_resolucion; hay ${conResolucion.length}`);
  }

  const conEvidencia = incidencias.filter((d) => d.evidencias_adjuntas.length > 0);
  if (conEvidencia.length < 15) {
    fail(`RNF-08 pide 15 o más con evidencia; hay ${conEvidencia.length}`);
  }

  const codigos = incidencias.map((d) => d.codigo);
  if (new Set(codigos).size !== codigos.length) fail("Hay folios duplicados");

  const catFolio = { computo_redes: "CR", infraestructura: "IN", academico: "AC" };
  for (const doc of incidencias) {
    const esperado = catFolio[doc.categoria];
    if (!doc.codigo.includes(`-${esperado}-`)) {
      fail(`${doc.codigo} no coincide con la categoría ${doc.categoria}`);
    }
    const cerrado = doc.estado === "resuelta" || doc.estado === "cerrada";
    if (cerrado && !doc.fecha_resolucion) fail(`${doc.codigo} cerrado sin fecha_resolucion`);
    if (!cerrado && doc.fecha_resolucion) fail(`${doc.codigo} abierto no debe llevar fecha_resolucion`);
  }

  return {
    usuarios: usuarios.length,
    incidencias: incidencias.length,
    edificios: [...edificios],
    conResolucion: conResolucion.length,
    conEvidencia: conEvidencia.length,
    roles: [...roles],
  };
}

async function createIndexes(col, defs) {
  for (const def of defs) {
    const options = { name: def.name };
    if (def.unique) options.unique = true;
    if (def.expireAfterSeconds !== undefined) options.expireAfterSeconds = def.expireAfterSeconds;
    if (def.weights) options.weights = def.weights;
    if (def.default_language) options.default_language = def.default_language;
    await col.createIndex(def.keys, options);
  }
}

async function apply() {
  const uri = buildUri();
  if (!uri) {
    fail(
      "Falta MONGO_URI o MONGO_USER/MONGO_PASS/MONGO_CLUSTER. Copia .env.example a .env y pega la cadena de Atlas."
    );
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    await db.collection("incidencias_campus").drop().catch(() => {});
    await db.collection("usuarios").drop().catch(() => {});

    await db.createCollection("usuarios", {
      validator: validatorUsuarios,
      ...collectionOptions,
    });
    await db.createCollection("incidencias_campus", {
      validator: incidenciasCampus,
      ...collectionOptions,
    });

    await createIndexes(db.collection("usuarios"), indexes.usuarios);
    await createIndexes(db.collection("incidencias_campus"), indexes.incidencias_campus);

    const rUsers = await db.collection("usuarios").insertMany(usuarios, { ordered: true });
    const rInc = await db.collection("incidencias_campus").insertMany(incidencias, { ordered: true });

    let rechazo = "no se pudo comprobar";
    try {
      await db.collection("incidencias_campus").insertOne({
        codigo: "MALFORMADO",
        titulo: "corto",
      });
      rechazo = "FALLÓ: Atlas aceptó un documento inválido";
    } catch (err) {
      rechazo = err.code === 121 || /validation/i.test(err.message)
        ? "correcto (código 121 / validación)"
        : `error inesperado: ${err.message}`;
    }

    const nUsers = await db.collection("usuarios").countDocuments();
    const nInc = await db.collection("incidencias_campus").countDocuments();
    const idxInc = await db.collection("incidencias_campus").indexes();
    const idxUsr = await db.collection("usuarios").indexes();

    return {
      db: DB_NAME,
      usuariosInsertados: rUsers.insertedCount,
      incidenciasInsertadas: rInc.insertedCount,
      usuariosEnAtlas: nUsers,
      incidenciasEnAtlas: nInc,
      indicesIncidencias: idxInc.map((i) => i.name),
      indicesUsuarios: idxUsr.map((i) => i.name),
      rechazoInvalido: rechazo,
    };
  } finally {
    await client.close();
  }
}

async function main() {
  console.log("Verificando semilla…");
  const resumen = verifySeed();
  console.log("Semilla OK:", resumen);
  console.log("Contraseña de prueba de todos los usuarios:", PASSWORD_SEMILLA);

  if (VERIFY_ONLY) {
    console.log("Modo --verify-only: no se tocó Atlas.");
    return;
  }

  console.log(`Aplicando en Atlas, base ${DB_NAME}…`);
  const atlas = await apply();
  console.log("Listo en Atlas:", atlas);
  console.log("Abre Browse Collections en el clúster y selecciona la base utm_desk.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
