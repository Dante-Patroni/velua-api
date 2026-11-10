const { leerConfigEfectivo, avisarSiEstaDeshabilitado } = require("../../src/config/efectivo");

describe("leerConfigEfectivo", () => {
  it("con un entero válido habilita el efectivo con ese descuento", () => {
    expect(leerConfigEfectivo({ DESCUENTO_EFECTIVO: "10" })).toEqual({
      habilitado: true,
      motivo: null,
      descuento: 10,
    });
  });

  it("ausente o vacío: habilitado, sin descuento", () => {
    for (const env of [{}, { DESCUENTO_EFECTIVO: "" }, { DESCUENTO_EFECTIVO: "  " }]) {
      expect(leerConfigEfectivo(env)).toEqual({ habilitado: true, motivo: null, descuento: 0 });
    }
  });

  it("acepta los extremos, 0 y 20", () => {
    expect(leerConfigEfectivo({ DESCUENTO_EFECTIVO: "0" }).descuento).toBe(0);
    expect(leerConfigEfectivo({ DESCUENTO_EFECTIVO: "20" }).descuento).toBe(20);
  });

  // Falla cerrado: un valor inválido no se toma como 0. Leído como 0 %, la dueña
  // cobraría de más sin enterarse; deshabilitado, el error se ve.
  it.each(["abc", "21", "-1", "5.5", "10.5", "10%", "1e1", "100"])(
    "con %p deshabilita el efectivo",
    (valor) => {
      expect(leerConfigEfectivo({ DESCUENTO_EFECTIVO: valor })).toEqual({
        habilitado: false,
        motivo: "DESCUENTO_EFECTIVO tiene que ser un entero de 0 a 20",
        descuento: 0,
      });
    }
  );

  it("devuelve la configuración congelada", () => {
    expect(Object.isFrozen(leerConfigEfectivo({ DESCUENTO_EFECTIVO: "10" }))).toBe(true);
    expect(Object.isFrozen(leerConfigEfectivo({ DESCUENTO_EFECTIVO: "x" }))).toBe(true);
  });
});

describe("avisarSiEstaDeshabilitado", () => {
  const logger = () => ({ warn: jest.fn() });

  it("deshabilitado, deja el motivo en el log", () => {
    const log = logger();

    avisarSiEstaDeshabilitado(leerConfigEfectivo({ DESCUENTO_EFECTIVO: "35" }), log);

    expect(log.warn).toHaveBeenCalledWith(
      "[efectivo] deshabilitado: DESCUENTO_EFECTIVO tiene que ser un entero de 0 a 20"
    );
  });

  it("el log nunca incluye el valor configurado", () => {
    const log = logger();

    avisarSiEstaDeshabilitado(leerConfigEfectivo({ DESCUENTO_EFECTIVO: "10.5" }), log);

    expect(log.warn.mock.calls[0][0]).not.toContain("10.5");
  });

  it("habilitado, no escribe nada", () => {
    const log = logger();

    avisarSiEstaDeshabilitado(leerConfigEfectivo({ DESCUENTO_EFECTIVO: "10" }), log);

    expect(log.warn).not.toHaveBeenCalled();
  });
});
