/**
 * @description Alias de CBU según el BCRA: de 6 a 20 caracteres entre letras,
 * números, punto y guion.
 */
const ALIAS_VALIDO = /^[A-Za-z0-9.-]{6,20}$/;

/** CBU o CVU: exactamente 22 dígitos. */
const CBU_VALIDO = /^\d{22}$/;

/** Tope de cordura del descuento: un valor mayor es casi seguro un error de tipeo. */
const DESCUENTO_MAXIMO = 20;

/** Motivo cuando el descuento no es válido. Nombra la variable, nunca el valor. */
const MOTIVO_DESCUENTO = `DESCUENTO_TRANSFERENCIA tiene que ser un entero de 0 a ${DESCUENTO_MAXIMO}`;

/**
 * @description Valida el descuento por transferencia. Es una sola regla para la
 * tienda y para el panel: ausente o vacío es 0; si no, un entero de 0 a 20.
 * @param {Object} env - Variables de entorno.
 * @returns {{valido: boolean, descuento: number}} Si es válido y cuánto vale.
 */
const leerDescuento = (env) => {
  const texto = String(env.DESCUENTO_TRANSFERENCIA ?? "").trim();
  if (texto === "") return { valido: true, descuento: 0 };
  if (!/^\d{1,2}$/.test(texto) || Number(texto) > DESCUENTO_MAXIMO) {
    return { valido: false, descuento: 0 };
  }
  return { valido: true, descuento: Number(texto) };
};

/**
 * @description Lee y valida la configuración de la transferencia. Los datos
 * bancarios vienen solo del entorno: no se editan desde el panel, así una
 * sesión robada no puede cambiar a dónde transfieren las clientas.
 *
 * Si algo falta o no es válido, la transferencia queda deshabilitada y el resto
 * de la tienda sigue funcionando. El motivo nombra la variable, nunca su valor.
 * @param {Object} [env] - Variables de entorno. Se puede pasar para probar.
 * @returns {Readonly<{habilitada: boolean, motivo: string|null,
 *   datos: Readonly<{alias: string, cbu: string, titular: string}>|null,
 *   descuento: number}>} La configuración congelada.
 */
function leerConfigTransferencia(env = process.env) {
  /**
   * @description Configuración con la transferencia apagada.
   * @param {string} motivo - Qué falta o qué no es válido, sin el valor.
   * @returns {Readonly<Object>} La configuración deshabilitada.
   */
  const deshabilitada = (motivo) =>
    Object.freeze({ habilitada: false, motivo, datos: null, descuento: 0 });

  const alias = String(env.TRANSFERENCIA_ALIAS ?? "").trim();
  const cbu = String(env.TRANSFERENCIA_CBU ?? "").trim();
  const titular = String(env.TRANSFERENCIA_TITULAR ?? "").trim();

  if (!alias && !cbu && !titular) return deshabilitada("Sin datos bancarios");
  if (!ALIAS_VALIDO.test(alias)) return deshabilitada("TRANSFERENCIA_ALIAS no es válido");
  if (!CBU_VALIDO.test(cbu)) return deshabilitada("TRANSFERENCIA_CBU no es válido");
  if (titular.length === 0 || titular.length > 100) {
    return deshabilitada("TRANSFERENCIA_TITULAR no es válido");
  }

  const { valido, descuento } = leerDescuento(env);
  if (!valido) return deshabilitada(MOTIVO_DESCUENTO);

  return Object.freeze({
    habilitada: true,
    motivo: null,
    datos: Object.freeze({ alias, cbu, titular }),
    descuento,
  });
}

/**
 * @description La transferencia en las ventas del panel (venta en persona). A
 * diferencia de la tienda, no necesita los datos bancarios: la API no se los
 * muestra a nadie, la dueña los pasa en persona o por WhatsApp. Lo que sí tiene
 * que ser válido es el descuento, porque es plata: un valor inválido la apaga
 * (falla cerrado) en vez de cobrar sin descuento sin que nadie lo note.
 * @param {Object} [env] - Variables de entorno. Se puede pasar para probar.
 * @returns {Readonly<{habilitada: boolean, motivo: string|null, descuento: number}>}
 *   La configuración congelada.
 */
function leerTransferenciaEnPanel(env = process.env) {
  const { valido, descuento } = leerDescuento(env);
  if (!valido) return Object.freeze({ habilitada: false, motivo: MOTIVO_DESCUENTO, descuento: 0 });
  return Object.freeze({ habilitada: true, motivo: null, descuento });
}

/**
 * @description Deja en el log por qué la transferencia quedó deshabilitada. Se
 * llama una vez, al arrancar el servidor: sin esto, el 503 MEDIO_PAGO_NO_DISPONIBLE
 * llega sin pista de la causa. El motivo nombra la variable, nunca su valor.
 * @param {{habilitada: boolean, motivo: string|null}} config - Resultado de
 *   leerConfigTransferencia.
 * @param {{warn: Function}} [logger=console] - Dónde escribir. Se inyecta en los tests.
 * @returns {void}
 */
const avisarSiEstaDeshabilitada = (config, logger = console) => {
  if (config.habilitada === true) return;
  logger.warn(`[transferencia] deshabilitada: ${config.motivo}`);
};

/**
 * @description Lo mismo para el panel: deja en el log por qué la transferencia no
 * se puede usar en las ventas en persona. Se llama una vez, al arrancar.
 * @param {{habilitada: boolean, motivo: string|null}} config - Resultado de
 *   leerTransferenciaEnPanel.
 * @param {{warn: Function}} [logger=console] - Dónde escribir. Se inyecta en los tests.
 * @returns {void}
 */
const avisarSiEstaDeshabilitadaEnPanel = (config, logger = console) => {
  if (config.habilitada === true) return;
  logger.warn(`[transferencia] deshabilitada en el panel: ${config.motivo}`);
};

/**
 * Configuración de la API, leída una sola vez al cargar el módulo. Node guarda el
 * módulo en caché: todas las rutas reciben el mismo objeto congelado.
 */
const configTransferencia = leerConfigTransferencia();

/** La del panel, leída una sola vez. La usa la ruta de ventas (PR 3e). */
const configTransferenciaEnPanel = leerTransferenciaEnPanel();

module.exports = {
  leerConfigTransferencia,
  leerTransferenciaEnPanel,
  avisarSiEstaDeshabilitada,
  avisarSiEstaDeshabilitadaEnPanel,
  configTransferencia,
  configTransferenciaEnPanel,
  DESCUENTO_MAXIMO,
};
