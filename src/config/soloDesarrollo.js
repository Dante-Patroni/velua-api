/**
 * @description Entornos donde se pueden cargar datos de ejemplo o deshacer
 * seeders. Es una lista de lo permitido: si NODE_ENV falta o tiene otro valor
 * (production, staging, "Production"), no se corre.
 */
const ENTORNOS_DE_DESARROLLO = Object.freeze(["development", "test"]);

/**
 * @description Corta un seeder si no estamos en desarrollo ni en pruebas.
 * @param {string} accion - Qué se iba a hacer, para el mensaje de error.
 * @param {Object} [env] - Variables de entorno. Se puede pasar para probar.
 * @returns {void}
 * @throws {Error} Si el entorno no es de desarrollo ni de pruebas.
 */
function exigirEntornoDeDesarrollo(accion, env = process.env) {
  const entorno = env.NODE_ENV;
  if (!ENTORNOS_DE_DESARROLLO.includes(entorno)) {
    throw new Error(
      `${accion}: solo se permite con NODE_ENV=development o test (ahora: ${entorno ?? "sin definir"})`
    );
  }
}

/**
 * @description URL de una API local: http, en localhost o 127.0.0.1, con o sin
 * puerto. El final es obligatorio (barra o fin de texto), así
 * "http://localhost.otro-dominio.com" no pasa.
 */
const URL_LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

/**
 * @description Corta un script de prueba si no apunta a una API local. Los
 * scripts de concurrencia crean pedidos y cambian stock: contra producción, le
 * llegarían pedidos falsos a la dueña y se tocaría el stock real.
 * @param {string} accion - Qué se iba a hacer, para el mensaje de error.
 * @param {string} url - Base de la API a la que apunta el script.
 * @returns {void}
 * @throws {Error} Si la URL no es local.
 */
function exigirApiLocal(accion, url) {
  if (!URL_LOCAL.test(url)) {
    throw new Error(`${accion}: solo contra una API local (ahora: ${url})`);
  }
}

/** Hosts de una base en la misma máquina. */
const HOSTS_LOCALES = Object.freeze(["localhost", "127.0.0.1", "::1"]);

/**
 * @description Corta un script si la base del .env no es local. NODE_ENV solo
 * protege por convención: con NODE_ENV=development y un DB_HOST de producción,
 * exigirEntornoDeDesarrollo pasa. Este control mira adónde se conecta de verdad.
 * Sin DB_HOST, la configuración de desarrollo y de pruebas usa 127.0.0.1.
 * @param {string} accion - Qué se iba a hacer, para el mensaje de error.
 * @param {Object} [env] - Variables de entorno. Se puede pasar para probar.
 * @returns {void}
 * @throws {Error} Si DB_HOST no es un host local.
 */
function exigirBaseLocal(accion, env = process.env) {
  const host = env.DB_HOST || "127.0.0.1";
  if (!HOSTS_LOCALES.includes(host)) {
    throw new Error(`${accion}: solo contra una base local (ahora: DB_HOST=${host})`);
  }
}

module.exports = {
  ENTORNOS_DE_DESARROLLO,
  exigirEntornoDeDesarrollo,
  exigirApiLocal,
  exigirBaseLocal,
};