/**
 * @description Busca una clave en una tabla de valores (un objeto literal usado
 * como diccionario) **solo entre sus propiedades propias**.
 *
 * `tabla[clave]` también encuentra lo heredado de `Object.prototype`: con
 * `clave = "__proto__"` devuelve `Object.prototype`, y con `"constructor"` o
 * `"toString"`, funciones. Las tres son "truthy", así que un `tabla[clave] || defecto`
 * no cae al valor por defecto y sigue con un valor que nadie escribió. Cuando la
 * clave viene de afuera (una request, el mensaje de un error, la respuesta de un
 * proveedor), se busca con esta función. Es el mismo criterio que ya usan
 * `permisosDe` (config/permisos.js) y las transiciones del pedido.
 *
 * @param {Object} tabla - Diccionario de valores conocidos.
 * @param {*} clave - Clave a buscar. Si no es texto, no se busca.
 * @returns {*} El valor propio de esa clave, o `undefined` si no está.
 */
const entradaPropia = (tabla, clave) =>
  typeof clave === "string" && Object.hasOwn(tabla, clave) ? tabla[clave] : undefined;

module.exports = { entradaPropia };
