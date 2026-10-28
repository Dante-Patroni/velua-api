const { PERMISOS, PERMISOS_POR_ROL, permisosDeRol } = require("../../src/config/permisos");

describe("permisos", () => {
  test("cada permiso vale lo mismo que su nombre", () => {
    for (const [clave, valor] of Object.entries(PERMISOS)) {
      expect(valor).toBe(clave);
    }
  });

  test("el admin tiene todos los permisos, también cancelar", () => {
    expect([...permisosDeRol("admin")].sort()).toEqual(Object.values(PERMISOS).sort());
    expect(permisosDeRol("admin")).toContain(PERMISOS.PEDIDOS_CANCELAR);
  });

  test("el operador prepara y despacha, pero no cancela", () => {
    const operador = permisosDeRol("operador");

    expect(operador).toContain(PERMISOS.PEDIDOS_GESTIONAR);
    expect(operador).not.toContain(PERMISOS.PEDIDOS_CANCELAR);
  });

  test("el operador no toca dinero, usuarios ni borrados", () => {
    const operador = permisosDeRol("operador");

    for (const permiso of [
      PERMISOS.PAGOS_DEVOLVER,
      PERMISOS.USUARIOS_GESTIONAR,
      PERMISOS.CATALOGO_BORRAR,
    ]) {
      expect(operador).not.toContain(permiso);
    }
  });

  test("un rol que no existe no tiene permisos", () => {
    expect(permisosDeRol("cliente")).toEqual([]);
    expect(permisosDeRol(undefined)).toEqual([]);
  });

  test("los nombres heredados del prototipo no son roles", () => {
    for (const rol of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(permisosDeRol(rol)).toEqual([]);
    }
  });

  test("nadie puede sumarle un permiso a un rol en tiempo de ejecución", () => {
    expect(() => permisosDeRol("operador").push(PERMISOS.PEDIDOS_CANCELAR)).toThrow(TypeError);
    expect(() => PERMISOS_POR_ROL.admin.pop()).toThrow(TypeError);
    expect(permisosDeRol("operador")).not.toContain(PERMISOS.PEDIDOS_CANCELAR);
  });
});