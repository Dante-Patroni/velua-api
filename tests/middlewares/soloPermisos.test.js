const jwt = require("jsonwebtoken");
const { soloPermisos } = require("../../src/middlewares/roleMiddleware");
const { crearAuthMiddleware, COOKIE_SESION } = require("../../src/middlewares/crearAuthMiddleware");
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

describe("soloPermisos", () => {
  /**
   * @description Corre soloPermisos(CATALOGO_BORRAR) con un req.usuario dado.
   * @param {Object|undefined} usuario - Lo que dejó el middleware de sesión.
   * @returns {{res: Object, next: jest.Mock}} La response y el next falsos.
   */
  const correr = (usuario) => {
    const res = crearRes();
    const next = jest.fn();
    soloPermisos(PERMISOS.CATALOGO_BORRAR)({ usuario }, res, next);
    return { res, next };
  };

  test("con el permiso, deja pasar", () => {
    const { res, next } = correr({ id: 1, rol: "admin", permisos: [PERMISOS.CATALOGO_BORRAR] });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each([
    ["con otros permisos", { id: 2, rol: "operador", permisos: [PERMISOS.CATALOGO_EDITAR] }],
    ["sin permisos", { id: 3, rol: "cliente", permisos: [] }],
    ["sin la lista de permisos", { id: 4, rol: "cliente" }],
    ["sin usuario en la request", undefined],
  ])("%s, responde 403 SIN_PERMISO y no deja pasar", (_caso, usuario) => {
    const { res, next } = correr(usuario);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "SIN_PERMISO" });
    expect(next).not.toHaveBeenCalled();
  });
});

/**
 * La misma cadena que `proteger` en las rutas del panel: primero la sesión
 * (que arma los permisos desde el rol que está en la base) y después el permiso.
 * Un rol que no está en PERMISOS_POR_ROL no puede pasar ni romper con un 500.
 */
describe("sesión + permiso, con un rol que no existe", () => {
  /**
   * @description Corre la cadena sesión → soloPermisos con un usuario de la base.
   * @param {Object} usuarioEnBase - Lo que devuelve buscarSesion.
   * @returns {Promise<{res: Object, next: jest.Mock}>} La response y el next falsos.
   */
  const correrCadena = async (usuarioEnBase) => {
    const repositorio = { buscarSesion: jest.fn().mockResolvedValue(usuarioEnBase) };
    const cadena = [
      crearAuthMiddleware({ usuarioRepository: repositorio, jwtSecret: SECRETO }),
      soloPermisos(PERMISOS.CATALOGO_BORRAR),
    ];
    const token = jwt.sign({ id: 9, sv: 0 }, SECRETO, { expiresIn: "8h" });
    const req = { cookies: { [COOKIE_SESION]: token } };
    const res = crearRes();
    const next = jest.fn();

    // Cada middleware recibe como next al siguiente; el último, al next de la ruta.
    let indice = 0;
    const siguiente = async () => {
      const middleware = cadena[indice++];
      if (!middleware) return next();
      return middleware(req, res, siguiente);
    };
    await siguiente();

    return { res, next };
  };

  test.each(["cliente", undefined, null, "", "__proto__", "Admin"])(
    "con rol %p, responde 403 SIN_PERMISO, nunca 500, y no llega a la ruta",
    async (rol) => {
      const { res, next } = await correrCadena({ id: 9, rol, activo: true, versionSesion: 0 });

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.status).not.toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "SIN_PERMISO" });
      expect(next).not.toHaveBeenCalled();
    }
  );

  test("con rol admin, la misma cadena deja pasar", async () => {
    const { res, next } = await correrCadena({
      id: 9,
      rol: "admin",
      activo: true,
      versionSesion: 0,
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
