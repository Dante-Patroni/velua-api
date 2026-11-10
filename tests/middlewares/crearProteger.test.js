const jwt = require("jsonwebtoken");
const { crearProteger, permisoDe } = require("../../src/middlewares/crearProteger");
const { crearAuthMiddleware, COOKIE_SESION } = require("../../src/middlewares/crearAuthMiddleware");
const { soloPermisos } = require("../../src/middlewares/roleMiddleware");
const { PERMISOS } = require("../../src/config/permisos");

const SECRETO = "secreto-solo-para-tests";

/**
 * @description Response falsa que registra el status y el cuerpo.
 * @returns {Object} res con status, json y set encadenables.
 */
const crearRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  return res;
};

describe("crearProteger", () => {
  const sesion = jest.fn();
  const proteger = crearProteger({ authMiddleware: sesion });

  test("devuelve la sesión y después el permiso, en ese orden", () => {
    const [primero, segundo] = proteger(PERMISOS.CATALOGO_BORRAR);

    expect(primero).toBe(sesion);
    expect(permisoDe(segundo)).toBe(PERMISOS.CATALOGO_BORRAR);
  });

  test("permisoDe no reconoce lo que no salió de la fábrica", () => {
    expect(permisoDe(soloPermisos(PERMISOS.CATALOGO_BORRAR))).toBeNull();
    expect(permisoDe(sesion)).toBeNull();
    expect(permisoDe(() => {})).toBeNull();
  });

  // Un permiso mal escrito tiene que romper al definir la ruta, al arrancar,
  // no dejarla cerrada para todos (o abierta) sin que nadie se entere.
  test.each(["CATALOGO", "catalogo_ver", "", undefined, null, "__proto__"])(
    "con el permiso %p, falla al armar la ruta",
    (permiso) => {
      expect(() => proteger(permiso)).toThrow(/proteger: el permiso .* no existe/);
    }
  );

  test("sin middleware de sesión, no se puede fabricar", () => {
    expect(() => crearProteger({})).toThrow("crearProteger necesita el middleware de sesión");
    expect(() => crearProteger()).toThrow("crearProteger necesita el middleware de sesión");
  });
});

/**
 * La composición real que corre en producción, con la sesión de verdad y solo el
 * repositorio falso: es la misma función `crearProteger` que usa proteger.js.
 */
describe("proteger con la sesión real", () => {
  /**
   * @description Corre proteger(CATALOGO_BORRAR) como lo haría Express.
   * @param {Object} usuarioEnBase - Lo que devuelve buscarSesion.
   * @returns {Promise<{res: Object, next: jest.Mock}>} La response y el next falsos.
   */
  const correr = async (usuarioEnBase) => {
    const repositorio = { buscarSesion: jest.fn().mockResolvedValue(usuarioEnBase) };
    const proteger = crearProteger({
      authMiddleware: crearAuthMiddleware({ usuarioRepository: repositorio, jwtSecret: SECRETO }),
    });
    const cadena = proteger(PERMISOS.CATALOGO_BORRAR);
    const req = { cookies: { [COOKIE_SESION]: jwt.sign({ id: 9, sv: 0 }, SECRETO) } };
    const res = crearRes();
    const next = jest.fn();

    let indice = 0;
    const siguiente = async () => {
      const middleware = cadena[indice++];
      if (!middleware) return next();
      return middleware(req, res, siguiente);
    };
    await siguiente();
    return { res, next };
  };

  test("el admin pasa", async () => {
    const { res, next } = await correr({ id: 9, rol: "admin", activo: true, versionSesion: 0 });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each(["operador", "cliente", undefined, "__proto__", "Admin"])(
    "con rol %p, 403 SIN_PERMISO y no llega a la ruta",
    async (rol) => {
      const { res, next } = await correr({ id: 9, rol, activo: true, versionSesion: 0 });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "SIN_PERMISO" });
      expect(next).not.toHaveBeenCalled();
    }
  );
});
