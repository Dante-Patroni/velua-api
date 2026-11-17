const VentaPanelController = require("../../src/controllers/VentaPanelController");
const { reglas, reglasCotizacion } = require("../../src/validators/ventaPanel");

const CLAVE = "3f1c2a9e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const VENTA = {
  id: 3,
  numero: "VEL-ABC234",
  total: "15300.00",
  estadoPago: "aprobado",
  medioPago: "efectivo",
};

/**
 * @description Request como la deja la ruta: validada, con la sesión y el encabezado.
 * @param {Object} [body] - Cuerpo (puede traer campos de más).
 * @returns {Promise<Object>} La request, con las reglas ya corridas.
 */
const armarReq = async (body = {}) => {
  const headers = { "idempotency-key": CLAVE };
  const req = {
    body: {
      items: [{ varianteId: 1, cantidad: 2 }],
      cliente: { nombre: "Ana Gómez", telefono: "358 400-1122" },
      entrega: { metodo: "en_mano" },
      medioPago: "efectivo",
      cobradoEnEfectivo: true,
      totalEsperado: "15300.00",
      ...body,
    },
    headers,
    get: (nombre) => headers[nombre.toLowerCase()],
    usuario: { id: 7 },
  };
  for (const regla of reglas) await regla.run(req);
  return req;
};

/**
 * @description Response falsa con lo que usa el controlador.
 * @returns {Object} res con status, json y set encadenables.
 */
const crearRes = () => {
  const res = { locals: {} };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn(() => res);
  return res;
};

/**
 * @description Corre el controlador con un servicio que resuelve o rechaza.
 * @param {Object|Error} resultado - Lo que devuelve el servicio, o el error que tira.
 * @param {Object} [body] - Cambios al cuerpo.
 * @returns {Promise<{servicio: Object, res: Object}>} El servicio y la response.
 */
const correr = async (resultado, body) => {
  const servicio = {
    registrarVentaDelPanel:
      resultado instanceof Error
        ? jest.fn().mockRejectedValue(resultado)
        : jest.fn().mockResolvedValue(resultado),
  };
  const res = crearRes();
  await new VentaPanelController(servicio).registrar(await armarReq(body), res);
  return { servicio, res };
};

describe("VentaPanelController.registrar", () => {
  test("venta nueva: 201 con la venta, sin el encabezado de reintento", async () => {
    const { res } = await correr({ creada: true, venta: VENTA });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(VENTA);
    expect(res.set).not.toHaveBeenCalled();
  });

  test("reintento: 200 con la venta original y Idempotent-Replayed", async () => {
    const { res } = await correr({ creada: false, venta: VENTA });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(VENTA);
    expect(res.set).toHaveBeenCalledWith("Idempotent-Replayed", "true");
  });

  test("el usuario sale de la sesión y la clave del encabezado, nunca del cuerpo", async () => {
    const { servicio } = await correr(
      { creada: true, venta: VENTA },
      { usuarioId: 99, claveVenta: "otra" }
    );

    const [datos, contexto] = servicio.registrarVentaDelPanel.mock.calls[0];
    expect(contexto).toEqual({ usuarioId: 7, claveVenta: CLAVE });
    expect(datos).not.toHaveProperty("usuarioId");
    expect(datos).not.toHaveProperty("claveVenta");
  });

  test.each([
    ["CLAVE_REUTILIZADA", 409],
    ["MEDIO_PAGO_NO_DISPONIBLE", 503],
    ["TOTAL_CAMBIO", 409],
    ["CARRITO_DESACTUALIZADO", 409],
    ["CARRITO_SIN_ITEMS_VALIDOS", 400],
  ])("%s responde %i", async (codigo, status) => {
    const { res } = await correr(new Error(codigo));

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: codigo }));
  });

  test("DATOS_INVALIDOS del servicio: 400 con el campo", async () => {
    const error = Object.assign(new Error("DATOS_INVALIDOS"), {
      details: { "entrega.direccion": "La dirección va solo con envío" },
    });

    const { res } = await correr(error);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "DATOS_INVALIDOS",
      details: { "entrega.direccion": "La dirección va solo con envío" },
    });
  });

  test("CLAVE_VENTA_DUPLICADA sin venta ganadora: 500, no un código del contrato", async () => {
    // Un 1062 sin la otra venta confirmada no debería ocurrir en InnoDB: si pasa, es
    // un error del sistema, y se responde como tal en vez de disfrazarlo.
    const consola = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { res } = await correr(new Error("CLAVE_VENTA_DUPLICADA"));

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "ERROR_INTERNO" });
    } finally {
      consola.mockRestore();
    }
  });
});

describe("VentaPanelController.cotizar", () => {
  const COTIZACION = { totales: { total: "15300.00" }, mediosPago: {} };

  /**
   * @description Corre cotizar con el cuerpo dado, después de las reglas de la ruta.
   * @param {Object} body - Cuerpo.
   * @param {Object|Error} [resultado] - Lo que devuelve el servicio, o el error.
   * @returns {Promise<{servicio: Object, res: Object}>} El servicio y la response.
   */
  const cotizar = async (body, resultado = COTIZACION) => {
    const req = { body, headers: {} };
    for (const regla of reglasCotizacion) await regla.run(req);
    const servicio = {
      cotizar:
        resultado instanceof Error
          ? jest.fn().mockRejectedValue(resultado)
          : jest.fn().mockResolvedValue(resultado),
    };
    const res = crearRes();
    await new VentaPanelController(null, servicio).cotizar(req, res);
    return { servicio, res };
  };

  const carrito = { items: [{ varianteId: 1, cantidad: 2 }], entrega: { metodo: "en_mano" } };

  test("200 con la cotización", async () => {
    const { res } = await cotizar({ ...carrito, medioPago: "efectivo" });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(COTIZACION);
  });

  test("al servicio llega solo lo validado: incluirEfectivo y lo demás se descartan", async () => {
    const { servicio } = await cotizar({
      ...carrito,
      incluirEfectivo: false,
      totalEsperado: "1.00",
      usuarioId: 99,
    });

    expect(servicio.cotizar).toHaveBeenCalledWith(carrito);
  });

  test.each([
    ["MEDIO_PAGO_NO_DISPONIBLE", 503],
    ["CARRITO_SIN_ITEMS_VALIDOS", 400],
    ["ZONA_INVALIDA", 400],
    ["DATOS_INVALIDOS", 400],
  ])("%s responde %i", async (codigo, status) => {
    const { res } = await cotizar(carrito, new Error(codigo));

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: codigo }));
  });
});
