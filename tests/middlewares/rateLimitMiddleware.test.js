const { handlerLimiteSuperado } = require("../../src/middlewares/rateLimitMiddleware");

describe("handlerLimiteSuperado", () => {
  test("responde 429 y deja el código para el registro de peticiones", () => {
    const res = { locals: {}, status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

    handlerLimiteSuperado({}, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: "LIMITE_SUPERADO" });
    expect(res.locals.codigoError).toBe("LIMITE_SUPERADO");
  });
});