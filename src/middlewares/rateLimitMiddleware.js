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

/**
 * @description Límite para el formulario de arrepentimiento. Es público y encola
 * mails: sin límite, alguien podría llenar la bandeja de salida y la casilla de la
 * dueña con solicitudes falsas. Una clienta real manda una, a lo sumo dos.
 */
const limitadorArrepentimiento = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 5 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handlerLimiteSuperado,
});

/**
 * @description Límite para consultar un pedido por su número. Cuenta solo las
 * consultas que fallan (número inexistente): una clienta consulta su propio
 * pedido, que existe, y nunca llega al límite aunque la página de resultado
 * consulte cada pocos segundos. Quien prueba números al azar falla casi siempre y
 * se frena enseguida.
 */
const limitadorConsultaPedidos = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 20 : 1000,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handlerLimiteSuperado,
});

/**
 * @description Clave del contador del cambio de contraseña: la usuaria de la sesión, no la IP.
 * @param {import("express").Request} req - Request con req.usuario cargado por authMiddleware.
 * @returns {string} Clave del contador.
 */
const clavePorUsuaria = (req) => `usuario:${req.usuario.id}`;

/**
 * @description Solo suma al contador el intento con la contraseña actual incorrecta.
 * @param {import("express").Request} _req - Request de Express.
 * @param {import("express").Response} res - Response, con la marca que deja el controlador.
 * @returns {boolean} true si el intento no tiene que sumar al contador.
 */
const noFueContrasenaIncorrecta = (_req, res) => !res.locals.contrasenaActualIncorrecta;

/**
 * @description Cambio de contraseña: 5 intentos con la contraseña actual incorrecta
 * cada 15 minutos, por usuaria y no por IP (con una sesión robada, cambiar de IP
 * no reinicia el contador). Los demás rechazos no cuentan: a la política de la
 * contraseña nueva solo se llega con la actual correcta. Va después de authMiddleware.
 */
const limitadorCambioContrasena = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 5 : 1000,
  keyGenerator: clavePorUsuaria,
  skipSuccessfulRequests: true,
  requestWasSuccessful: noFueContrasenaIncorrecta,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handlerLimiteSuperado,
});

module.exports = {
  limitadorLogin,
  limitadorGlobal,
  limitadorPedidos,
  limitadorCambioContrasena,
  limitadorArrepentimiento,
  limitadorConsultaPedidos,
  clavePorUsuaria,
  noFueContrasenaIncorrecta,
};
