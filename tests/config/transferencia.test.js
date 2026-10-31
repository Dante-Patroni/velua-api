const { leerConfigTransferencia } = require("../../src/config/transferencia");

/** Configuración válida, con lo que se cambie en cada test. */
const entorno = (cambios = {}) => ({
  TRANSFERENCIA_ALIAS: "velua.prueba.mp",
  TRANSFERENCIA_CBU: "0000000000000000000000",
  TRANSFERENCIA_TITULAR: "Tienda de Prueba",
  DESCUENTO_TRANSFERENCIA: "10",
  ...cambios,
});

describe("leerConfigTransferencia", () => {
  it("con datos válidos habilita la transferencia", () => {
    expect(leerConfigTransferencia(entorno())).toEqual({
      habilitada: true,
      motivo: null,
      datos: {
        alias: "velua.prueba.mp",
        cbu: "0000000000000000000000",
        titular: "Tienda de Prueba",
      },
      descuento: 10,
    });
  });

  it("sin ningún dato bancario la deshabilita, sin romper nada", () => {
    expect(leerConfigTransferencia({})).toMatchObject({
      habilitada: false,
      datos: null,
      descuento: 0,
    });
  });

  it.each([
    ["alias corto", { TRANSFERENCIA_ALIAS: "corto" }, "TRANSFERENCIA_ALIAS"],
    ["alias con espacio", { TRANSFERENCIA_ALIAS: "velua prueba" }, "TRANSFERENCIA_ALIAS"],
    ["CBU de 21 dígitos", { TRANSFERENCIA_CBU: "000000000000000000000" }, "TRANSFERENCIA_CBU"],
    ["CBU con letras", { TRANSFERENCIA_CBU: "00000000000000000000AB" }, "TRANSFERENCIA_CBU"],
    ["titular vacío", { TRANSFERENCIA_TITULAR: "   " }, "TRANSFERENCIA_TITULAR"],
    ["falta un dato", { TRANSFERENCIA_CBU: undefined }, "TRANSFERENCIA_CBU"],
  ])("%s la deshabilita y nombra la variable", (_caso, cambios, variable) => {
    const config = leerConfigTransferencia(entorno(cambios));

    expect(config.habilitada).toBe(false);
    expect(config.motivo).toContain(variable);
  });

  it("el motivo nunca incluye el valor configurado", () => {
    const config = leerConfigTransferencia(
      entorno({ TRANSFERENCIA_CBU: "1234567890123456789012345" })
    );

    expect(config.motivo).not.toContain("1234567890");
  });

  it.each(["", "0", "20"])("acepta el descuento %j", (valor) => {
    expect(leerConfigTransferencia(entorno({ DESCUENTO_TRANSFERENCIA: valor })).habilitada).toBe(
      true
    );
  });

  it.each(["21", "100", "-5", "10.5", "abc", "1e1"])("rechaza el descuento %j", (valor) => {
    const config = leerConfigTransferencia(entorno({ DESCUENTO_TRANSFERENCIA: valor }));

    expect(config).toMatchObject({ habilitada: false, descuento: 0 });
    expect(config.motivo).toContain("DESCUENTO_TRANSFERENCIA");
  });

  it("la configuración no se puede modificar después de leerla", () => {
    const config = leerConfigTransferencia(entorno());

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.datos)).toBe(true);
  });
});
