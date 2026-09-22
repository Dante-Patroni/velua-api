const ERROR_HTTP_MAP = {
  // 400
  DATOS_INVALIDOS: 400,
  TRANSICION_INVALIDA: 400,
  PAGO_NO_APROBADO: 400,
  SEGUIMIENTO_REQUERIDO: 400,

  // 401
  NO_AUTORIZADO: 401,
  TOKEN_INVALIDO: 401,
  CREDENCIALES_INVALIDAS: 401,

  // 403
  SIN_PERMISO: 403,
  USUARIO_INACTIVO: 403,
  ORIGEN_NO_PERMITIDO: 403,

  // 404
  NO_ENCONTRADO: 404,

  // 409
  CONFLICTO_DE_DATOS: 409,
};

/**
 * @description Obtiene un codigo de dominio estable a partir de un error recibido.
 * @param {Error|undefined|null} error - Error original lanzado por service, repository o middleware.
 * @returns {string} Codigo de dominio normalizado.
 */
function obtenerCodigoError(error) {
  if (!error) return "ERROR_INTERNO";

  if (error.name === "SequelizeUniqueConstraintError") {
    return "CONFLICTO_DE_DATOS";
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return "ERROR_INTERNO";
}

/**
 * @description Mapea un error de dominio al status HTTP y responde el JSON estandar del proyecto.
 * @param {Error|{message?: string, details?: Object}|undefined|null} error - Error a traducir.
 * @param {import("express").Response} res - Response de Express.
 * @returns {import("express").Response} Respuesta con el formato `{ error }` o `{ error, details }`.
 */
function manejarErrorHttp(error, res) {
  const codigo = obtenerCodigoError(error);
  const status = ERROR_HTTP_MAP[codigo] || 500;

  if (status === 500) {
    // OJO: nunca loguear el error crudo de un proveedor de pagos.
    // Puede traer el access token o el payload completo. Ver AGENTS.md 4.6.
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({ error: "ERROR_INTERNO" });
  }

  const body = { error: codigo };
  if (error?.details && Object.keys(error.details).length > 0) {
    body.details = error.details;
  }

  return res.status(status).json(body);
}

module.exports = {
  ERROR_HTTP_MAP,
  manejarErrorHttp,
};
