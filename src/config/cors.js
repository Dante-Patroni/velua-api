/**
 * @description Arma la función que decide qué orígenes pueden consumir la API.
 * Acepta los orígenes exactos de la lista y, si hay patrón, los que coinciden
 * con él (las previews de Vercel, que cambian de URL con cada rama).
 * @param {object} config - Configuración de CORS.
 * @param {string[]} config.origenes - Orígenes exactos permitidos.
 * @param {RegExp|null} [config.patron] - Patrón opcional de orígenes permitidos.
 * @returns {Function} validarOrigen(origin, callback) para el paquete cors.
 */
const crearValidadorOrigen =
  ({ origenes, patron = null }) =>
  (origin, callback) => {
    if (!origin || origenes.includes(origin) || patron?.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error("ORIGEN_NO_PERMITIDO"));
  };

/**
 * @description Lee la configuración de CORS de las variables de entorno.
 * Un patrón mal escrito tira error al arrancar, a propósito: mejor no levantar
 * que levantar con CORS roto.
 * @param {object} [env=process.env] - Variables de entorno.
 * @returns {{origenes: string[], patron: RegExp|null}} La configuración.
 */
const leerConfigCors = (env = process.env) => ({
  origenes: (env.CORS_ORIGENES || "http://localhost:5173").split(",").map((o) => o.trim()),
  patron: env.CORS_PATRON_PREVIEWS ? new RegExp(env.CORS_PATRON_PREVIEWS) : null,
});

module.exports = { crearValidadorOrigen, leerConfigCors };
