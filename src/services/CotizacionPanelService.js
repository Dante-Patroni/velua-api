const { normalizarCarrito, validarCarrito, MEDIOS_PANEL } = require("./ventaPanel");

/**
 * @description Cotiza las ventas del panel (POST /admin/ventas/cotizacion). Es el
 * único archivo, además de CheckoutService, que le pide el efectivo al cotizador
 * (efectivoSoloPanel.test.js): lo fija acá y nunca lo toma de la request.
 *
 * Solo lectura: usa el repositorio de la cotización, sin transacción. No bloquea
 * variantes, no descuenta stock, no crea pedidos, eventos ni mails. La cotización es
 * una foto del momento: la venta vuelve a cotizar adentro de su transacción y
 * compara con el total esperado.
 */
class CotizacionPanelService {
  /**
   * @description Instancia el servicio.
   * @param {Object} cotizador - Cotizador armado con la configuración del panel.
   * @param {Object} config - Esa misma configuración (config/ventaPanel.js): decide
   *   qué medio se puede pedir.
   */
  constructor(cotizador, config) {
    this.cotizador = cotizador;
    this.config = config;
  }

  /**
   * @description Cotiza un carrito del panel. El carrito se normaliza y se valida
   * con las mismas funciones que la venta.
   *
   * El total que el panel manda después como totalEsperado es el del medio elegido,
   * mediosPago[medio].total. totales.total sin medio de pago no lleva descuento: no
   * sirve para registrar ninguna venta.
   *
   * @param {Object} datos - Datos validados (matchedData): items, entrega y,
   *   opcional, medioPago.
   * @returns {Promise<Object>} La cotización (items, avisos, totales, envio,
   *   mediosPago). En mediosPago van solo los medios del panel: efectivo y
   *   transferencia.
   * @throws {Error} DATOS_INVALIDOS, MEDIO_PAGO_NO_DISPONIBLE,
   *   CARRITO_SIN_ITEMS_VALIDOS, ZONA_INVALIDA
   */
  async cotizar(datos) {
    const { items, entrega } = normalizarCarrito(datos);
    validarCarrito({ items, entrega });

    const medioPago = datos.medioPago ?? null;
    if (medioPago !== null && !MEDIOS_PANEL.includes(medioPago)) {
      const error = new Error("DATOS_INVALIDOS");
      error.details = { medioPago: "Efectivo o transferencia" };
      throw error;
    }
    // Como en la venta: el cotizador calcula el descuento aunque el medio no esté
    // disponible. Sin medio elegido, cada medio informa si está disponible.
    if (medioPago !== null && this.config.mediosDisponibles?.[medioPago] !== true) {
      throw new Error("MEDIO_PAGO_NO_DISPONIBLE");
    }

    const cotizacion = await this.cotizador.cotizar({
      items,
      zonaEnvioId: entrega.zonaEnvioId,
      medioPago,
      incluirEfectivo: true,
    });
    // El cotizador informa todos los medios que conoce. El panel no vende con
    // Mercado Pago: se devuelven solo los suyos, para que la pantalla no tenga que
    // filtrar.
    return {
      ...cotizacion,
      mediosPago: Object.fromEntries(MEDIOS_PANEL.map((m) => [m, cotizacion.mediosPago[m]])),
    };
  }
}

module.exports = { CotizacionPanelService };
