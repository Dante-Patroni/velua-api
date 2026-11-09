/**
 * Entornos donde se publica la documentación interactiva de la API (/api-docs).
 * Lista cerrada: un NODE_ENV vacío o mal escrito la deja apagada.
 */
const ENTORNOS_CON_DOCUMENTACION = Object.freeze(["development", "test"]);

/**
 * @description Si la API publica /api-docs. Solo en desarrollo y pruebas: en
 * producción le mostraría a cualquiera el mapa completo de la API, rutas del panel
 * incluidas (information disclosure), y nadie que use la tienda lo necesita. El
 * contrato para el front sale de `npm run openapi`, no de esta página.
 * @param {Object} [env] - Variables de entorno. Se puede pasar para probar.
 * @returns {boolean} True si se publica.
 */
const documentacionHabilitada = (env = process.env) =>
  ENTORNOS_CON_DOCUMENTACION.includes(env.NODE_ENV);

module.exports = { documentacionHabilitada, ENTORNOS_CON_DOCUMENTACION };
