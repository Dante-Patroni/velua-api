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

/** Pago de Mercado Pago normalizado, como lo devuelve buscarPagosPorReferencia. */
const pago = (id, estado, monto = "17000.00", moneda = "ARS") => ({
  id,
  estado,
  referencia: "VEL-ABC234",
  monto,
  moneda,
  metodo: "master",
});

const armar = ({ resultado = creado(), pedido = guardado(), procesador, pagos = [] } = {}) => {
  const repositorio = {
    transaccion: jest.fn().mockResolvedValue(resultado),
    buscarPorNumero: jest.fn().mockResolvedValue(pedido),
    guardarPreferencia: jest.fn().mockResolvedValue(true),
  };
  const procesadorPagos = procesador ?? {
    crearPreferencia: jest
      .fn()
      .mockResolvedValue({ preferenciaId: "pref-1", urlPago: "https://mp/pagar" }),
    buscarPagosPorReferencia: jest.fn().mockResolvedValue(pagos),
    obtenerPreferencia: jest
      .fn()
      .mockResolvedValue({ urlPago: "https://mp/pagar-existente", venceEn: VENCE }),
  };
  const logger = { error: jest.fn(), info: jest.fn() };
  const pagoService = { aplicarPago: jest.fn().mockResolvedValue({}) };
  const pedidoEstadoService = { marcarRevision: jest.fn().mockResolvedValue({}) };
  const servicio = new CheckoutService(repositorio, {}, () => AHORA, procesadorPagos, logger, {
    pagoService,
    pedidoEstadoService,
  });
  return { servicio, repositorio, procesadorPagos, logger, pagoService, pedidoEstadoService };
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

  it("sin Mercado Pago configurado, rechaza antes de crear el pedido", async () => {
    const procesador = { configurado: false, crearPreferencia: jest.fn() };
    const { servicio, repositorio } = armar({ procesador });

    await expect(servicio.crearPedido(ENTRADA)).rejects.toThrow("PROCESADOR_NO_CONFIGURADO");
    // Ni pedido, ni stock apartado, ni mail: la transacción no llega a abrirse
    expect(repositorio.transaccion).not.toHaveBeenCalled();
    expect(procesador.crearPreferencia).not.toHaveBeenCalled();
  });

  it("sin Mercado Pago configurado, la transferencia sigue funcionando", async () => {
    const procesador = { configurado: false, crearPreferencia: jest.fn() };
    const { servicio, repositorio } = armar({ procesador, resultado: creado("transferencia") });

    const r = await servicio.crearPedido({ ...ENTRADA, medioPago: "transferencia" });

    expect(repositorio.transaccion).toHaveBeenCalled();
    expect(r.medioPago).toBe("transferencia");
  });
});

