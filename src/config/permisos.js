/**
 * @description Permisos disponibles en el panel de administración.
 * Se usan como argumento de soloPermisos en las rutas.
 */
const PERMISOS = Object.freeze({
  CATALOGO_VER: "CATALOGO_VER",
  CATALOGO_EDITAR: "CATALOGO_EDITAR",
  PEDIDOS_VER: "PEDIDOS_VER",
  PEDIDOS_GESTIONAR: "PEDIDOS_GESTIONAR",
  PEDIDOS_CANCELAR: "PEDIDOS_CANCELAR",
  PAGOS_DEVOLVER: "PAGOS_DEVOLVER",
  USUARIOS_GESTIONAR: "USUARIOS_GESTIONAR",
  CATALOGO_BORRAR: "CATALOGO_BORRAR",
});

/**
 * @description Permisos que otorga cada rol.
 * El admin puede todo. El operador prepara y despacha, pero no cancela, no toca
 * dinero ni usuarios: cancelar devuelve stock y le avisa a la clienta, y es una
 * decisión de la dueña. Coincide con la máquina de estados, donde solo el admin
 * puede cancelar un pedido o pasar un pago a devuelto.
 *
 * Las listas están congeladas: nadie puede sumarle un permiso a un rol en tiempo
 * de ejecución.
 */
const PERMISOS_POR_ROL = Object.freeze({
  admin: Object.freeze(Object.values(PERMISOS)),
  operador: Object.freeze([
    PERMISOS.CATALOGO_VER,
    PERMISOS.CATALOGO_EDITAR,
    PERMISOS.PEDIDOS_VER,
    PERMISOS.PEDIDOS_GESTIONAR,
  ]),
});

/**
 * @description Devuelve los permisos que corresponden a un rol.
 * Usa Object.hasOwn para que nombres heredados como "__proto__" o "toString"
 * no devuelvan algo que no es una lista.
 * @param {string} rol - Rol del usuario.
 * @returns {readonly string[]} Lista de permisos. Vacía si el rol no existe.
 */
const permisosDeRol = (rol) =>
  Object.hasOwn(PERMISOS_POR_ROL, rol) ? PERMISOS_POR_ROL[rol] : [];

module.exports = { PERMISOS, PERMISOS_POR_ROL, permisosDeRol };
