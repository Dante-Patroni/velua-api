const { DESCUENTO_MAXIMO } = require("./transferencia");

/**
 * @description Lee y valida la configuración del pago en efectivo. El efectivo
 * existe solo en las ventas del panel (venta en persona): la tienda nunca lo
 * ofrece, aunque esté habilitado acá. Habilitado no significa permitido para
 * cualquier ruta; la autorización la decide la ruta del panel.
 *
 * Falla cerrado: un `DESCUENTO_EFECTIVO` inválido deshabilita el efectivo en vez
 * de tomarlo como 0. Un "10.5" leído como 0 % cobraría de más sin que nadie lo
 * note; deshabilitado, el error se ve en el log y en el panel.
 *
 * @param {Object} [env] - Variables de entorno. Se puede pasar para probar.
 * @returns {Readonly<{habilitado: boolean, motivo: string|null, descuento: number}>}
 *   La configuración congelada.
 */
function leerConfigEfectivo(env = process.env) {
  const descuentoTexto = String(env.DESCUENTO_EFECTIVO ?? "").trim();

  // Ausente o vacío: sin descuento. Es una decisión válida, no un error.
  if (descuentoTexto === "") {
    return Object.freeze({ habilitado: true, motivo: null, descuento: 0 });
  }

  if (!/^\d{1,2}$/.test(descuentoTexto) || Number(descuentoTexto) > DESCUENTO_MAXIMO) {
    return Object.freeze({
      habilitado: false,
      motivo: `DESCUENTO_EFECTIVO tiene que ser un entero de 0 a ${DESCUENTO_MAXIMO}`,
      descuento: 0,
    });
  }

  return Object.freeze({ habilitado: true, motivo: null, descuento: Number(descuentoTexto) });
}

/**
 * @description Deja en el log por qué el efectivo quedó deshabilitado. Se llama
 * una vez, al arrancar el servidor. El motivo nombra la variable, nunca su valor.
 * @param {{habilitado: boolean, motivo: string|null}} config - Resultado de
 *   leerConfigEfectivo.
 * @param {{warn: Function}} [logger=console] - Dónde escribir. Se inyecta en los tests.
 * @returns {void}
 */
const avisarSiEstaDeshabilitado = (config, logger = console) => {
  if (config.habilitado === true) return;
  logger.warn(`[efectivo] deshabilitado: ${config.motivo}`);
};

/**
 * Configuración de la API, leída una sola vez al cargar el módulo.
 */
const configEfectivo = leerConfigEfectivo();

module.exports = {
  leerConfigEfectivo,
  avisarSiEstaDeshabilitado,
  configEfectivo,
};
