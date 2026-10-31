/**
 * @description Alias de CBU según el BCRA: de 6 a 20 caracteres entre letras,
 * números, punto y guion.
 */
const ALIAS_VALIDO = /^[A-Za-z0-9.-]{6,20}$/;

/** CBU o CVU: exactamente 22 dígitos. */
const CBU_VALIDO = /^\d{22}$/;

/** Tope de cordura del descuento: un valor mayor es casi seguro un error de tipeo. */
const DESCUENTO_MAXIMO = 20;

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
  const descuentoTexto = String(env.DESCUENTO_TRANSFERENCIA ?? "").trim();

  if (!alias && !cbu && !titular) return deshabilitada("Sin datos bancarios");
  if (!ALIAS_VALIDO.test(alias)) return deshabilitada("TRANSFERENCIA_ALIAS no es válido");
  if (!CBU_VALIDO.test(cbu)) return deshabilitada("TRANSFERENCIA_CBU no es válido");
  if (titular.length === 0 || titular.length > 100) {
    return deshabilitada("TRANSFERENCIA_TITULAR no es válido");
  }

  let descuento = 0;
  if (descuentoTexto !== "") {
    if (!/^\d{1,2}$/.test(descuentoTexto) || Number(descuentoTexto) > DESCUENTO_MAXIMO) {
      return deshabilitada(
        `DESCUENTO_TRANSFERENCIA tiene que ser un entero de 0 a ${DESCUENTO_MAXIMO}`
      );
    }
    descuento = Number(descuentoTexto);
  }

  return Object.freeze({
    habilitada: true,
    motivo: null,
    datos: Object.freeze({ alias, cbu, titular }),
    descuento,
  });
}

/**
 * Configuración de la API, leída una sola vez al cargar el módulo. Node guarda el
 * módulo en caché: todas las rutas reciben el mismo objeto congelado.
 */
const configTransferencia = leerConfigTransferencia();

module.exports = { leerConfigTransferencia, configTransferencia, DESCUENTO_MAXIMO };
