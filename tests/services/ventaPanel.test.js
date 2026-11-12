const {
  normalizarVenta,
  validarVentaPanel,
  normalizarClave,
  huellaDeVenta,
} = require("../../src/services/ventaPanel");

/** Venta del panel como llega de la ruta, con envío y datos para limpiar. */
const datos = (cambios = {}) => ({
  items: [
    { varianteId: 7, cantidad: 1 },
    { varianteId: 3, cantidad: 2 },
  ],
  cliente: {
    nombre: "  Ana Gómez ",
    telefono: " 358 400-1122 ",
    email: " Ana@Ejemplo.TEST ",
    documento: "",
  },
  entrega: {
    metodo: "envio",
    zonaEnvioId: 5,
    direccion: {
      calle: " Sobremonte ",
      numero: "1200",
      ciudad: "Río Cuarto",
      provincia: "Córdoba",
      cp: "5800",
    },
  },
  medioPago: "efectivo",
  cobradoEnEfectivo: true,
  totalEsperado: "21800",
  notas: "   ",
  ...cambios,
});

describe("normalizarVenta", () => {
  test("limpia los textos, pasa el email a minúsculas y deja null lo vacío", () => {
    const v = normalizarVenta(datos());

    expect(v.cliente).toEqual({
      nombre: "Ana Gómez",
      telefono: "358 400-1122",
      email: "ana@ejemplo.test",
      documento: null,
    });
    expect(v.notas).toBeNull();
  });

  test("ordena los ítems por variante", () => {
    expect(normalizarVenta(datos()).items).toEqual([
      { varianteId: 3, cantidad: 2 },
      { varianteId: 7, cantidad: 1 },
    ]);
  });

  test("con envío, guarda la dirección limpia; lo que falta queda null", () => {
    expect(normalizarVenta(datos()).entrega).toEqual({
      metodo: "envio",
      zonaEnvioId: 5,
      direccion: {
        calle: "Sobremonte",
        numero: "1200",
        extra: null,
        ciudad: "Río Cuarto",
        provincia: "Córdoba",
        cp: "5800",
      },
    });
  });

  test.each(["retiro", "en_mano"])("con %s, sin dirección ni zona", (metodo) => {
    const v = normalizarVenta(datos({ entrega: { metodo } }));

    expect(v.entrega).toEqual({ metodo, zonaEnvioId: null, direccion: null });
  });

  test.each(["retiro", "en_mano"])(
    "con %s, una dirección es un error: no se descarta en silencio",
    (metodo) => {
      expect(() =>
        normalizarVenta(datos({ entrega: { metodo, direccion: { calle: "Sobremonte" } } }))
      ).toThrow("DATOS_INVALIDOS");
    }
  );

  test.each(["retiro", "en_mano"])("con %s, una zona es un error", (metodo) => {
    expect(() => normalizarVenta(datos({ entrega: { metodo, zonaEnvioId: 5 } }))).toThrow(
      "DATOS_INVALIDOS"
    );
  });

  test.each([undefined, null, "venta"])("sin datos (%p): DATOS_INVALIDOS", (valor) => {
    expect(() => normalizarVenta(valor)).toThrow("DATOS_INVALIDOS");
  });

  test("el total queda con dos decimales", () => {
    expect(normalizarVenta(datos({ totalEsperado: "21800" })).totalEsperado).toBe("21800.00");
    expect(normalizarVenta(datos({ totalEsperado: "21800.5" })).totalEsperado).toBe("21800.50");
  });

  test("cobradoEnEfectivo es true solo con el booleano true", () => {
    expect(normalizarVenta(datos({ cobradoEnEfectivo: true })).cobradoEnEfectivo).toBe(true);
    for (const valor of [undefined, false, "true", 1]) {
      expect(normalizarVenta(datos({ cobradoEnEfectivo: valor })).cobradoEnEfectivo).toBe(false);
    }
  });
});

