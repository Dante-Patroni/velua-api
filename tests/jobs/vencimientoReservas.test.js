const { VencimientoReservas } = require("../../src/jobs/vencimientoReservas");

const AHORA = new Date("2026-10-07T15:00:00.000Z");

/**
 * Logger que no imprime nada, para poder revisar qué se anotó.
 */
const loggerMudo = () => ({ info: jest.fn(), error: jest.fn() });

/**
 * Arma el job con un repositorio y un servicio simulados.
 */
const crearJob = ({ ids = [1, 2, 3], cancelar } = {}) => {
  // Transferencias: el camino de siempre, cancelar
  const pedidoRepository = {
    listarVencidos: jest.fn(async () =>
      ids.map((id) => ({ id, numero: `VEL-00000${id}`, medioPago: "transferencia" }))
    ),
  };
  const pedidoEstadoService = {
    cancelarVencido: jest.fn(
      cancelar ?? (async (id) => ({ cancelado: true, numero: `VEL-00000${id}` }))
    ),
  };
  const logger = loggerMudo();
  const job = new VencimientoReservas({
    pedidoRepository,
    pedidoEstadoService,
    logger,
    ahora: () => AHORA,
    limite: 10,
  });
  return { job, pedidoRepository, pedidoEstadoService, logger };
};

describe("ejecutarVuelta", () => {
  it("cancela cada pedido vencido", async () => {
    const { job, pedidoEstadoService } = crearJob();

    const r = await job.ejecutarVuelta();

    expect(pedidoEstadoService.cancelarVencido.mock.calls.map(([id]) => id)).toEqual([1, 2, 3]);
    expect(r).toEqual({ revisados: 3, cancelados: 3, descartados: 0, errores: 0 });
  });

  it("le pasa al repositorio la hora y el límite", async () => {
    const { job, pedidoRepository } = crearJob();

    await job.ejecutarVuelta();

    expect(pedidoRepository.listarVencidos).toHaveBeenCalledWith(AHORA, 10);
  });

  it("sigue con los demás si uno falla", async () => {
    const { job, pedidoEstadoService, logger } = crearJob({
      cancelar: async (id) => {
        if (id === 2) throw new Error("se trabó la base");
        return { cancelado: true, numero: `VEL-00000${id}` };
      },
    });

    const r = await job.ejecutarVuelta();

    expect(pedidoEstadoService.cancelarVencido).toHaveBeenCalledTimes(3);
    expect(r).toEqual({ revisados: 3, cancelados: 2, descartados: 0, errores: 1 });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("pedido 2"));
  });

  it("cuenta como descartado el que ya no correspondía cancelar", async () => {
    const { job } = crearJob({
      cancelar: async (id) =>
        id === 1
          ? { cancelado: false, motivo: "YA_NO_CORRESPONDE" }
          : { cancelado: true, numero: `VEL-00000${id}` },
    });

    const r = await job.ejecutarVuelta();

    expect(r).toEqual({ revisados: 3, cancelados: 2, descartados: 1, errores: 0 });
  });

  it("no lanza si falla la búsqueda: lo anota y sigue vivo", async () => {
    const { job, pedidoRepository, logger } = crearJob();
    pedidoRepository.listarVencidos.mockRejectedValueOnce(new Error("sin conexión"));

    const r = await job.ejecutarVuelta();

    expect(r.errores).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("sin conexión"));
  });

  it("después de un error puede volver a correr", async () => {
    const { job, pedidoRepository } = crearJob();
    pedidoRepository.listarVencidos.mockRejectedValueOnce(new Error("sin conexión"));

    await job.ejecutarVuelta();
    const segunda = await job.ejecutarVuelta();

    // Si la bandera quedara trabada en true, la segunda vuelta saldría salteada
    expect(segunda.salteada).toBeUndefined();
    expect(segunda.cancelados).toBe(3);
  });

  it("no arranca una vuelta si la anterior no terminó", async () => {
    let liberar;
    const { job, pedidoEstadoService } = crearJob({
      ids: [1],
      cancelar: () =>
        new Promise((resolver) => {
          liberar = () => resolver({ cancelado: true, numero: "VEL-000001" });
        }),
    });

    const primera = job.ejecutarVuelta();
    // Deja que la primera llegue hasta cancelarVencido y quede esperando
    await new Promise((r) => setImmediate(r));
    const segunda = await job.ejecutarVuelta();
    liberar();
    await primera;

    expect(segunda.salteada).toBe(true);
    expect(pedidoEstadoService.cancelarVencido).toHaveBeenCalledTimes(1);
  });

  it("sin vencidos no hace nada", async () => {
    const { job, pedidoEstadoService } = crearJob({ ids: [] });

    const r = await job.ejecutarVuelta();

    expect(pedidoEstadoService.cancelarVencido).not.toHaveBeenCalled();
    expect(r).toEqual({ revisados: 0, cancelados: 0, descartados: 0, errores: 0 });
  });
});

