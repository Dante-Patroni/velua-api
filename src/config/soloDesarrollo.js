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

module.exports = { ENTORNOS_DE_DESARROLLO, exigirEntornoDeDesarrollo };