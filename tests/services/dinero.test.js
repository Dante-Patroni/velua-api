const { aCentavos, aImporte, porcentajeDe, redondearAlPeso } = require("../../src/utils/dinero");

describe("aCentavos", () => {
  it("convierte un importe con dos decimales", () => {
    expect(aCentavos("8500.00")).toBe(850000);
    expect(aCentavos("1234.56")).toBe(123456);
  });

  it("completa los decimales que faltan", () => {
    expect(aCentavos("8500")).toBe(850000);
    expect(aCentavos("8500.5")).toBe(850050);
  });

  it("acepta la coma decimal", () => {
    expect(aCentavos("8500,50")).toBe(850050);
  });

  it("maneja el centavo suelto", () => {
    expect(aCentavos("0.01")).toBe(1);
    expect(aCentavos("0")).toBe(0);
  });

  it("rechaza lo que no es un importe", () => {
    expect(() => aCentavos("ocho mil")).toThrow("DATOS_INVALIDOS");
    expect(() => aCentavos("")).toThrow("DATOS_INVALIDOS");
    expect(() => aCentavos(null)).toThrow("DATOS_INVALIDOS");
  });

  it("rechaza más de dos decimales", () => {
    expect(() => aCentavos("8500.123")).toThrow("DATOS_INVALIDOS");
  });
});

describe("aImporte", () => {
  it("vuelve a la cadena del contrato", () => {
    expect(aImporte(850000)).toBe("8500.00");
    expect(aImporte(123456)).toBe("1234.56");
    expect(aImporte(1)).toBe("0.01");
    expect(aImporte(0)).toBe("0.00");
  });

  it("ida y vuelta sin pérdida", () => {
    for (const importe of ["8500.00", "0.01", "1234.56", "9999999.99"]) {
      expect(aImporte(aCentavos(importe))).toBe(importe);
    }
  });
});

describe("operaciones en centavos", () => {
  it("suma sin el error del punto flotante", () => {
    // 0.1 + 0.2 en punto flotante da 0.30000000000000004
    expect(aImporte(aCentavos("0.10") + aCentavos("0.20"))).toBe("0.30");
  });

  it("multiplica sin acumular error", () => {
    const linea = aCentavos("333.33") * 3;

    expect(aImporte(linea)).toBe("999.99");
  });
});

describe("porcentajeDe", () => {
  it("calcula porcentajes exactos", () => {
    expect(aImporte(porcentajeDe(aCentavos("8500.00"), 10))).toBe("850.00");
    expect(aImporte(porcentajeDe(aCentavos("8500.00"), 15))).toBe("1275.00");
  });

  it("redondea al centavo más cercano", () => {
    expect(aImporte(porcentajeDe(aCentavos("333.33"), 10))).toBe("33.33");
    expect(aImporte(porcentajeDe(aCentavos("0.05"), 50))).toBe("0.03");
  });

  it("devuelve cero con porcentaje cero", () => {
    expect(porcentajeDe(aCentavos("8500.00"), 0)).toBe(0);
  });
});

describe("redondearAlPeso", () => {
  it("redondea hacia abajo antes de la mitad", () => {
    expect(aImporte(redondearAlPeso(aCentavos("8500.49")))).toBe("8500.00");
  });

  it("redondea hacia arriba desde la mitad", () => {
    expect(aImporte(redondearAlPeso(aCentavos("8500.50")))).toBe("8501.00");
  });

  it("deja igual un monto que ya es entero", () => {
    expect(aImporte(redondearAlPeso(aCentavos("8500.00")))).toBe("8500.00");
  });

  it("redondear una vez al final no es lo mismo que redondear en cada paso", () => {
    // Tres montos que por separado redondean hacia abajo, pero juntos suben
    const a = aCentavos("10.40");
    const b = aCentavos("10.40");
    const c = aCentavos("10.40");

    const alFinal = redondearAlPeso(a + b + c);
    const enCadaPaso = redondearAlPeso(a) + redondearAlPeso(b) + redondearAlPeso(c);

    expect(aImporte(alFinal)).toBe("31.00");
    expect(aImporte(enCadaPaso)).toBe("30.00");
    expect(alFinal).not.toBe(enCadaPaso);
  });
});