describe("validarVentaPanel", () => {
  const valida = (cambios) => () => validarVentaPanel(normalizarVenta(datos(cambios)));

  test("una venta completa pasa", () => {
    expect(valida({})).not.toThrow();
    expect(valida({ entrega: { metodo: "en_mano" } })).not.toThrow();
    expect(valida({ medioPago: "transferencia", cobradoEnEfectivo: false })).not.toThrow();
  });

  test.each([
    ["Mercado Pago", { medioPago: "mercadopago", cobradoEnEfectivo: false }],
    ["cobrado con transferencia", { medioPago: "transferencia", cobradoEnEfectivo: true }],
    ["otra entrega", { entrega: { metodo: "correo" } }],
    ["envío sin zona", { entrega: { metodo: "envio", direccion: datos().entrega.direccion } }],
    [
      "envío sin calle",
      { entrega: { metodo: "envio", zonaEnvioId: 5, direccion: { cp: "5800" } } },
    ],
    ["sin nombre", { cliente: { nombre: "  ", telefono: "358" } }],
    ["sin teléfono", { cliente: { nombre: "Ana" } }],
    ["sin ítems", { items: [] }],
    ["una variante que no es un número", { items: [{ varianteId: "abc", cantidad: 1 }] }],
    ["cantidad 0", { items: [{ varianteId: 3, cantidad: 0 }] }],
    ["cantidad con decimales", { items: [{ varianteId: 3, cantidad: 1.5 }] }],
    [
      "una variante repetida",
      {
        items: [
          { varianteId: 3, cantidad: 1 },
          { varianteId: 3, cantidad: 2 },
        ],
      },
    ],
  ])("%s: DATOS_INVALIDOS", (_caso, cambios) => {
    expect(valida(cambios)).toThrow("DATOS_INVALIDOS");
  });
});

describe("normalizarClave", () => {
  test("acepta un UUID y lo pasa a minúsculas", () => {
    expect(normalizarClave(" 3F1C2A9E-5B7D-4E8A-9C21-7D4E5F6A8B90 ")).toBe(
      "3f1c2a9e-5b7d-4e8a-9c21-7d4e5f6a8b90"
    );
  });

  test.each([undefined, null, "", "abc", 123, "3f1c2a9e5b7d4e8a9c217d4e5f6a8b90", "ñ".repeat(36)])(
    "rechaza %p",
    (clave) => {
      expect(() => normalizarClave(clave)).toThrow("DATOS_INVALIDOS");
    }
  );
});

describe("huellaDeVenta", () => {
  const huella = (cambios) => huellaDeVenta(normalizarVenta(datos(cambios)));

  test("es un SHA-256 en hex", () => {
    expect(huella({})).toMatch(/^[0-9a-f]{64}$/);
  });

  test("ancla: la misma venta da siempre esta huella (versión 1)", () => {
    // Si este test falla, cambió el armado de la huella: los reintentos de ventas ya
    // registradas pasarían a dar CLAVE_REUTILIZADA. Hay que subir VERSION_HUELLA y
    // seguir comparando las ventas viejas con la suya, no actualizar este valor.
    expect(huella({})).toBe("e9393d3279070dc71f5764c847af7699b76b0d114ea5b1bda298ec84d092546b");
  });

  test("no cambia con espacios, mayúsculas del email ni el orden de los ítems", () => {
    const otra = datos({
      items: [
        { varianteId: 3, cantidad: 2 },
        { varianteId: 7, cantidad: 1 },
      ],
      cliente: { nombre: "Ana Gómez", telefono: "358 400-1122", email: "ana@ejemplo.test" },
      totalEsperado: "21800.00",
      notas: undefined,
    });

    expect(huellaDeVenta(normalizarVenta(otra))).toBe(huella({}));
  });

  test.each([
    [
      "una cantidad",
      {
        items: [
          { varianteId: 3, cantidad: 1 },
          { varianteId: 7, cantidad: 1 },
        ],
      },
    ],
    ["el nombre", { cliente: { ...datos().cliente, nombre: "Ana Gomez" } }],
    ["el teléfono", { cliente: { ...datos().cliente, telefono: "358 400-1123" } }],
    ["el email", { cliente: { ...datos().cliente, email: "otra@ejemplo.test" } }],
    ["el documento", { cliente: { ...datos().cliente, documento: "30111222" } }],
    ["la entrega", { entrega: { metodo: "en_mano" } }],
    ["la zona", { entrega: { ...datos().entrega, zonaEnvioId: 6 } }],
    [
      "la calle",
      {
        entrega: {
          ...datos().entrega,
          direccion: { ...datos().entrega.direccion, calle: "Colón" },
        },
      },
    ],
    ["el medio de pago", { medioPago: "transferencia", cobradoEnEfectivo: false }],
    ["si se cobró", { cobradoEnEfectivo: false }],
    ["el total", { totalEsperado: "21801" }],
    ["las notas", { notas: "Pasa a la tarde" }],
  ])("cambia si cambia %s", (_campo, cambios) => {
    expect(huella(cambios)).not.toBe(huella({}));
  });
});
