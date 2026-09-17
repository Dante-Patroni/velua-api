const jwt = require("jsonwebtoken");
const { manejarErrorHttp } = require("./errorMapper");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no esta definida en variables de entorno");
}

/**
 * @description Nombre de la cookie que transporta el token de sesion del panel.
 */
const COOKIE_SESION = "velua_sesion";

/**
 * @description Valida el JWT de la cookie de sesion y expone el usuario en req.usuario.
 * @param {import("express").Request} req - Request de Express.
 * @param {import("express").Response} res - Response de Express.
 * @param {import("express").NextFunction} next - Siguiente middleware.
 * @returns {import("express").Response|void} Responde con error o continua la cadena.
 * @throws {Error} NO_AUTORIZADO, TOKEN_EXPIRADO, TOKEN_INVALIDO
 */
const authMiddleware = (req, res, next) => {
  const token = req.cookies?.[COOKIE_SESION];

  if (!token) {
    return manejarErrorHttp(new Error("NO_AUTORIZADO"), res);
  }

  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    const codigo = error.name === "TokenExpiredError" ? "TOKEN_EXPIRADO" : "TOKEN_INVALIDO";
    return manejarErrorHttp(new Error(codigo), res);
  }
};

module.exports = { authMiddleware, COOKIE_SESION };
