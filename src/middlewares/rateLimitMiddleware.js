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
  limit: process.env.NODE_ENV === "production" ? 100 : 10000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: handlerLimiteSuperado,
});

/**
 * @description Límite para crear pedidos. Crear un pedido aparta stock: sin límite,
 * alguien podría crear cien pedidos falsos y dejar el catálogo agotado durante una
 * hora. Una clienta real nunca llega a diez por hora.
 *
 * Fuera de producción el límite es alto, para que correr Newman varias veces
 * seguidas no se bloquee solo.
 */
const limitadorPedidos = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handlerLimiteSuperado,
});

module.exports = { limitadorLogin, limitadorGlobal, limitadorPedidos };
