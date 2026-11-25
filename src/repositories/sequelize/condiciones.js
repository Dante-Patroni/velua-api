const { literal } = require("sequelize");

/**
 * @description Alias de la tabla de categorías con los que se usa `padreActivo`:
 * `Categoria` cuando la consulta parte de las categorías y `categoria` cuando la
 * categoría es un include del producto. Es una lista cerrada porque el alias va
 * dentro de un `literal`, sin escape: un identificador que no está acá no se
 * interpola nunca.
 */
const ALIAS_CATEGORIA = Object.freeze(["Categoria", "categoria"]);

/**
 * @description Condición que exige que la categoría padre, si existe, esté activa.
 *
 * Desactivar una categoría oculta todo lo que cuelga de ella: sus productos y
 * también sus hijas, con los productos de cada una. Sin esta condición, apagar
 * "Jabones" dejaría visibles sus tres colecciones.
 *
 * Falla cerrado: el alias se interpola en SQL, así que solo se aceptan los de
 * `ALIAS_CATEGORIA`. Hoy todas las llamadas usan esos textos fijos; la lista
 * evita que un cambio futuro pase un alias armado con datos de la request.
 *
 * @param {string} alias - Alias de la tabla de categorías en la consulta.
 * @returns {Object} Literal de Sequelize para usar dentro de un where.
 * @throws {Error} ALIAS_NO_PERMITIDO si el alias no está en la lista.
 */
const padreActivo = (alias) => {
  if (!ALIAS_CATEGORIA.includes(alias)) {
    throw new Error("ALIAS_NO_PERMITIDO");
  }

  return literal(
    `(\`${alias}\`.\`padre_id\` IS NULL OR EXISTS (` +
      `SELECT 1 FROM categorias p WHERE p.id = \`${alias}\`.\`padre_id\` AND p.activa = 1))`
  );
};

/**
 * @description Escapa los comodines del `LIKE` de MySQL (`%` y `_`) y la barra
 * invertida, que es su carácter de escape. Sequelize ya escapa el valor contra
 * la inyección (comillas), pero no los comodines: sin esto, buscar `%` devuelve
 * todo y `_` coincide con cualquier carácter.
 *
 * Supone, como todo el escape de Sequelize en MySQL, que el servidor no usa
 * `NO_BACKSLASH_ESCAPES` en `sql_mode` (el modo por defecto no lo incluye). Con
 * ese modo la barra invertida deja de escapar, y no solo fallarían estas
 * búsquedas: las comillas que Sequelize escapa como `\'` cerrarían el texto en
 * cualquier consulta de la API, también en los `replacements`. Es una condición
 * de toda la API, no de esta función.
 *
 * @param {string} texto - Texto que escribió la persona.
 * @returns {string} El texto con `\`, `%` y `_` escapados.
 */
const escaparLike = (texto) => String(texto).replace(/[\\%_]/g, "\\$&");

/**
 * @description Patrón de `LIKE` para "contiene este texto", con los comodines
 * del texto escapados.
 * @param {string} texto - Texto que escribió la persona.
 * @returns {string} `%<texto escapado>%`.
 */
const contiene = (texto) => `%${escaparLike(texto)}%`;

module.exports = { ALIAS_CATEGORIA, padreActivo, escaparLike, contiene };
