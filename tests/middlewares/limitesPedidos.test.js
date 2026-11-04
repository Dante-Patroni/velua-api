const { limitadorAvisos, limitadorPedidos } = require("../../src/middlewares/rateLimitMiddleware");
const router = require("../../src/routes/pedidoRoutes");

/**
 * @description Middlewares de una ruta del router, en orden.
 * @param {string} metodo - Método HTTP en minúsculas.
 * @param {string} ruta - Ruta tal como se registró.
 * @returns {Function[]} Los handlers de la ruta.
 */
const handlersDe = (metodo, ruta) => {
  const capa = router.stack.find((c) => c.route?.path === ruta && c.route.methods[metodo]);
  return capa.route.stack.map((s) => s.handle);
};

describe("límites de las rutas de pedidos", () => {
  test('"Ya transferí" usa su propio límite, no el de crear y pagar', () => {
    const handlers = handlersDe("post", "/pedidos/:numero/comprobante");

    expect(handlers).toContain(limitadorAvisos);
    expect(handlers).not.toContain(limitadorPedidos);
  });

  test("crear y pagar siguen compartiendo el límite de pedidos", () => {
    expect(handlersDe("post", "/pedidos")).toContain(limitadorPedidos);
    expect(handlersDe("post", "/pedidos/:numero/pago")).toContain(limitadorPedidos);
  });

  test("son dos contadores distintos", () => {
    expect(limitadorAvisos).not.toBe(limitadorPedidos);
  });
});
