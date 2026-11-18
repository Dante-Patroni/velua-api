const CotizacionController = require("../../src/controllers/CotizacionController");

/**
 * @description Response falsa de Express que registra status y json.
 * @returns {Object} Response simulada.
 */
const crearRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("CotizacionController (tienda)", () => {
  // La cotización de la tienda es pública: nada del cuerpo puede pedir el detalle
  // interno de los avisos ni el efectivo. Al cotizador llegan solo tres campos.
  test("al cotizador llegan solo items, zona y medio: lo demás del cuerpo no", async () => {
    const cotizador = { cotizar: jest.fn(async () => ({ avisos: [] })) };
    const res = crearRes();
    const items = [{ varianteId: 1, cantidad: 1 }];

    await new CotizacionController(cotizador).cotizar(
      {
        body: {
          items,
          zonaEnvioId: 2,
          medioPago: "transferencia",
          detalleInterno: true,
          incluirEfectivo: true,
        },
      },
      res
    );

    expect(cotizador.cotizar).toHaveBeenCalledWith({
      items,
      zonaEnvioId: 2,
      medioPago: "transferencia",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
