const db = require("../models");
const SequelizeUsuarioRepository = require("../repositories/sequelize/SequelizeUsuarioRepository");
const { crearAuthMiddleware, COOKIE_SESION } = require("./crearAuthMiddleware");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no esta definida en variables de entorno");
}

/**
 * @description Middleware de sesion del panel conectado a la base real.
 * La logica vive en crearAuthMiddleware; aca solo se inyectan las dependencias.
 */
const authMiddleware = crearAuthMiddleware({
  usuarioRepository: new SequelizeUsuarioRepository(db),
  jwtSecret: JWT_SECRET,
});

module.exports = { authMiddleware, COOKIE_SESION };
