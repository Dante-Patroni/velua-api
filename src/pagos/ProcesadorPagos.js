/**
 * @description Interfaz del procesador de pagos online.
 *
 * El checkout y el webhook hablan con este contrato, no con Mercado Pago. Si mañana
 * se cambia de procesador, se agrega una implementación y el resto del código no se
 * toca. Es el mismo criterio que ImagenStorage.
 */
class ProcesadorPagos {
  /**
   * @description Crea la orden de cobro de un pedido.
   * @param {Object} _pedido - Datos del pedido.
   * @param {string} _pedido.numero - Número del pedido; vuelve en el pago como referencia.
   * @param {string} _pedido.total - Importe como cadena decimal.
   * @param {string} _pedido.email - Mail de la clienta.
   * @param {Date} _pedido.expiraEn - Hasta cuándo se puede pagar.
   * @returns {Promise<{preferenciaId: string, urlPago: string}>} Id de la orden y URL de pago.
   */
  async crearPreferencia(_pedido) {
    throw new Error("Metodo crearPreferencia no implementado");
  }

  /**
   * @description Consulta un pago en el procesador. Es la única fuente de verdad:
   * el aviso del webhook solo dice que algo cambió, nunca qué.
   * @param {string} _pagoId - Id del pago en el procesador.
   * @returns {Promise<{id: string, estado: string, detalle: string|null,
   *   referencia: string|null, monto: string, moneda: string, metodo: string|null}>}
   *   Pago normalizado, con el monto como cadena decimal.
   */
  async obtenerPago(_pagoId) {
    throw new Error("Metodo obtenerPago no implementado");
  }
}

module.exports = ProcesadorPagos;
