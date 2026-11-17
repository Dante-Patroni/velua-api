const { configEfectivo } = require("./efectivo");
const { configTransferenciaEnPanel } = require("./transferencia");

/**
 * @description Arma la configuración comercial de las ventas del panel. La usan la
 * venta (POST /admin/ventas) y su cotización: un solo objeto, así las dos calculan
 * con los mismos parámetros. Si fueran dos, la pantalla podría mostrar un total y la
 * venta rechazarlo con TOTAL_CAMBIO, o cobrar otro.
 *
 * Congelada en los dos niveles: Object.freeze es superficial, y mediosDisponibles
 * decide qué se puede cobrar.
 *
 * @param {Object} efectivo - Configuración del efectivo (leerConfigEfectivo).
 * @param {Object} transferencia - Transferencia en el panel (leerTransferenciaEnPanel).
 * @param {Object} [env=process.env] - Variables de entorno.
 * @returns {Object} La configuración, congelada.
 */
function armarConfigVentaPanel(efectivo, transferencia, env = process.env) {
  return Object.freeze({
    umbralEnvioGratis: env.ENVIO_GRATIS_DESDE || null,
    descuentoEfectivo: efectivo.descuento,
    descuentoTransferencia: transferencia.descuento,
    mediosDisponibles: Object.freeze({
      efectivo: efectivo.habilitado,
      transferencia: transferencia.habilitada,
    }),
  });
}

/** La configuración que usan la venta y la cotización del panel. */
const configVentaPanel = armarConfigVentaPanel(configEfectivo, configTransferenciaEnPanel);

module.exports = {
  armarConfigVentaPanel,
  configVentaPanel,
};
