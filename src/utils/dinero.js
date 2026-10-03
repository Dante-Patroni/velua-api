/**
 * @description Convierte un importe en cadena decimal a centavos enteros.
 *
 * Todo el cálculo de dinero se hace en centavos con enteros. En punto flotante,
 * 0.1 + 0.2 no da 0.3, y sobre un total con descuentos y porcentajes ese error
 * se amplifica hasta verse en la factura.
 *
 * @param {string|number} valor - Importe, por ejemplo "8500.00".
 * @returns {number} Centavos enteros, por ejemplo 850000.
 * @throws {Error} DATOS_INVALIDOS si el valor no tiene forma de importe.
 */
const aCentavos = (valor) => {
  const texto = String(valor ?? "").trim();

  if (!/^-?\d{1,12}([.,]\d{1,2})?$/.test(texto)) {
    throw new Error("DATOS_INVALIDOS");
  }

  const negativo = texto.startsWith("-");
  const [entera, decimal = ""] = texto.replace("-", "").replace(",", ".").split(".");
  const centavos = Number(entera) * 100 + Number(decimal.padEnd(2, "0"));

  return negativo ? -centavos : centavos;
};

/**
 * @description Convierte centavos enteros a la cadena decimal del contrato.
 * @param {number} centavos - Centavos enteros.
 * @returns {string} Importe con dos decimales, por ejemplo "8500.00".
 */
const aImporte = (centavos) => {
  const signo = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(Math.round(centavos));
  const entera = Math.floor(absoluto / 100);
  const decimal = String(absoluto % 100).padStart(2, "0");

  return `${signo}${entera}.${decimal}`;
};

/**
 * @description Calcula un porcentaje sobre un monto en centavos, redondeando al
 * centavo más cercano.
 * @param {number} centavos - Monto base en centavos.
 * @param {number} porcentaje - Porcentaje, por ejemplo 10 para el diez por ciento.
 * @returns {number} El resultado en centavos enteros.
 */
const porcentajeDe = (centavos, porcentaje) => Math.round((centavos * porcentaje) / 100);

/**
 * @description Redondea un monto al peso entero.
 *
 * Se aplica una sola vez, sobre el total. Redondear en cada paso haría que los
 * errores se sumen: tres pasos redondeados pueden desviar el total en varios
 * pesos.
 *
 * @param {number} centavos - Monto en centavos.
 * @returns {number} El monto redondeado al peso, en centavos.
 */
const redondearAlPeso = (centavos) => Math.round(centavos / 100) * 100;

module.exports = { aCentavos, aImporte, porcentajeDe, redondearAlPeso };