describe("iniciar y detener", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("corre una vuelta al iniciar y después una por intervalo", () => {
    const { job } = crearJob();
    const espia = jest.spyOn(job, "ejecutarVuelta").mockResolvedValue({});

    job.iniciar(1000);
    expect(espia).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(3000);
    expect(espia).toHaveBeenCalledTimes(4);

    job.detener();
    jest.advanceTimersByTime(3000);
    expect(espia).toHaveBeenCalledTimes(4);
  });

  it("llamar a iniciar dos veces no duplica el intervalo", () => {
    const { job } = crearJob();
    const espia = jest.spyOn(job, "ejecutarVuelta").mockResolvedValue({});

    job.iniciar(1000);
    job.iniciar(1000);
    jest.advanceTimersByTime(1000);

    expect(espia).toHaveBeenCalledTimes(2);
    job.detener();
  });
});

describe("reconciliación con Mercado Pago", () => {
  const HORA = 60 * 60 * 1000;

  /** Pedido de Mercado Pago vencido hace una hora, ya pasado el margen de gracia. */
  const pedidoMP = (cambios = {}) => ({
    id: 7,
    numero: "VEL-MP0007",
    medioPago: "mercadopago",
    total: "8500.00",
    creadoEn: new Date(AHORA.getTime() - 2 * HORA),
    expiraEn: new Date(AHORA.getTime() - HORA),
    ...cambios,
  });
  const transferencia = { id: 8, numero: "VEL-TR0008", medioPago: "transferencia" };

  const pagoMP = (id, estado, monto = "8500.00") => ({
    id,
    estado,
    referencia: "VEL-MP0007",
    monto,
    moneda: "ARS",
    metodo: "master",
  });

  const crearJobMP = ({
    pedidos = [pedidoMP()],
    pagos = [],
    buscar,
    conProcesador = true,
  } = {}) => {
    const pedidoRepository = { listarVencidos: jest.fn(async () => pedidos) };
    const pedidoEstadoService = {
      cancelarVencido: jest.fn(async (id) => ({ cancelado: true, numero: `VEL-${id}` })),
      postergarVencimiento: jest.fn(async () => ({ postergado: true })),
      marcarRevision: jest.fn(async () => ({ marcado: true })),
    };
    const procesadorPagos = {
      buscarPagosPorReferencia: jest.fn(buscar ?? (async () => pagos)),
    };
    const pagoService = {
      aplicarPago: jest.fn(async () => ({ procesado: true, numero: "VEL-MP0007" })),
    };
    const logger = loggerMudo();
    const job = new VencimientoReservas({
      pedidoRepository,
      pedidoEstadoService,
      procesadorPagos: conProcesador ? procesadorPagos : null,
      pagoService: conProcesador ? pagoService : null,
      logger,
      ahora: () => AHORA,
      limite: 10,
    });
    return { job, pedidoEstadoService, procesadorPagos, pagoService, logger };
  };

  it("sin pagos en Mercado Pago, cancela como siempre", async () => {
    const { job, pedidoEstadoService } = crearJobMP({ pagos: [] });

    const r = await job.ejecutarVuelta();

    expect(pedidoEstadoService.cancelarVencido).toHaveBeenCalledWith(7);
    expect(r.cancelados).toBe(1);
  });

  it("con un pago aprobado lo aplica con origen job y NO cancela", async () => {
    const pago = pagoMP("1", "approved");
    const { job, pedidoEstadoService, pagoService } = crearJobMP({ pagos: [pago] });

    const r = await job.ejecutarVuelta();

    expect(pagoService.aplicarPago).toHaveBeenCalledWith(pago, { origen: "job" });
    expect(pedidoEstadoService.cancelarVencido).not.toHaveBeenCalled();
    expect(r).toEqual({ revisados: 1, cancelados: 0, descartados: 1, errores: 0 });
  });

  it("con dos aprobados aprueba y marca revisión con los ids de los dos", async () => {
    const { job, pedidoEstadoService, pagoService } = crearJobMP({
      pagos: [pagoMP("2", "approved"), pagoMP("1", "approved")],
    });

    await job.ejecutarVuelta();

    expect(pagoService.aplicarPago).toHaveBeenCalledTimes(1);
    expect(pedidoEstadoService.marcarRevision).toHaveBeenCalledWith(7, {
      motivo: expect.stringContaining("2, 1"),
    });
  });

  it("con un pago en curso posterga y NO cancela", async () => {
    const { job, pedidoEstadoService } = crearJobMP({ pagos: [pagoMP("1", "in_process")] });

    await job.ejecutarVuelta();

    expect(pedidoEstadoService.postergarVencimiento).toHaveBeenCalledWith(7, {
      hasta: expect.any(Date),
      motivo: "PAGO_EN_CURSO",
    });
    expect(pedidoEstadoService.cancelarVencido).not.toHaveBeenCalled();
  });

  it("con un estado desconocido marca revisión y NO cancela", async () => {
    const { job, pedidoEstadoService } = crearJobMP({ pagos: [pagoMP("1", "in_mediation")] });

    await job.ejecutarVuelta();

    expect(pedidoEstadoService.marcarRevision).toHaveBeenCalledWith(7, {
      motivo: "ESTADO_DESCONOCIDO",
    });
    expect(pedidoEstadoService.cancelarVencido).not.toHaveBeenCalled();
  });

  it("si Mercado Pago no responde, no cancela, lo anota y sigue con los demás", async () => {
    const { job, pedidoEstadoService, logger } = crearJobMP({
      pedidos: [pedidoMP(), transferencia],
      buscar: async () => {
        throw new Error("PROCESADOR_NO_DISPONIBLE");
      },
    });

    const r = await job.ejecutarVuelta();

    expect(pedidoEstadoService.cancelarVencido).toHaveBeenCalledTimes(1);
    expect(pedidoEstadoService.cancelarVencido).toHaveBeenCalledWith(8);
    expect(r).toEqual({ revisados: 2, cancelados: 1, descartados: 0, errores: 1 });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("no se cancela"));
  });

  it("dentro del margen de gracia no consulta ni cancela", async () => {
    const { job, pedidoEstadoService, procesadorPagos, logger } = crearJobMP({
      pedidos: [pedidoMP({ expiraEn: new Date(AHORA.getTime() - 5 * 60 * 1000) })],
    });

    const r = await job.ejecutarVuelta();

    expect(procesadorPagos.buscarPagosPorReferencia).not.toHaveBeenCalled();
    expect(pedidoEstadoService.cancelarVencido).not.toHaveBeenCalled();
    expect(r.descartados).toBe(1);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("margen de gracia"));
  });

  it("una transferencia no consulta a Mercado Pago", async () => {
    const { job, pedidoEstadoService, procesadorPagos } = crearJobMP({ pedidos: [transferencia] });

    await job.ejecutarVuelta();

    expect(procesadorPagos.buscarPagosPorReferencia).not.toHaveBeenCalled();
    expect(pedidoEstadoService.cancelarVencido).toHaveBeenCalledWith(8);
  });

  it("sin procesador configurado, un pedido de Mercado Pago se cancela como antes", async () => {
    const { job, pedidoEstadoService } = crearJobMP({ conProcesador: false });

    await job.ejecutarVuelta();

    expect(pedidoEstadoService.cancelarVencido).toHaveBeenCalledWith(7);
  });

  it("si falla la aplicación del pago, cuenta el error y no cancela", async () => {
    const { job, pedidoEstadoService, pagoService } = crearJobMP({
      pagos: [pagoMP("1", "approved")],
    });
    pagoService.aplicarPago.mockRejectedValueOnce(new Error("se cayó la base"));

    const r = await job.ejecutarVuelta();

    expect(pedidoEstadoService.cancelarVencido).not.toHaveBeenCalled();
    expect(r.errores).toBe(1);
  });
});
