const { PagoWebhookService } = require("../../src/services/PagoWebhookService");

const pago = (cambios = {}) => ({
  id: "123",
  estado: "approved",
  detalle: "accredited",
  referencia: "VEL-ABC234",
  monto: "17000.00",
  moneda: "ARS",
  metodo: "visa",
  ...cambios,
});

const pedido = (cambios = {}) => ({
  id: 7,
  numero: "VEL-ABC234",
  medioPago: "mercadopago",
  total: "17000.00",
  ...cambios,
});

const armar = ({
  elPago = pago(),
  elPedido = pedido(),
  registro = { cambiado: true, numero: "VEL-ABC234" },
} = {}) => {
  const procesadorPagos = { obtenerPago: jest.fn().mockResolvedValue(elPago) };
  const pedidoRepository = { buscarPorNumero: jest.fn().mockResolvedValue(elPedido) };
  const pedidoEstadoService = { registrarResultadoPago: jest.fn().mockResolvedValue(registro) };
  const logger = { error: jest.fn() };
  const servicio = new PagoWebhookService({
    procesadorPagos,
    pedidoRepository,
    pedidoEstadoService,
    logger,
  });
  return { servicio, procesadorPagos, pedidoRepository, pedidoEstadoService, logger };
};

describe("procesarNotificacion", () => {
  it("consulta el pago y aprueba el pedido si todo coincide", async () => {
    const { servicio, procesadorPagos, pedidoRepository, pedidoEstadoService } = armar();

    const r = await servicio.procesarNotificacion(123);

    expect(procesadorPagos.obtenerPago).toHaveBeenCalledWith("123");
    expect(pedidoRepository.buscarPorNumero).toHaveBeenCalledWith("VEL-ABC234");
    expect(pedidoEstadoService.registrarResultadoPago).toHaveBeenCalledWith(7, {
      estado: "aprobado",
      pagoId: "123",
      metodo: "visa",
    });
    expect(r).toEqual({ procesado: true, numero: "VEL-ABC234" });
  });

  it("un pago rechazado pasa el pedido a rechazado", async () => {
    const { servicio, pedidoEstadoService } = armar({ elPago: pago({ estado: "rejected" }) });

    await servicio.procesarNotificacion("123");

    expect(pedidoEstadoService.registrarResultadoPago).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ estado: "rechazado" })
    );
  });

  it.each(["pending", "in_process", "cancelled", "refunded"])(
    "un pago %s no mueve nada",
    async (estado) => {
      const { servicio, pedidoRepository, pedidoEstadoService } = armar({
        elPago: pago({ estado }),
      });

      const r = await servicio.procesarNotificacion("123");

      expect(r).toEqual({ procesado: false, motivo: "SIN_RESULTADO" });
      expect(pedidoRepository.buscarPorNumero).not.toHaveBeenCalled();
      expect(pedidoEstadoService.registrarResultadoPago).not.toHaveBeenCalled();
    }
  );

  it("si el pago no trae referencia o el pedido no existe, lo anota y no mueve nada", async () => {
    const { servicio, pedidoEstadoService, logger } = armar({ elPedido: null });

    const r = await servicio.procesarNotificacion("123");

    expect(r.motivo).toBe("PEDIDO_DESCONOCIDO");
    expect(pedidoEstadoService.registrarResultadoPago).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("no toca un pedido de transferencia", async () => {
    const { servicio, pedidoEstadoService } = armar({
      elPedido: pedido({ medioPago: "transferencia" }),
    });

    const r = await servicio.procesarNotificacion("123");

    expect(r.motivo).toBe("MEDIO_INCORRECTO");
    expect(pedidoEstadoService.registrarResultadoPago).not.toHaveBeenCalled();
  });

  it.each([
    ["un monto menor", { monto: "1.00" }],
    ["otra moneda", { moneda: "USD" }],
  ])("no aprueba si el pago tiene %s", async (_caso, cambios) => {
    const { servicio, pedidoEstadoService, logger } = armar({ elPago: pago(cambios) });

    const r = await servicio.procesarNotificacion("123");

    expect(r.motivo).toBe("MONTO_NO_COINCIDE");
    expect(pedidoEstadoService.registrarResultadoPago).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("VEL-ABC234"));
  });

  it("un rechazo no necesita que coincida el monto", async () => {
    const { servicio, pedidoEstadoService } = armar({
      elPago: pago({ estado: "rejected", monto: "1.00" }),
    });

    await servicio.procesarNotificacion("123");

    expect(pedidoEstadoService.registrarResultadoPago).toHaveBeenCalled();
  });

  it("devuelve el motivo si la máquina de estados no cambió nada", async () => {
    const { servicio } = armar({
      registro: { cambiado: false, numero: "VEL-ABC234", motivo: "YA_REGISTRADO" },
    });

    const r = await servicio.procesarNotificacion("123");

    expect(r).toEqual({ procesado: false, numero: "VEL-ABC234", motivo: "YA_REGISTRADO" });
  });

  it("anota en el log un pago aprobado sobre un pedido cerrado", async () => {
    const { servicio, logger } = armar({
      registro: { cambiado: false, numero: "VEL-ABC234", motivo: "REQUIERE_REVISION" },
    });

    await servicio.procesarNotificacion("123");

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("pedido cerrado"));
  });

  it("si Mercado Pago no responde, lanza el error para que el aviso se reintente", async () => {
    const { servicio } = armar();
    servicio.procesador.obtenerPago.mockRejectedValue(new Error("PROCESADOR_NO_DISPONIBLE"));

    await expect(servicio.procesarNotificacion("123")).rejects.toThrow("PROCESADOR_NO_DISPONIBLE");
  });
});
