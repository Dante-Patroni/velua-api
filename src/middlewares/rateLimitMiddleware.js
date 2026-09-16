const rateLimit = require("express-rate-limit");

/**
 * @description Handler unico para limite superado. Respeta el contrato de error del proyecto.
 * @param {import("express").Request} req - Request de Express.
 * @param {import("express").Response} res - Response de Express.
 * @returns {import("express").Response} Respuesta 429 con codigo de dominio.
 */
const handlerLimiteSuperado = (req, res) => {
  return res.status(429).json({ error: "LIMITE_SUPERADO" });
};

/**
 * @description Limite estricto para el login del panel. Frena fuerza bruta.
 */
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handlerLimiteSuperado,
});

/**
 * @description Limite general para toda la API. Segunda capa contra scrapers.
 */
const limitadorGlobal = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handlerLimiteSuperado,
});

module.exports = { limitadorLogin, limitadorGlobal };