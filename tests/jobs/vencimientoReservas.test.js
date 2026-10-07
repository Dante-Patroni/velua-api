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
  const pedidoRepository = { listarVencidos: jest.fn(async () => ids) };
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
