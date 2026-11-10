const { soloPermisos } = require("./roleMiddleware");
const { PERMISOS } = require("../config/permisos");

/**
 * Middlewares de permiso que salieron de la fábrica, con el permiso que exigen.
 * No se exporta: nadie de afuera puede registrar una función como "protegida".
 * Es un WeakMap (y no una propiedad en la función) para que la marca no se pueda
 * leer ni copiar desde otro módulo; y no retiene memoria si el middleware se libera.
 */
const fabricados = new WeakMap();

const PERMISOS_VALIDOS = new Set(Object.values(PERMISOS));

/**
 * @description Fabrica `proteger`: la cadena sesión → permiso de las rutas del
 * panel. Es el único lugar donde se arma; las rutas no combinan authMiddleware y
 * soloPermisos a mano. Se inyecta el middleware de sesión para poder probar la
 * composición real sin base de datos.
 * @param {Object} deps - Dependencias.
 * @param {import("express").RequestHandler} deps.authMiddleware - Middleware de sesión.
 * @returns {(permiso: string) => import("express").RequestHandler[]} proteger.
 * @throws {Error} Si falta el middleware de sesión.
 */
const crearProteger = ({ authMiddleware } = {}) => {
  if (typeof authMiddleware !== "function") {
    throw new Error("crearProteger necesita el middleware de sesión");
  }

  /**
   * @description Sesión válida y después el permiso indicado, en ese orden.
   * @param {string} permiso - Uno de PERMISOS.
   * @returns {import("express").RequestHandler[]} [sesión, permiso].
   * @throws {Error} Si el permiso no existe: un nombre mal escrito tiene que
   *   romper al arrancar, no dejar la ruta cerrada (o abierta) en silencio.
   */
  return (permiso) => {
    if (!PERMISOS_VALIDOS.has(permiso)) {
      throw new Error(`proteger: el permiso ${String(permiso)} no existe`);
    }
    const dePermiso = soloPermisos(permiso);
    fabricados.set(dePermiso, permiso);
    return [authMiddleware, dePermiso];
  };
};

/**
 * @description Qué permiso exige un middleware, si lo fabricó `proteger`. Es la
 * única lectura de la marca; sirve para que los tests verifiquen las rutas reales.
 * @param {Function} middleware - Un middleware cualquiera.
 * @returns {string|null} El permiso, o null si no salió de la fábrica.
 */
const permisoDe = (middleware) => fabricados.get(middleware) ?? null;

module.exports = { crearProteger, permisoDe };
