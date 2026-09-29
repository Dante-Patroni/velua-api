/**
 * @description Permisos disponibles en el panel de administración.
 * Se usan como argumento de soloPermisos en las rutas.
 */
const PERMISOS = Object.freeze({
  CATALOGO_VER: "CATALOGO_VER",
  CATALOGO_EDITAR: "CATALOGO_EDITAR",
  PEDIDOS_VER: "PEDIDOS_VER",
  PEDIDOS_GESTIONAR: "PEDIDOS_GESTIONAR",
  PAGOS_DEVOLVER: "PAGOS_DEVOLVER",
  USUARIOS_GESTIONAR: "USUARIOS_GESTIONAR",
  CATALOGO_BORRAR: "CATALOGO_BORRAR",
});

/**
 * @description Permisos que otorga cada rol.
 * El admin puede todo. El operador prepara y despacha, pero no toca dinero
 * ni usuarios: coincide con la regla de la máquina de estados, donde solo
 * el admin puede pasar un pago a devuelto.
 */
const PERMISOS_POR_ROL = Object.freeze({
  admin: Object.values(PERMISOS),
  operador: [
    PERMISOS.CATALOGO_VER,
    PERMISOS.CATALOGO_EDITAR,
    PERMISOS.PEDIDOS_VER,
    PERMISOS.PEDIDOS_GESTIONAR,
  ],
});

/**
 * @description Devuelve los permisos que corresponden a un rol.
 * @param {string} rol - Rol del usuario.
 * @returns {string[]} Lista de permisos. Vacía si el rol no existe.
 */
const permisosDeRol = (rol) => PERMISOS_POR_ROL[rol] ?? [];

module.exports = { PERMISOS, PERMISOS_POR_ROL, permisosDeRol };
