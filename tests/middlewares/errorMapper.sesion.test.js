const { manejarErrorHttp } = require("../../src/middlewares/errorMapper");

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
 * @description Todos los códigos que pueden salir de la sesión y del cambio
 * de contraseña. Si se agrega uno nuevo, va acá: si falta en el mapa, cae en 500.
 */
const CODIGOS = {
  NO_AUTORIZADO: 401,
  TOKEN_INVALIDO: 401,
  TOKEN_EXPIRADO: 401,
  SESION_REVOCADA: 401,
  USUARIO_INACTIVO: 403,
  CONTRASENA_ACTUAL_INCORRECTA: 400,
};

describe("errorMapper: códigos de sesión y contraseña", () => {
  test.each(Object.entries(CODIGOS))("%s responde %i y nunca 500", (codigo, status) => {
    const res = crearRes();

    manejarErrorHttp(new Error(codigo), res);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: codigo });
  });
});