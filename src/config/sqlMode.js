/**
 * @description Modos de `sql_mode` con los que la API no puede trabajar.
 *
 * `NO_BACKSLASH_ESCAPES` hace que MySQL deje de tratar la barra invertida como
 * escape. Sequelize escapa las comillas de los datos como `\'` (también en los
 * `replacements`), así que con ese modo una comilla cierra el texto y lo que
 * sigue se ejecuta como SQL: se anula la defensa contra inyección de toda la API,
 * sin ningún error visible. Hallazgo de la revisión de seguridad del #97 (25/11).
 */
const MODOS_PROHIBIDOS = Object.freeze(["NO_BACKSLASH_ESCAPES"]);

/**
 * @description Modos prohibidos presentes en un valor de `sql_mode`.
 * Compara modo por modo (separados por coma), no por substring.
 * @param {string} sqlMode - Valor de `@@SESSION.sql_mode`.
 * @returns {string[]} Los modos prohibidos que aparecen, o una lista vacía.
 */
const modosProhibidos = (sqlMode) =>
  String(sqlMode)
    .split(",")
    .map((modo) => modo.trim().toUpperCase())
    .filter((modo) => MODOS_PROHIBIDOS.includes(modo));

/**
 * @description Lee el `sql_mode` de la sesión con la API de callbacks de mysql2,
 * que es la conexión cruda que recibe el hook `afterConnect`.
 * @param {Object} conexion - Conexión de mysql2.
 * @returns {Promise<string>} El `sql_mode` de esa conexión.
 */
const leerSqlMode = (conexion) =>
  new Promise((resolver, rechazar) => {
    conexion.query("SELECT @@SESSION.sql_mode AS modo", (error, filas) => {
      if (error) return rechazar(error);
      return resolver(String(filas?.[0]?.modo ?? ""));
    });
  });

/**
 * @description Verifica una conexión recién abierta. Falla cerrado: si el modo es
 * inseguro, o si no se puede leer, cierra la conexión y lanza, así la conexión
 * nunca entra al pool.
 *
 * Al arrancar, `sequelize.authenticate()` abre la primera conexión: si falla acá,
 * `server.js` corta con código 1 y Railway deja el deploy anterior. Después, cada
 * conexión nueva del pool pasa por el mismo control, por si el modo cambia con la
 * API corriendo: esa consulta falla (500) en vez de correr sin protección.
 *
 * @param {Object} conexion - Conexión de mysql2.
 * @returns {Promise<void>}
 * @throws {Error} SQL_MODE_INSEGURO, o el error de la lectura.
 */
const verificarSqlMode = async (conexion) => {
  let prohibidos;
  try {
    prohibidos = modosProhibidos(await leerSqlMode(conexion));
  } catch (error) {
    conexion.destroy();
    throw error;
  }

  if (prohibidos.length > 0) {
    conexion.destroy();
    const error = new Error(
      `SQL_MODE_INSEGURO: ${prohibidos.join(", ")} anula el escape de Sequelize. ` +
        "Sacalo del sql_mode del servidor antes de levantar la API."
    );
    error.code = "SQL_MODE_INSEGURO";
    throw error;
  }
};

/**
 * @description Registra la verificación en cada conexión nueva de Sequelize.
 * @param {Object} sequelize - Instancia de Sequelize.
 * @returns {void}
 */
const instalarGuardaSqlMode = (sequelize) => {
  sequelize.addHook("afterConnect", "guardaSqlMode", verificarSqlMode);
};

module.exports = { MODOS_PROHIBIDOS, modosProhibidos, verificarSqlMode, instalarGuardaSqlMode };
