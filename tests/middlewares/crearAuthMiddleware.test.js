const jwt = require("jsonwebtoken");
const { crearAuthMiddleware, COOKIE_SESION } = require("../../src/middlewares/crearAuthMiddleware");

const SECRETO = "secreto-solo-para-tests";

/**
 * @description Response falsa que registra el status y el cuerpo.
 * @returns {Object} res con status y json encadenables.
 */
const crearRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

/**
 * @description Request con la cookie de sesion.
 * @param {string} token - Token a poner en la cookie.
 * @returns {Object} Request falsa.
 */
const reqCon = (token) => ({ cookies: { [COOKIE_SESION]: token } });

/**
 * @description Firma un token como lo haria el login.
 * @param {Object} contenido - Datos del token.
 * @param {string} [secreto] - Secreto de firma.
 * @returns {string} Token firmado.
 */
const tokenDe = (contenido, secreto = SECRETO) => jwt.sign(contenido, secreto, { expiresIn: "8h" });

/**
 * @description Codifica un objeto en base64url, como las partes de un JWT.
 * @param {Object} objeto - Objeto a codificar.
 * @returns {string} Texto en base64url.
 */
const b64 = (objeto) => Buffer.from(JSON.stringify(objeto)).toString("base64url");

/**
 * @description Usuario como lo devuelve buscarSesion.
 * @param {Object} [cambios] - Campos a reemplazar.
 * @returns {Object} Estado de la sesion.
 */
const sesion = (cambios = {}) => ({
  id: 7,
  rol: "admin",
  activo: true,
  versionSesion: 0,
  ...cambios,
});

describe("authMiddleware", () => {
  let repositorio;
  let middleware;
  let next;

  beforeEach(() => {
    repositorio = { buscarSesion: jest.fn().mockResolvedValue(sesion()) };
    middleware = crearAuthMiddleware({ usuarioRepository: repositorio, jwtSecret: SECRETO });
    next = jest.fn();
  });

  /**
   * @description Corre el middleware con una request.
   * @param {Object} req - Request falsa.
   * @returns {Promise<Object>} La response falsa.
   */
  const correr = async (req) => {
    const res = crearRes();
    await middleware(req, res, next);
    return res;
  };

  /**
   * @description Verifica que se rechazó con el status y el código dados.
   * @param {Object} res - Response falsa.
   * @param {number} status - Status esperado.
   * @param {string} codigo - Código de error esperado.
   * @returns {void}
   */
  const esperarRechazo = (res, status, codigo) => {
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: codigo });
    expect(next).not.toHaveBeenCalled();
  };

  it("deja pasar una sesión válida y arma req.usuario desde la base", async () => {
    const req = reqCon(tokenDe({ id: 7, sv: 0 }));

    await correr(req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(repositorio.buscarSesion).toHaveBeenCalledWith(7);
    expect(req.usuario.id).toBe(7);
    expect(req.usuario.rol).toBe("admin");
    expect(req.usuario.permisos).toEqual(expect.arrayContaining(["CATALOGO_EDITAR"]));
  });

  it("toma el rol y los permisos de la base, no del token", async () => {
    repositorio.buscarSesion.mockResolvedValue(sesion({ rol: "operador" }));
    const req = reqCon(tokenDe({ id: 7, sv: 0, rol: "admin", permisos: ["USUARIOS_GESTIONAR"] }));

    await correr(req);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.usuario.rol).toBe("operador");
    expect(req.usuario.permisos).not.toContain("USUARIOS_GESTIONAR");
  });

  it("rechaza sin cookie con NO_AUTORIZADO y sin consultar la base", async () => {
    const res = await correr({ cookies: {} });

    esperarRechazo(res, 401, "NO_AUTORIZADO");
    expect(repositorio.buscarSesion).not.toHaveBeenCalled();
  });

  it("rechaza si la request no trae cookies", async () => {
    const res = await correr({});

    esperarRechazo(res, 401, "NO_AUTORIZADO");
  });

  it("rechaza un token firmado con otro secreto", async () => {
    const res = await correr(reqCon(tokenDe({ id: 7, sv: 0 }, "otro-secreto")));

    esperarRechazo(res, 401, "TOKEN_INVALIDO");
    expect(repositorio.buscarSesion).not.toHaveBeenCalled();
  });

  it("rechaza un token vencido con TOKEN_EXPIRADO", async () => {
    const vencido = jwt.sign({ id: 7, sv: 0, exp: Math.floor(Date.now() / 1000) - 60 }, SECRETO);

    const res = await correr(reqCon(vencido));

    esperarRechazo(res, 401, "TOKEN_EXPIRADO");
  });

  it("rechaza un token sin firma (alg none)", async () => {
    const sinFirma = `${b64({ alg: "none", typ: "JWT" })}.${b64({ id: 7, sv: 0 })}.`;

    const res = await correr(reqCon(sinFirma));

    esperarRechazo(res, 401, "TOKEN_INVALIDO");
    expect(repositorio.buscarSesion).not.toHaveBeenCalled();
  });

  it("rechaza si el usuario ya no existe", async () => {
    repositorio.buscarSesion.mockResolvedValue(null);

    const res = await correr(reqCon(tokenDe({ id: 7, sv: 0 })));

    esperarRechazo(res, 401, "NO_AUTORIZADO");
  });

  it("rechaza a un usuario desactivado aunque el token siga vigente", async () => {
    repositorio.buscarSesion.mockResolvedValue(sesion({ activo: false }));

    const res = await correr(reqCon(tokenDe({ id: 7, sv: 0 })));

    esperarRechazo(res, 403, "USUARIO_INACTIVO");
  });

  it("rechaza un token de una versión anterior con SESION_REVOCADA", async () => {
    repositorio.buscarSesion.mockResolvedValue(sesion({ versionSesion: 1 }));

    const res = await correr(reqCon(tokenDe({ id: 7, sv: 0 })));

    esperarRechazo(res, 401, "SESION_REVOCADA");
  });

  it("rechaza un token viejo que no trae sv", async () => {
    const res = await correr(reqCon(tokenDe({ id: 7, rol: "admin" })));

    esperarRechazo(res, 401, "SESION_REVOCADA");
  });

  it("falla cerrado si la base no responde", async () => {
    const consola = jest.spyOn(console, "error").mockImplementation(() => {});
    repositorio.buscarSesion.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await correr(reqCon(tokenDe({ id: 7, sv: 0 })));

    esperarRechazo(res, 500, "ERROR_INTERNO");
    consola.mockRestore();
  });
});
