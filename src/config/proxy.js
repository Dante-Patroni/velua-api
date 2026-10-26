/**
 * Cuántos proxies hay delante de la API, para que Express tome la IP de la
 * clienta y no la de un proxy. Sale de TRUST_PROXY_SALTOS.
 *
 * Por qué importa: los limitadores (login, pedidos, global) cuentan por req.ip.
 * Si req.ip es la IP del borde de Railway, todas las clientas comparten un
 * contador, y el log de peticiones no identifica a nadie (t50).
 *
 * Solo se acepta un entero de 0 a 3. Nunca `true`: confiar en cualquier proxy
 * deja que el cliente elija su IP mandando su propio X-Forwarded-For.
 */
const SALTOS_POR_DEFECTO = 1;
const SALTOS_VALIDOS = /^[0-3]$/;

/**
 * @description Lee y valida la cantidad de saltos de proxy.
 * @param {string|undefined} valor - Valor de TRUST_PROXY_SALTOS.
 * @returns {number} La cantidad de saltos.
 * @throws {Error} Si no es un entero de 0 a 3: la API no arranca con una
 *   configuración que podría dejar falsificar la IP.
 */
function leerSaltosProxy(valor) {
  const limpio = valor?.trim() ?? "";
  if (limpio === "") return SALTOS_POR_DEFECTO;
  if (!SALTOS_VALIDOS.test(limpio)) {
    throw new Error("TRUST_PROXY_SALTOS tiene que ser un entero de 0 a 3");
  }
  return Number(limpio);
}

module.exports = { leerSaltosProxy, SALTOS_POR_DEFECTO };