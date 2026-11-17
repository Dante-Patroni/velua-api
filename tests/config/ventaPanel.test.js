const { armarConfigVentaPanel } = require("../../src/config/ventaPanel");

const efectivo = { habilitado: true, motivo: null, descuento: 10 };
const transferencia = { habilitada: false, motivo: "Sin datos bancarios", descuento: 0 };

describe("armarConfigVentaPanel", () => {
  test("toma cada medio de su configuración", () => {
    expect(armarConfigVentaPanel(efectivo, transferencia, { ENVIO_GRATIS_DESDE: "50000" })).toEqual(
      {
        umbralEnvioGratis: "50000",
        descuentoEfectivo: 10,
        descuentoTransferencia: 0,
        mediosDisponibles: { efectivo: true, transferencia: false },
      }
    );
  });

  test("sin umbral de envío gratis, null", () => {
    expect(armarConfigVentaPanel(efectivo, transferencia, {}).umbralEnvioGratis).toBeNull();
  });

  // Object.freeze es superficial: sin el segundo freeze, mediosDisponibles se podría
  // cambiar en memoria y habilitar un medio que la configuración deshabilitó.
  test("queda congelada en los dos niveles", () => {
    const config = armarConfigVentaPanel(efectivo, transferencia, {});

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.mediosDisponibles)).toBe(true);
  });
});
