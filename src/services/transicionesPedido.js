/**
 * @description Transiciones legales de los dos estados del pedido.
 *
 * Es la tabla de `docs/maquina-estados.md` escrita en código. Si una transición
 * cambia, se cambia primero el documento y después esta tabla.
 *
 * Acá solo se responde "¿esta transición está permitida?". Quién la puede hacer
 * (admin, operador, job) y qué efectos tiene (stock, mails, eventos) lo decide
 * PedidoEstadoService.
 */

const TRANSICIONES_PAGO = Object.freeze({
  pendiente: Object.freeze(["aprobado", "rechazado", "cancelado"]),
  rechazado: Object.freeze(["pendiente", "aprobado", "cancelado"]),
  aprobado: Object.freeze(["devuelto"]),
  cancelado: Object.freeze([]),
  devuelto: Object.freeze([]),
});

const TRANSICIONES_PREPARACION = Object.freeze({
  nuevo: Object.freeze(["en_preparacion", "cancelado"]),
  en_preparacion: Object.freeze(["enviado", "cancelado"]),
  enviado: Object.freeze(["entregado", "cancelado"]),
  entregado: Object.freeze([]),
  cancelado: Object.freeze([]),
});

const TABLAS = Object.freeze({
  pago: TRANSICIONES_PAGO,
  preparacion: TRANSICIONES_PREPARACION,
});

/**
 * Estados de pago en los que la reserva de stock puede vencer. `rechazado` está
 * incluido a propósito: el rechazo no libera el stock, lo libera el vencimiento.
 */
const ESTADOS_PAGO_VENCIBLES = Object.freeze(["pendiente", "rechazado"]);

/**
 * @description Indica si pasar de un estado a otro está permitido.
 * @param {"pago"|"preparacion"} campo - Cuál de los dos estados.
 * @param {string} desde - Estado actual.
 * @param {string} hacia - Estado destino.
 * @returns {boolean} true si la transición es legal.
 * @throws {Error} Si el campo no existe: es un error de programación, no de datos.
 */
function esTransicionValida(campo, desde, hacia) {
  const tabla = TABLAS[campo];
  if (!tabla) {
    throw new Error(`Campo de estado desconocido: ${campo}`);
  }
  return Object.hasOwn(tabla, desde) && tabla[desde].includes(hacia);
}

/**
 * @description Igual que esTransicionValida, pero lanza el error de dominio.
 * @param {"pago"|"preparacion"} campo - Cuál de los dos estados.
 * @param {string} desde - Estado actual.
 * @param {string} hacia - Estado destino.
 * @returns {void}
 * @throws {Error} TRANSICION_INVALIDA si no está permitida.
 */
function validarTransicion(campo, desde, hacia) {
  if (!esTransicionValida(campo, desde, hacia)) {
    throw new Error("TRANSICION_INVALIDA");
  }
}

module.exports = {
  TRANSICIONES_PAGO,
  TRANSICIONES_PREPARACION,
  ESTADOS_PAGO_VENCIBLES,
  esTransicionValida,
  validarTransicion,
};