describe("iniciarPago", () => {
  it("sin preferencia previa ni pagos, crea una y la guarda con compare-and-set", async () => {
    const { servicio, repositorio, procesadorPagos } = armar();

    const r = await servicio.iniciarPago("vel-abc234");

    expect(repositorio.buscarPorNumero).toHaveBeenCalledWith("VEL-ABC234");
    expect(procesadorPagos.buscarPagosPorReferencia).toHaveBeenCalledWith("VEL-ABC234");
    expect(repositorio.guardarPreferencia).toHaveBeenCalledWith(7, "pref-1", { anterior: null });
    expect(r).toEqual({ numero: "VEL-ABC234", urlPago: "https://mp/pagar" });
  });

  it("también después de un rechazo", async () => {
    const { servicio } = armar({
      pedido: guardado({ estadoPago: "rechazado" }),
      pagos: [pago("1", "rejected")],
    });

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

  it("PEDIDO_EN_REVISION si el pedido no tiene vencimiento, sin consultar a Mercado Pago", async () => {
    const { servicio, procesadorPagos } = armar({ pedido: guardado({ expiraEn: null }) });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PEDIDO_EN_REVISION");
    expect(procesadorPagos.buscarPagosPorReferencia).not.toHaveBeenCalled();
  });

  it("NO_ENCONTRADO si el número no tiene forma o no existe", async () => {
    const { servicio } = armar({ pedido: null });

    await expect(servicio.iniciarPago("cualquier-cosa")).rejects.toThrow("NO_ENCONTRADO");
    await expect(servicio.iniciarPago("VEL-ZZZZ99")).rejects.toThrow("NO_ENCONTRADO");
  });

  it("si Mercado Pago falla al crear la preferencia, propaga el error", async () => {
    const procesador = {
      buscarPagosPorReferencia: jest.fn().mockResolvedValue([]),
      crearPreferencia: jest.fn().mockRejectedValue(new Error("PROCESADOR_NO_DISPONIBLE")),
    };
    const { servicio, repositorio } = armar({ procesador });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PROCESADOR_NO_DISPONIBLE");
    expect(procesador.crearPreferencia).toHaveBeenCalled();
    expect(repositorio.guardarPreferencia).not.toHaveBeenCalled();
  });
});

describe("iniciarPago: evita el cobro doble", () => {
  it("si no puede consultar a Mercado Pago, no da link (fail secure)", async () => {
    const procesador = {
      buscarPagosPorReferencia: jest.fn().mockRejectedValue(new Error("BUSQUEDA_INCOMPLETA")),
      crearPreferencia: jest.fn(),
    };
    const { servicio, logger } = armar({ procesador });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PROCESADOR_NO_DISPONIBLE");
    expect(procesador.crearPreferencia).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("VEL-ABC234"),
      expect.anything()
    );
  });

  it("con un pago aprobado: lo aplica y responde PEDIDO_YA_PAGADO, sin link", async () => {
    const aprobado = pago("1", "approved");
    const { servicio, procesadorPagos, pagoService, pedidoEstadoService } = armar({
      pagos: [aprobado],
    });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PEDIDO_YA_PAGADO");
    expect(pagoService.aplicarPago).toHaveBeenCalledWith(aprobado, { origen: "cliente" });
    expect(pedidoEstadoService.marcarRevision).not.toHaveBeenCalled();
    expect(procesadorPagos.crearPreferencia).not.toHaveBeenCalled();
  });

  it("con dos aprobados: aplica el más viejo, marca revisión con los dos ids, sin link", async () => {
    const nuevo = pago("2", "approved");
    const viejo = pago("1", "approved");
    const { servicio, procesadorPagos, pagoService, pedidoEstadoService } = armar({
      pagos: [nuevo, viejo],
    });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PEDIDO_YA_PAGADO");
    expect(pagoService.aplicarPago).toHaveBeenCalledWith(viejo, { origen: "cliente" });
    expect(pedidoEstadoService.marcarRevision).toHaveBeenCalledWith(7, {
      motivo: expect.stringMatching(/PAGO_DUPLICADO.*2, 1/),
    });
    expect(procesadorPagos.crearPreferencia).not.toHaveBeenCalled();
  });

  it("con un aprobado de otro monto: revisión, sin aplicar y sin link", async () => {
    const { servicio, procesadorPagos, pagoService, pedidoEstadoService } = armar({
      pagos: [pago("1", "approved", "100.00")],
    });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PEDIDO_EN_REVISION");
    expect(pagoService.aplicarPago).not.toHaveBeenCalled();
    expect(pedidoEstadoService.marcarRevision).toHaveBeenCalledWith(7, {
      motivo: expect.stringContaining("MONTO_NO_COINCIDE"),
    });
    expect(procesadorPagos.crearPreferencia).not.toHaveBeenCalled();
  });

  it("con un pago en curso: PAGO_EN_PROCESO, sin tocar nada", async () => {
    const { servicio, procesadorPagos, pagoService, pedidoEstadoService } = armar({
      pagos: [pago("1", "pending")],
    });

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PAGO_EN_PROCESO");
    expect(pagoService.aplicarPago).not.toHaveBeenCalled();
    expect(pedidoEstadoService.marcarRevision).not.toHaveBeenCalled();
    expect(procesadorPagos.crearPreferencia).not.toHaveBeenCalled();
  });
});

describe("iniciarPago: una sola preferencia por pedido", () => {
  it("reusa la preferencia vigente en vez de crear otra", async () => {
    const { servicio, repositorio, procesadorPagos } = armar({
      pedido: guardado({ mpPreferenceId: "pref-0" }),
    });

    const r = await servicio.iniciarPago("VEL-ABC234");

    expect(procesadorPagos.obtenerPreferencia).toHaveBeenCalledWith("pref-0");
    expect(procesadorPagos.crearPreferencia).not.toHaveBeenCalled();
    expect(repositorio.guardarPreferencia).not.toHaveBeenCalled();
    expect(r.urlPago).toBe("https://mp/pagar-existente");
  });

  it("si la preferencia está por vencer, crea otra y reemplaza solo esa", async () => {
    const { servicio, repositorio, procesadorPagos } = armar({
      pedido: guardado({ mpPreferenceId: "pref-0" }),
    });
    procesadorPagos.obtenerPreferencia.mockResolvedValue({
      urlPago: "https://mp/vieja",
      venceEn: new Date(AHORA.getTime() + 2 * 60 * 1000),
    });

    const r = await servicio.iniciarPago("VEL-ABC234");

    expect(repositorio.guardarPreferencia).toHaveBeenCalledWith(7, "pref-1", {
      anterior: "pref-0",
    });
    expect(r.urlPago).toBe("https://mp/pagar");
  });

  it("si la preferencia no existe en Mercado Pago, crea otra", async () => {
    const { servicio, procesadorPagos } = armar({ pedido: guardado({ mpPreferenceId: "pref-0" }) });
    procesadorPagos.obtenerPreferencia.mockRejectedValue(new Error("PREFERENCIA_NO_ENCONTRADA"));

    await expect(servicio.iniciarPago("VEL-ABC234")).resolves.toHaveProperty(
      "urlPago",
      "https://mp/pagar"
    );
  });

  it("si Mercado Pago falla al leer la preferencia, no da link ni crea otra", async () => {
    const { servicio, procesadorPagos } = armar({ pedido: guardado({ mpPreferenceId: "pref-0" }) });
    procesadorPagos.obtenerPreferencia.mockRejectedValue(new Error("PROCESADOR_NO_DISPONIBLE"));

    await expect(servicio.iniciarPago("VEL-ABC234")).rejects.toThrow("PROCESADOR_NO_DISPONIBLE");
    expect(procesadorPagos.crearPreferencia).not.toHaveBeenCalled();
  });

  it("si otro reintento guardó primero, devuelve el link del ganador", async () => {
    const { servicio, repositorio, procesadorPagos } = armar();
    repositorio.guardarPreferencia.mockResolvedValue(false);
    repositorio.buscarPorNumero
      .mockResolvedValueOnce(guardado())
      .mockResolvedValueOnce(guardado({ mpPreferenceId: "pref-ganadora" }));
    procesadorPagos.obtenerPreferencia.mockResolvedValue({
      urlPago: "https://mp/ganadora",
      venceEn: VENCE,
    });

    const r = await servicio.iniciarPago("VEL-ABC234");

    expect(procesadorPagos.obtenerPreferencia).toHaveBeenCalledWith("pref-ganadora");
    expect(r.urlPago).toBe("https://mp/ganadora");
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
            producto: {
              id: 1,
              nombre: "Éclat Noir",
              slug: "eclat-noir",
              activo: true,
              disponibleDesde: null,
            },
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
