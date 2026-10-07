const {
  TRANSICIONES_PAGO,
  TRANSICIONES_PREPARACION,
  ESTADOS_PAGO_VENCIBLES,
  esTransicionValida,
  validarTransicion,
} = require("../../src/services/transicionesPedido");

/**
 * Todas las combinaciones posibles de una tabla, para recorrerlas en los tests.
 */
const todasLasCombinaciones = (tabla) => {
  const estados = Object.keys(tabla);
  return estados.flatMap((desde) => estados.map((hacia) => [desde, hacia]));
};

describe("transiciones de pago", () => {
  it.each([
    ["pendiente", "aprobado"],
    ["pendiente", "rechazado"],
    ["pendiente", "cancelado"],
    ["rechazado", "pendiente"],
    ["rechazado", "aprobado"],
    ["rechazado", "cancelado"],
    ["aprobado", "devuelto"],
  ])("permite %s → %s", (desde, hacia) => {
    expect(esTransicionValida("pago", desde, hacia)).toBe(true);
  });

  it("rechaza todas las demás combinaciones", () => {
    const legales = 7;
    const ilegales = todasLasCombinaciones(TRANSICIONES_PAGO).filter(
      ([desde, hacia]) => !esTransicionValida("pago", desde, hacia)
    );

    // 5 estados × 5 = 25 combinaciones, de las que solo 7 son legales
    expect(ilegales).toHaveLength(25 - legales);
  });

  it.each(["cancelado", "devuelto"])("%s es terminal", (estado) => {
    expect(TRANSICIONES_PAGO[estado]).toEqual([]);
  });

  it("no permite aprobar un pedido ya cancelado", () => {
    // Es el caso del pago que llega tarde: lo resuelve el webhook, no la tabla
    expect(esTransicionValida("pago", "cancelado", "aprobado")).toBe(false);
  });
});

describe("transiciones de preparación", () => {
  it.each([
    ["nuevo", "en_preparacion"],
    ["en_preparacion", "enviado"],
    ["enviado", "entregado"],
    ["nuevo", "cancelado"],
    ["en_preparacion", "cancelado"],
    ["enviado", "cancelado"],
  ])("permite %s → %s", (desde, hacia) => {
    expect(esTransicionValida("preparacion", desde, hacia)).toBe(true);
  });

  it("no permite cancelar un pedido entregado", () => {
    expect(esTransicionValida("preparacion", "entregado", "cancelado")).toBe(false);
  });

  it("no permite saltear pasos", () => {
    expect(esTransicionValida("preparacion", "nuevo", "enviado")).toBe(false);
    expect(esTransicionValida("preparacion", "nuevo", "entregado")).toBe(false);
  });

  it("no permite volver atrás", () => {
    expect(esTransicionValida("preparacion", "enviado", "en_preparacion")).toBe(false);
  });

  it("rechaza todas las demás combinaciones", () => {
    const legales = 6;
    const ilegales = todasLasCombinaciones(TRANSICIONES_PREPARACION).filter(
      ([desde, hacia]) => !esTransicionValida("preparacion", desde, hacia)
    );

    expect(ilegales).toHaveLength(25 - legales);
  });
});

describe("esTransicionValida", () => {
  it("devuelve false con un estado que no existe", () => {
    expect(esTransicionValida("pago", "inventado", "aprobado")).toBe(false);
    expect(esTransicionValida("pago", "pendiente", "inventado")).toBe(false);
  });

  it("no se deja engañar por propiedades heredadas", () => {
    // "constructor" existe en cualquier objeto: sin Object.hasOwn daría un falso positivo
    expect(esTransicionValida("pago", "constructor", "aprobado")).toBe(false);
  });

  it("lanza si el campo no existe, porque es un error de programación", () => {
    expect(() => esTransicionValida("envio", "nuevo", "enviado")).toThrow(
      "Campo de estado desconocido"
    );
  });
});

describe("validarTransicion", () => {
  it("no hace nada si la transición es legal", () => {
    expect(() => validarTransicion("pago", "pendiente", "cancelado")).not.toThrow();
  });

  it("lanza TRANSICION_INVALIDA si no lo es", () => {
    expect(() => validarTransicion("pago", "cancelado", "pendiente")).toThrow(
      "TRANSICION_INVALIDA"
    );
  });
});

describe("estados vencibles", () => {
  it("son pendiente y rechazado", () => {
    expect(ESTADOS_PAGO_VENCIBLES).toEqual(["pendiente", "rechazado"]);
  });

  it("todos pueden pasar a cancelado", () => {
    for (const estado of ESTADOS_PAGO_VENCIBLES) {
      expect(esTransicionValida("pago", estado, "cancelado")).toBe(true);
    }
  });
});
