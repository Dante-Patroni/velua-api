const AuthController = require("../../src/controllers/AuthController");
const { COOKIE_SESION } = require("../../src/middlewares/crearAuthMiddleware");

/**
 * @description Response falsa con lo que usa el controlador.
 * @returns {Object} res con status, json, end y cookie encadenables.
 */
const crearRes = () => {
  const res = { locals: {} };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  return res;
};

/**
 * @description Error de dominio con details, como los que lanza el servicio.
 * @param {string} codigo - Código de error.
 * @param {Object} details - Mensajes por campo.
 * @returns {Error} Error con details.
 */
const errorDe = (codigo, details) => Object.assign(new Error(codigo), { details });

describe("AuthController.cambiarContrasena", () => {
  const req = {
    usuario: { id: 7 },
    body: { contrasenaActual: "la-actual-123", contrasenaNueva: "la-nueva-12345", id: 99 },
  };

  it("usa el id de la sesión, deja la cookie nueva y responde 204", async () => {
    const servicio = { cambiarContrasena: jest.fn().mockResolvedValue({ token: "token-nuevo" }) };
    const res = crearRes();

    await new AuthController(servicio).cambiarContrasena(req, res);

    expect(servicio.cambiarContrasena).toHaveBeenCalledWith(7, "la-actual-123", "la-nueva-12345");
    expect(res.cookie).toHaveBeenCalledWith(
      COOKIE_SESION,
      "token-nuevo",
      expect.objectContaining({ httpOnly: true })
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.locals.contrasenaActualIncorrecta).toBeUndefined();
  });

  it("marca el intento fallido cuando la actual es incorrecta", async () => {
    const detalle = { contrasenaActual: "La contraseña actual no es correcta." };
    const servicio = {
      cambiarContrasena: jest
        .fn()
        .mockRejectedValue(errorDe("CONTRASENA_ACTUAL_INCORRECTA", detalle)),
    };
    const res = crearRes();

    await new AuthController(servicio).cambiarContrasena(req, res);

    expect(res.locals.contrasenaActualIncorrecta).toBe(true);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "CONTRASENA_ACTUAL_INCORRECTA",
      details: detalle,
    });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("no marca los rechazos de la política", async () => {
    const servicio = {
      cambiarContrasena: jest
        .fn()
        .mockRejectedValue(errorDe("DATOS_INVALIDOS", { contrasenaNueva: "Es muy común." })),
    };
    const res = crearRes();

    await new AuthController(servicio).cambiarContrasena(req, res);

    expect(res.locals.contrasenaActualIncorrecta).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
