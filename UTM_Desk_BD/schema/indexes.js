"use strict";

module.exports = {
  incidencias_campus: [
    {
      name: "uq_codigo",
      keys: { codigo: 1 },
      unique: true,
    },
    {
      name: "ix_categoria_estado_edificio",
      keys: { categoria: 1, estado: 1, "ubicacion.edificio": 1 },
    },
    {
      name: "txt_titulo_descripcion_es",
      keys: { titulo: "text", descripcion: "text" },
      weights: { titulo: 10, descripcion: 5 },
      default_language: "spanish",
    },
    {
      name: "ttl_fecha_resolucion_60d",
      keys: { fecha_resolucion: 1 },
      expireAfterSeconds: 5184000,
    },
  ],
  usuarios: [
    {
      name: "uq_correo",
      keys: { correo: 1 },
      unique: true,
    },
  ],
};
