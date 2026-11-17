const { validationResult, matchedData } = require("express-validator");
const { reglas, reglasCarrito, reglasCotizacion } = require("../../src/validators/ventaPanel");
const { normalizarCarrito, validarCarrito } = require("../../src/services/ventaPanel");

const CLAVE = "3f1c2a9e-5b7d-4e8a-9c21-7d4e5f6a8b90";

/** Venta válida en mano, cobrada en efectivo. */
const cuerpo = (cambios = {}) => ({
  items: [{ varianteId: 1, cantidad: 2 }],
  cliente: { nombre: "Ana Gómez", telefono: "358 400-1122" },
  entrega: { metodo: "en_mano" },
  medioPago: "efectivo",
  cobradoEnEfectivo: true,
  totalEsperado: "15300.00",
  ...cambios,
});

/**
 * @description Corre las reglas sobre una request falsa, como lo haría Express.
 * @param {Object} body - Cuerpo.
 * @param {Object} [headers] - Encabezados (en minúsculas, como los deja Node).
 * @returns {Promise<{errores: Object, datos: Object}>} Errores por campo y lo validado.
 */
const validar = async (body, headers = { "idempotency-key": CLAVE }) => {
  const req = { body, headers };
  for (const regla of reglas) await regla.run(req);
  const errores = {};
  for (const e of validationResult(req).array()) errores[e.path] ??= e.msg;
  return { errores, datos: matchedData(req, { locations: ["body"] }) };
};

describe("validarVentaPanel", () => {
  test("una venta válida pasa", async () => {
    expect((await validar(cuerpo())).errores).toEqual({});
  });

  test("con envío, dirección y email", async () => {
    const { errores } = await validar(
      cuerpo({
        cliente: { nombre: "Ana Gómez", telefono: "358 400-1122", email: "ana@ejemplo.test" },
        entrega: {
          metodo: "envio",
          zonaEnvioId: 5,
          direccion: {
            calle: "Sobremonte",
            numero: "1200",
            ciudad: "Río Cuarto",
            provincia: "Córdoba",
            cp: "5800",
          },
        },
        medioPago: "transferencia",
        cobradoEnEfectivo: undefined,
      })
    );

    expect(errores).toEqual({});
  });

  test("sin email, o con el email vacío, pasa: es opcional", async () => {
    expect((await validar(cuerpo())).errores).toEqual({});
    const conVacio = cuerpo({
      cliente: { nombre: "Ana Gómez", telefono: "358 400-1122", email: "" },
    });
    expect((await validar(conVacio)).errores).toEqual({});
  });

  describe("la clave de idempotencia", () => {
    test.each([
      ["sin el encabezado", {}],
      ["con algo que no es un UUID", { "idempotency-key": "venta-1" }],
    ])("%s: error", async (_caso, headers) => {
      const { errores } = await validar(cuerpo(), headers);

      expect(Object.keys(errores)).toEqual(["idempotency-key"]);
    });
  });

  describe("cobradoEnEfectivo, solo booleanos", () => {
    test.each([true, false])("%p pasa", async (valor) => {
      expect((await validar(cuerpo({ cobradoEnEfectivo: valor }))).errores).toEqual({});
    });

    test.each(["true", 1, "1", "si"])("%p: error", async (valor) => {
      const { errores } = await validar(cuerpo({ cobradoEnEfectivo: valor }));

      expect(Object.keys(errores)).toEqual(["cobradoEnEfectivo"]);
    });
  });

  test.each([
    ["Mercado Pago", { medioPago: "mercadopago" }, "medioPago"],
    ["otra entrega", { entrega: { metodo: "correo" } }, "entrega.metodo"],
    ["sin ítems", { items: [] }, "items"],
    ["cantidad 0", { items: [{ varianteId: 1, cantidad: 0 }] }, "items[0].cantidad"],
    [
      "variante que no es un número",
      { items: [{ varianteId: "x", cantidad: 1 }] },
      "items[0].varianteId",
    ],
    ["sin nombre", { cliente: { telefono: "358 400-1122" } }, "cliente.nombre"],
    [
      "email que no es un email",
      { cliente: { nombre: "Ana", telefono: "358 400-1122", email: "ana" } },
      "cliente.email",
    ],
    ["total que no es un importe", { totalEsperado: "mucho" }, "totalEsperado"],
    ["notas larguísimas", { notas: "x".repeat(501) }, "notas"],
  ])("%s: error en %s", async (_caso, cambios, campo) => {
    const { errores } = await validar(cuerpo(cambios));

    expect(Object.keys(errores)).toContain(campo);
  });

  test("solo lo validado llega al servicio: un precio o un usuario de más no pasan", async () => {
    const { datos } = await validar({
      ...cuerpo(),
      precio: "1.00",
      usuarioId: 99,
      canal: "tienda",
    });

    expect(datos).not.toHaveProperty("precio");
    expect(datos).not.toHaveProperty("usuarioId");
    expect(datos).not.toHaveProperty("canal");
    expect(datos.items).toEqual([{ varianteId: 1, cantidad: 2 }]);
  });
});

