const { validationResult } = require("express-validator");

/**
 * @description Centraliza los errores de express-validator y responde el contrato del proyecto.
 * Los errores se devuelven como objeto plano: { campo: "mensaje" }.
 * @param {import("express").Request} req - Request validada por las reglas previas.
 * @param {import("express").Response} res - Response de Express.
 * @param {import("express").NextFunction} next - Siguiente middleware.
 * @returns {import("express").Response|void} Responde DATOS_INVALIDOS o continua.
 */
const manejarErroresValidacion = (req, res, next) => {
  const errores = validationResult(req);

  if (errores.isEmpty()) {
    return next();
  }

  const details = {};
  for (const e of errores.array()) {
    const campo = e.path || e.param || "general";
    if (!details[campo]) {
      details[campo] = e.msg;
    }
  }

  return res.status(400).json({ error: "DATOS_INVALIDOS", details });
};

module.exports = { manejarErroresValidacion };
