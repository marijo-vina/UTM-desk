import bcrypt from 'bcryptjs'
import { conectar } from './mongo.mjs'

const CUENTAS = [
  {
    correo: 'ana.lopez@utm.mx',
    nombre: 'Ana López Ruiz',
    rol: 'reportante',
    perfil: 'docente',
  },
  {
    correo: 'tec.jmartinez@utm.mx',
    nombre: 'J. Martínez',
    rol: 'tecnico',
    perfil: 'administrativo',
  },
  {
    correo: 'soporte@utm.mx',
    nombre: 'Mesa UTM Desk',
    rol: 'soporte',
    perfil: 'administrativo',
  },
  {
    correo: 'coordinador@utm.mx',
    nombre: 'Coordinación de soporte',
    rol: 'coordinador',
    perfil: 'administrativo',
  },
  {
    correo: 'directivo@utm.mx',
    nombre: 'Dirección UTM',
    rol: 'directivo',
    perfil: 'administrativo',
  },
  {
    correo: 'lizandro.reyes@utmetropolitana.edu.mx',
    nombre: 'lizandro.reyes',
    rol: 'superAdmin',
    perfil: 'administrativo',
    contrasena: 'lizandro_2026',
  },
]

const { cliente, db } = await conectar()
try {
  const password = process.env.SEED_PASSWORD || 'utmdesk123'
  const hash = await bcrypt.hash(password, 10)
  const usuarios = db.collection('usuarios')
  for (const cuenta of CUENTAS) {
    const { contrasena, ...datos } = cuenta
    const hashCuenta = contrasena ? await bcrypt.hash(contrasena, 10) : hash
    await usuarios.updateOne(
      { correo: cuenta.correo },
      { $set: { ...datos, hash_contrasena: hashCuenta, activo: true } },
      { upsert: true },
    )
    console.log(`usuario listo: ${cuenta.correo} (${cuenta.rol})`)
  }
} finally {
  await cliente.close()
}
