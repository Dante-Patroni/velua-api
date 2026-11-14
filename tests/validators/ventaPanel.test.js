const { validationResult, matchedData } = require("express-validator");
const { reglas } = require("../../src/validators/ventaPanel");

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
