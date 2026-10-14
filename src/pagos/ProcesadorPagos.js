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
   * @description Lee una preferencia ya creada.
   * @param {string} _preferenciaId - Id de la preferencia.
   * @returns {Promise<{urlPago: string, venceEn: Date|null}>} Link y vencimiento.
   */
  async obtenerPreferencia(_preferenciaId) {
    throw new Error("Metodo obtenerPreferencia no implementado");
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

  /**
   * @description Busca todos los pagos de un pedido por su referencia, del más
   * nuevo al más viejo. Sirve para reconciliar sin depender de que el aviso del
   * webhook haya llegado. Sin pagos devuelve [] (no es un error).
   * @param {string} _referencia - Número de pedido (external_reference).
   * @returns {Promise<Array<{id: string, estado: string, detalle: string|null,
   *   referencia: string|null, monto: string, moneda: string, metodo: string|null}>>}
   *   Pagos normalizados, con el mismo formato que obtenerPago.
   */
  async buscarPagosPorReferencia(_referencia) {
    throw new Error("Metodo buscarPagosPorReferencia no implementado");
  }
}

module.exports = ProcesadorPagos;
