const { manejarErrorHttp } = require("./errorMapper");

/**
 * @description Fabrica un middleware que verifica si el usuario autenticado
 * posee al menos uno de los permisos requeridos.
 * @param {...string} permisosRequeridos - Codigos de permiso (ej: "PRODUCTO_CREAR").
 * @returns {import("express").RequestHandler} Middleware de autorizacion.
 * @throws {Error} SIN_PERMISO
 */
const soloPermisos = (...permisosRequeridos) => {
  return (req, res, next) => {
    const permisosUsuario = req.usuario?.permisos ?? [];
    const tienePermiso = permisosRequeridos.some((p) => permisosUsuario.includes(p));

    if (!tienePermiso) {
      return manejarErrorHttp(new Error("SIN_PERMISO"), res);
    }

    next();
  };
};

module.exports = { soloPermisos };