const { estadoVenta, hoyEnArgentina } = require("../../src/services/estadoVenta");

describe("estadoVenta", () => {
  const HOY = "2026-10-17";

  it("sin fecha: se vende normal", () => {
    expect(estadoVenta({ disponibleDesde: null }, HOY)).toEqual({
      estado: "disponible",
      diasRestantes: null,
    });
    expect(estadoVenta({}, HOY)).toEqual({ estado: "disponible", diasRestantes: null });
  });

  it("fecha futura: próximamente, con los días que faltan", () => {
    expect(estadoVenta({ disponibleDesde: "2026-11-05" }, HOY)).toEqual({
      estado: "proximamente",
      diasRestantes: 19,
    });
  });

  it("mañana: falta 1 día", () => {
    expect(estadoVenta({ disponibleDesde: "2026-10-18" }, HOY)).toEqual({
      estado: "proximamente",
      diasRestantes: 1,
    });
  });

  it("el mismo día: ya se vende", () => {
    expect(estadoVenta({ disponibleDesde: HOY }, HOY)).toEqual({
      estado: "disponible",
      diasRestantes: null,
    });
  });

  it("fecha pasada: se vende normal", () => {
    expect(estadoVenta({ disponibleDesde: "2026-09-01" }, HOY)).toEqual({
      estado: "disponible",
      diasRestantes: null,
    });
  });

  it("fecha inválida: no habilita la venta (fail secure)", () => {
    expect(estadoVenta({ disponibleDesde: "2026-02-31" }, HOY)).toEqual({
      estado: "proximamente",
      diasRestantes: null,
    });
    expect(estadoVenta({ disponibleDesde: "mañana" }, HOY)).toEqual({
      estado: "proximamente",
      diasRestantes: null,
    });
  });
});

describe("hoyEnArgentina", () => {
  it("a las 01:00 UTC todavía es el día anterior en Argentina", () => {
    expect(hoyEnArgentina(new Date("2026-10-18T01:00:00Z"))).toBe("2026-10-17");
  });

  it("a las 03:00 UTC ya es el día nuevo en Argentina", () => {
    expect(hoyEnArgentina(new Date("2026-10-18T03:00:00Z"))).toBe("2026-10-18");
  });
});
