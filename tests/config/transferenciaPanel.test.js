const {
  leerConfigTransferencia,
  leerTransferenciaEnPanel,
  avisarSiEstaDeshabilitadaEnPanel,
} = require("../../src/config/transferencia");

/** Datos bancarios de prueba, inventados. */
const BANCO = {
  TRANSFERENCIA_ALIAS: "velua.prueba.mp",
  TRANSFERENCIA_CBU: "0000000000000000000000",
  TRANSFERENCIA_TITULAR: "Tienda de Prueba",
};

const MOTIVO = "DESCUENTO_TRANSFERENCIA tiene que ser un entero de 0 a 20";

describe("leerTransferenciaEnPanel", () => {
  // En una venta en persona, la dueña pasa los datos bancarios ella misma: que
  // falten en Railway no puede impedir registrar la venta.
  it("sin datos bancarios, el panel la habilita igual (y la tienda no)", () => {
    const env = { DESCUENTO_TRANSFERENCIA: "10" };

    expect(leerTransferenciaEnPanel(env)).toEqual({
      habilitada: true,
      motivo: null,
      descuento: 10,
    });
    expect(leerConfigTransferencia(env)).toEqual({
      habilitada: false,
      motivo: "Sin datos bancarios",
      datos: null,
      descuento: 0,
    });
  });

  it("sin descuento configurado, habilitada con 0", () => {
    for (const env of [{}, { DESCUENTO_TRANSFERENCIA: "" }, { DESCUENTO_TRANSFERENCIA: " " }]) {
      expect(leerTransferenciaEnPanel(env)).toEqual({
        habilitada: true,
        motivo: null,
        descuento: 0,
      });
    }
  });

  // Falla cerrado: el descuento es plata. Inválido, apaga la transferencia del
  // panel en vez de tomarlo como 0, con o sin datos bancarios.
  it.each(["abc", "21", "-1", "5.5", "10%", "1e1"])(
    "con DESCUENTO_TRANSFERENCIA=%p la deshabilita",
    (valor) => {
      for (const env of [
        { DESCUENTO_TRANSFERENCIA: valor },
        { ...BANCO, DESCUENTO_TRANSFERENCIA: valor },
      ]) {
        expect(leerTransferenciaEnPanel(env)).toEqual({
          habilitada: false,
          motivo: MOTIVO,
          descuento: 0,
        });
      }
    }
  );

  // Una sola regla para el descuento: con datos bancarios válidos, la tienda y el
  // panel tienen que estar de acuerdo en si el descuento sirve y cuánto vale.
  it.each(["", "0", "10", "20", "21", "abc", "5.5"])(
    "con datos bancarios y DESCUENTO_TRANSFERENCIA=%p, tienda y panel coinciden",
    (valor) => {
      const env = { ...BANCO, DESCUENTO_TRANSFERENCIA: valor };
      const tienda = leerConfigTransferencia(env);
      const panel = leerTransferenciaEnPanel(env);

      expect(panel.habilitada).toBe(tienda.habilitada);
      expect(panel.descuento).toBe(tienda.descuento);
    }
  );

  it("la configuración no se puede modificar", () => {
    expect(Object.isFrozen(leerTransferenciaEnPanel({}))).toBe(true);
    expect(Object.isFrozen(leerTransferenciaEnPanel({ DESCUENTO_TRANSFERENCIA: "x" }))).toBe(true);
  });
});

describe("avisarSiEstaDeshabilitadaEnPanel", () => {
  it("deshabilitada, deja el motivo en el log, sin el valor", () => {
    const logger = { warn: jest.fn() };

    avisarSiEstaDeshabilitadaEnPanel(
      leerTransferenciaEnPanel({ DESCUENTO_TRANSFERENCIA: "15.5" }),
      logger
    );

    expect(logger.warn).toHaveBeenCalledWith(
      `[transferencia] deshabilitada en el panel: ${MOTIVO}`
    );
    expect(logger.warn.mock.calls[0][0]).not.toContain("15.5");
  });

  it("habilitada, no escribe nada", () => {
    const logger = { warn: jest.fn() };

    avisarSiEstaDeshabilitadaEnPanel(leerTransferenciaEnPanel({}), logger);

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