describe("validarCotizacionPanel", () => {
  /** Carrito válido para cotizar, en mano y sin medio de pago. */
  const carrito = (cambios = {}) => ({
    items: [{ varianteId: 1, cantidad: 2 }],
    entrega: { metodo: "en_mano" },
    ...cambios,
  });

  /**
   * @description Corre las reglas de la cotización sobre una request falsa.
   * @param {Object} body - Cuerpo.
   * @returns {Promise<{errores: Object, datos: Object}>} Errores por campo y lo validado.
   */
  const validarCotizacion = async (body) => {
    const req = { body, headers: {} };
    for (const regla of reglasCotizacion) await regla.run(req);
    const errores = {};
    for (const e of validationResult(req).array()) errores[e.path] ??= e.msg;
    return { errores, datos: matchedData(req, { locations: ["body"] }) };
  };

  // No alcanza con reglas parecidas: tienen que ser las mismas. Si la cotización
  // tuviera una copia, podría aceptar un carrito que la venta rechaza.
  test("las reglas del carrito son los mismos objetos en la venta y en la cotización", () => {
    expect(reglasCarrito.length).toBeGreaterThan(0);
    for (const regla of reglasCarrito) {
      expect(reglas).toContain(regla);
      expect(reglasCotizacion).toContain(regla);
    }
  });

  test("sin medio de pago pasa, y no pide clave de idempotencia", async () => {
    expect((await validarCotizacion(carrito())).errores).toEqual({});
  });

  test.each(["efectivo", "transferencia"])("con %s pasa", async (medioPago) => {
    expect((await validarCotizacion(carrito({ medioPago }))).errores).toEqual({});
  });

  test.each([
    ["Mercado Pago", { medioPago: "mercadopago" }, "medioPago"],
    ["sin ítems", { items: [] }, "items"],
    ["una cantidad 0", { items: [{ varianteId: 1, cantidad: 0 }] }, "items[0].cantidad"],
    ["otra entrega", { entrega: { metodo: "correo" } }, "entrega.metodo"],
    [
      "una zona que no es un id",
      { entrega: { metodo: "envio", zonaEnvioId: "x" } },
      "entrega.zonaEnvioId",
    ],
  ])("%s: error en %s", async (_caso, cambios, campo) => {
    const { errores } = await validarCotizacion(carrito(cambios));

    expect(Object.keys(errores)).toContain(campo);
  });

  test("solo el carrito llega al controlador: lo demás del cuerpo no pasa", async () => {
    const { datos } = await validarCotizacion({
      ...carrito({ medioPago: "efectivo" }),
      incluirEfectivo: false,
      cobradoEnEfectivo: true,
      totalEsperado: "1.00",
      cliente: { nombre: "Ana", telefono: "358 400-1122" },
    });

    expect(datos).toEqual({
      items: [{ varianteId: 1, cantidad: 2 }],
      entrega: { metodo: "en_mano" },
      medioPago: "efectivo",
    });
  });
});

describe("la venta y la cotización deciden igual sobre el mismo carrito", () => {
  /**
   * @description Pasa un cuerpo por las reglas de una ruta y por el carrito del
   * servicio, y devuelve qué decide: "ok", o el error y su campo.
   * @param {Object[]} reglasDeLaRuta - Reglas de la venta o de la cotización.
   * @param {Object} body - Cuerpo.
   * @returns {Promise<string>} "ok", "400 <campo>" (validación) o "<código> <campo>".
   */
  const decidir = async (reglasDeLaRuta, body) => {
    const req = { body: structuredClone(body), headers: {} };
    for (const regla of reglasDeLaRuta) await regla.run(req);
    const errores = validationResult(req)
      .array()
      .map((e) => e.path)
      .filter((p) => p.startsWith("items") || p.startsWith("entrega"));
    if (errores.length > 0) return `400 ${errores[0]}`;
    try {
      validarCarrito(normalizarCarrito(matchedData(req, { locations: ["body"] })));
      return "ok";
    } catch (error) {
      return `${error.message} ${Object.keys(error.details ?? {})[0]}`;
    }
  };

  const items = [{ varianteId: 1, cantidad: 2 }];

  // Lo que no es del carrito (cliente, medio, total) no entra en la comparación:
  // la cotización no lo pide.
  test.each([
    ["en mano", { items, entrega: { metodo: "en_mano" } }],
    ["envío con zona", { items, entrega: { metodo: "envio", zonaEnvioId: 3 } }],
    ["envío sin zona", { items, entrega: { metodo: "envio" } }],
    ["retiro con zona", { items, entrega: { metodo: "retiro", zonaEnvioId: 3 } }],
    ["retiro con dirección", { items, entrega: { metodo: "retiro", direccion: { calle: "X" } } }],
    ["en mano con dirección", { items, entrega: { metodo: "en_mano", direccion: { cp: "5800" } } }],
    ["una cantidad 0", { items: [{ varianteId: 1, cantidad: 0 }], entrega: { metodo: "en_mano" } }],
  ])("%s", async (_caso, body) => {
    expect(await decidir(reglasCotizacion, body)).toBe(await decidir(reglas, body));
  });
});
