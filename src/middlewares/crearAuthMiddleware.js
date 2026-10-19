const jwt = require("jsonwebtoken");
const { manejarErrorHttp } = require("./errorMapper");
const { permisosDeRol } = require("../config/permisos");

/**
 * @description Nombre de la cookie que transporta el token de sesion del panel.
 */
const COOKIE_SESION = "velua_sesion";

/**
 * @description Crea el middleware de sesion del panel. Verifica la firma del JWT y
 * despues consulta la base: el usuario tiene que existir, estar activo y tener la
 * misma version de sesion que el token. El rol y los permisos salen de la base,
 * nunca del token, asi un cambio de rol o una desactivacion rigen en el acto.
 * @param {Object} dependencias - Dependencias inyectadas.
 * @param {Object} dependencias.usuarioRepository - Implementacion de UsuarioRepository.
 * @param {string} dependencias.jwtSecret - Secreto con el que se firman los tokens.
 * @returns {import("express").RequestHandler} Middleware que carga req.usuario.
 * @throws {Error} Si falta el secreto.
 */
const crearAuthMiddleware = ({ usuarioRepository, jwtSecret }) => {
  if (!jwtSecret) {
    throw new Error("crearAuthMiddleware necesita jwtSecret");
  }

  return async (req, res, next) => {
    const token = req.cookies?.[COOKIE_SESION];
    if (!token) {
      return manejarErrorHttp(new Error("NO_AUTORIZADO"), res);
    }

    let contenido;
    try {
      // Algoritmo fijo: un token con otro algoritmo (o con "none") se rechaza.
      contenido = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
    } catch (error) {
      const codigo = error.name === "TokenExpiredError" ? "TOKEN_EXPIRADO" : "TOKEN_INVALIDO";
      return manejarErrorHttp(new Error(codigo), res);
    }

    let usuario;
    try {
      usuario = await usuarioRepository.buscarSesion(contenido.id);
    } catch (error) {
      // Si no se puede verificar la sesion, no se deja pasar (falla cerrado).
      return manejarErrorHttp(error, res);
    }

    if (!usuario) {
      return manejarErrorHttp(new Error("NO_AUTORIZADO"), res);
    }
    if (!usuario.activo) {
      return manejarErrorHttp(new Error("USUARIO_INACTIVO"), res);
    }
    if (contenido.sv !== usuario.versionSesion) {
      return manejarErrorHttp(new Error("SESION_REVOCADA"), res);
    }

    req.usuario = {
      id: usuario.id,
      rol: usuario.rol,
      permisos: permisosDeRol(usuario.rol),
    };
    return next();
  };
};

module.exports = { crearAuthMiddleware, COOKIE_SESION };
