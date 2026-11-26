const { entradaPropia } = require("../utils/entradaPropia");

const ERROR_HTTP_MAP = {
  // 400
  CONTRASENA_ACTUAL_INCORRECTA: 400,
  DATOS_INVALIDOS: 400,
  TRANSICION_INVALIDA: 400,
  PAGO_NO_APROBADO: 400,
  SEGUIMIENTO_REQUERIDO: 400,
  SIN_VARIANTES: 400,
  ULTIMA_VARIANTE_ACTIVA: 400,
  JSON_INVALIDO: 400,
  ARCHIVO_REQUERIDO: 400,
  TIPO_ARCHIVO_INVALIDO: 400,
  ARCHIVO_DEMASIADO_GRANDE: 400,
  LIMITE_IMAGENES: 400,
  CARRITO_SIN_ITEMS_VALIDOS: 400,
  ZONA_INVALIDA: 400,
  CATEGORIA_PADRE_INVALIDA: 400,

  // 401
  NO_AUTORIZADO: 401,
  TOKEN_INVALIDO: 401,
  TOKEN_EXPIRADO: 401,
  CREDENCIALES_INVALIDAS: 401,
  SESION_REVOCADA: 401,

  // 403
  SIN_PERMISO: 403,
  USUARIO_INACTIVO: 403,
  ORIGEN_NO_PERMITIDO: 403,

  // 404
  NO_ENCONTRADO: 404,

  // 409
  CONFLICTO_DE_DATOS: 409,
  PRODUCTO_CON_VENTAS: 409,
  CARRITO_DESACTUALIZADO: 409,
  TOTAL_CAMBIO: 409,
  STOCK_INSUFICIENTE: 409,
  PEDIDO_NO_PAGABLE: 409,
  PEDIDO_YA_PAGADO: 409,
  PEDIDO_EN_REVISION: 409,
  PAGO_EN_PROCESO: 409,
  PEDIDO_VENCIDO: 409,
  CATEGORIA_CON_HIJAS: 409,
  CATEGORIA_CON_PRODUCTOS: 409,
  PEDIDO_PAGADO: 409,
  PAGO_EN_CURSO: 409,
  COMPROBANTE_INFORMADO: 409,
  CLAVE_REUTILIZADA: 409,

  // 413
  CUERPO_DEMASIADO_GRANDE: 413,

  // 502
  ERROR_AL_SUBIR: 502,
  PROCESADOR_NO_DISPONIBLE: 502,

  // 503
  PROCESADOR_NO_CONFIGURADO: 503,
  MEDIO_PAGO_NO_DISPONIBLE: 503,
};

/**
 * @description Errores del parser de cuerpos de Express. Traen un mensaje técnico
 * que no es un código de dominio, así que se resuelven por su tipo antes de mirar
 * el mensaje. Sin esto caían en 500 y se registraban con el cuerpo del cliente.
 */
const ERRORES_DEL_PARSER = {
  "entity.parse.failed": "JSON_INVALIDO",
  "entity.too.large": "CUERPO_DEMASIADO_GRANDE",
};

/**
 * @description Errores del cliente que arma Express antes de llegar a un controller,
 * como una URL con una secuencia `%` mal codificada. Se reconocen por su origen,
 * nunca solo por traer un status 4xx: un error de un SDK con `status: 401` (por
 * ejemplo, una credencial nuestra vencida) es una falla del servidor, y tratarlo
 * como del cliente lo escondería del log de errores internos (falla abierto).
 *
 * Se aceptan dos orígenes:
 * - el `URIError` con status 400 del router de Express ("Failed to decode param");
 * - un error con `expose === true`, la marca de `http-errors`. Es confiable porque,
 *   al 21/11/2026, `http-errors` solo entra a producción por Express (`npm ls
 *   http-errors --omit=dev`). Lo verifica `errorMapper.cliente.test.js`: si una
 *   dependencia nueva la trae, el test falla y hay que revisar esta decisión.
 * @param {Error|undefined|null} error - Error recibido.
 * @returns {number|null} El status 4xx si el error es del cliente y de origen conocido; si no, null.
 */
function statusDeErrorDelCliente(error) {
  if (!error) return null;
  const status = error.status ?? error.statusCode;
  if (!Number.isInteger(status) || status < 400 || status > 499) return null;
  if (error instanceof URIError) return status === 400 ? 400 : null;
  return error.expose === true ? status : null;
}

/**
 * @description Obtiene un codigo de dominio estable a partir de un error recibido.
 * @param {Error|undefined|null} error - Error original lanzado por service, repository o middleware.
 * @returns {string} Codigo de dominio normalizado.
 */
function obtenerCodigoError(error) {
  if (!error) return "ERROR_INTERNO";

  if (ERRORES_DEL_PARSER[error.type]) {
    return ERRORES_DEL_PARSER[error.type];
  }

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
  // El código puede venir del mensaje de un error ajeno: solo claves propias del mapa.
  const status = entradaPropia(ERROR_HTTP_MAP, codigo) || 500;

  const statusCliente = status === 500 ? statusDeErrorDelCliente(error) : null;
  if (statusCliente) {
    // Sin console.error: no es una falla nuestra, y si no, cualquiera llena el log de
    // errores internos con URLs mal escritas. Queda en el registro de peticiones (una
    // línea con el status y el código, sin la URL ni el mensaje), y ahí se ve un pico.
    if (res.locals) res.locals.codigoError = "SOLICITUD_INVALIDA";
    return res.status(statusCliente).json({ error: "SOLICITUD_INVALIDA" });
  }

  // Para el registro de peticiones: el código de error, nunca el mensaje ni el detalle.
  if (res.locals) {
    res.locals.codigoError = status === 500 ? "ERROR_INTERNO" : codigo;
  }

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
