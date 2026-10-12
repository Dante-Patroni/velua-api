const { CheckoutService } = require("../../src/services/CheckoutService");

const AHORA = new Date("2026-10-09T20:00:00.000Z");
const VENCE = new Date("2026-10-09T21:00:00.000Z");

const ENTRADA = {
  items: [{ varianteId: 1, cantidad: 2 }],
  cliente: { nombre: "Ana", email: " Ana@Example.com ", telefono: "3584000000" },
  entrega: { metodo: "retiro" },
  medioPago: "mercadopago",
  totalEsperado: "17000.00",
};

/** Lo que devuelve la transacción del checkout, sin pasar por la base. */
const creado = (medioPago = "mercadopago") => ({
  pedidoId: 7,
  numero: "VEL-ABC234",
  estadoPago: "pendiente",
  medioPago,
  total: "17000.00",
  expiraEn: VENCE,
});

/** Pedido como lo devuelve buscarPorNumero. */
const guardado = (cambios = {}) => ({
  id: 7,
  numero: "VEL-ABC234",
  medioPago: "mercadopago",
  estadoPago: "pendiente",
  total: "17000.00",
  clienteEmail: "ana@example.com",
  expiraEn: VENCE,
  ...cambios,
});

const armar = ({ resultado = creado(), pedido = guardado(), procesador } = {}) => {
  const repositorio = {
    transaccion: jest.fn().mockResolvedValue(resultado),
    buscarPorNumero: jest.fn().mockResolvedValue(pedido),
    guardarPreferencia: jest.fn().mockResolvedValue(),
  };
  const procesadorPagos = procesador ?? {
    crearPreferencia: jest
      .fn()
      .mockResolvedValue({ preferenciaId: "pref-1", urlPago: "https://mp/pagar" }),
  };
  const logger = { error: jest.fn() };
  const servicio = new CheckoutService(repositorio, {}, () => AHORA, procesadorPagos, logger);
  return { servicio, repositorio, procesadorPagos, logger };
};

describe("crearPedido con Mercado Pago", () => {
  it("crea la preferencia, la guarda y devuelve el link", async () => {
    const { servicio, repositorio, procesadorPagos } = armar();

    const r = await servicio.crearPedido(ENTRADA);

    expect(procesadorPagos.crearPreferencia).toHaveBeenCalledWith({
      numero: "VEL-ABC234",
      total: "17000.00",
      email: "ana@example.com",
      expiraEn: VENCE,
    });
    expect(repositorio.guardarPreferencia).toHaveBeenCalledWith(7, "pref-1");
    expect(r.urlPago).toBe("https://mp/pagar");
  });

  it("no expone el id interno del pedido", async () => {
    const { servicio } = armar();

    const r = await servicio.crearPedido(ENTRADA);

    expect(r).not.toHaveProperty("pedidoId");
  });

  it("con transferencia no habla con el procesador ni devuelve link", async () => {
    const { servicio, procesadorPagos } = armar({ resultado: creado("transferencia") });

    const r = await servicio.crearPedido({ ...ENTRADA, medioPago: "transferencia" });

    expect(procesadorPagos.crearPreferencia).not.toHaveBeenCalled();
    expect(r).not.toHaveProperty("urlPago");
  });

  it("si Mercado Pago falla, el pedido igual se crea, sin link, y queda anotado", async () => {
    const procesador = {
      crearPreferencia: jest.fn().mockRejectedValue(new Error("PROCESADOR_NO_DISPONIBLE")),
    };
    const { servicio, repositorio, logger } = armar({ procesador });

    const r = await servicio.crearPedido(ENTRADA);

    expect(r).toEqual(expect.objectContaining({ numero: "VEL-ABC234", urlPago: null }));
    expect(repositorio.guardarPreferencia).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("VEL-ABC234"),
      expect.anything()
    );
  });
});

describe("iniciarPago", () => {
  it("genera un link nuevo para un pedido pendiente y vigente", async () => {
    const { servicio, repositorio } = armar();

    const r = await servicio.iniciarPago("vel-abc234");

    expect(repositorio.buscarPorNumero).toHaveBeenCalledWith("VEL-ABC234");
    expect(repositorio.guardarPreferencia).toHaveBeenCalledWith(7, "pref-1");
    expect(r).toEqual({ numero: "VEL-ABC234", urlPago: "https://mp/pagar" });
  });

  it("también después de un rechazo", async () => {
    const { servicio } = armar({ pedido: guardado({ estadoPago: "rechazado" }) });

    await expect(servicio.iniciarPago("VEL-ABC234")).resolves.toHaveProperty("urlPago");
  });

  it.each([
    ["con transferencia", { medioPago: "transferencia" }],
    ["ya aprobado", { estadoPago: "aprobado" }],
    ["cancelado", { estadoPago: "cancelado" }],
  ])("PEDIDO_NO_PAGABLE si el pedido está %s", async (_caso, cambios) => {
    const { servicio, procesadorPagos } = armar({ pedido: guardado(cambios) });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PEDIDO_NO_PAGABLE");
    expect(procesadorPagos.crearPreferencia).not.toHaveBeenCalled();
  });

  it("PEDIDO_VENCIDO si la reserva ya venció", async () => {
    const { servicio } = armar({
      pedido: guardado({ expiraEn: new Date("2026-10-09T19:00:00Z") }),
    });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PEDIDO_VENCIDO");
  });

  it("NO_ENCONTRADO si el número no tiene forma o no existe", async () => {
    const { servicio } = armar({ pedido: null });

    await expect(servicio.iniciarPago("cualquier-cosa")).rejects.toThrow("NO_ENCONTRADO");
    await expect(servicio.iniciarPago("VEL-ZZZZ99")).rejects.toThrow("NO_ENCONTRADO");
  });

  it("si Mercado Pago falla, propaga el error: la clienta lo pidió y tiene que saberlo", async () => {
    const procesador = {
      crearPreferencia: jest.fn().mockRejectedValue(new Error("PROCESADOR_NO_DISPONIBLE")),
    };
    const { servicio } = armar({ procesador });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PROCESADOR_NO_DISPONIBLE");
  });
});

describe("crearPedido, con la transacción real", () => {
  it("pasa el id del pedido creado a guardarPreferencia", async () => {
    const { servicio, repositorio } = armar();
    // En vez de devolver un resultado armado, ejecuta el trabajo del servicio
    repositorio.transaccion = jest.fn((trabajo) =>
      trabajo({
        buscarVariantes: jest.fn().mockResolvedValue([
          {
            id: 1,
            nombre: "100 g",
            sku: "SKU-1",
            precio: "8500.00",
            stock: 10,
            activa: true,
            productoId: 1,
            producto: { id: 1, nombre: "Éclat", slug: "eclat", activo: true },
          },
        ]),
        buscarZonaEnvio: jest.fn(),
        listarZonasEnvio: jest.fn().mockResolvedValue([]),
        descontarStock: jest.fn(),
        existeNumero: jest.fn().mockResolvedValue(false),
        crearPedido: jest.fn((datos) => Promise.resolve({ id: 42, ...datos })),
        crearItems: jest.fn(),
        registrarEvento: jest.fn(),
        encolarEmail: jest.fn(),
      })
    );

    await servicio.crearPedido(ENTRADA);

    expect(repositorio.guardarPreferencia).toHaveBeenCalledWith(42, "pref-1");
  });
});
