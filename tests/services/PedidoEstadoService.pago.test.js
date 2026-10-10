const { PedidoEstadoService } = require("../../src/services/PedidoEstadoService");

const AHORA = new Date("2026-10-10T15:00:00.000Z");

const pedido = (cambios = {}) => ({
  id: 7,
  numero: "VEL-ABC234",
  estadoPago: "pendiente",
  estadoPedido: "nuevo",
  medioPago: "mercadopago",
  total: "17000.00",
  clienteEmail: "ana@example.com",
  clienteNombre: "Ana",
  expiraEn: new Date("2026-10-10T16:00:00.000Z"),
  ...cambios,
});

const APROBADO = { estado: "aprobado", pagoId: "123", metodo: "visa" };
const RECHAZADO = { estado: "rechazado", pagoId: "124", metodo: "visa" };

const armar = (p = pedido()) => {
  const tx = {
    bloquearPedido: jest.fn().mockResolvedValue(p),
    actualizarEstados: jest.fn().mockResolvedValue(),
    guardarDatosPago: jest.fn().mockResolvedValue(),
    registrarEvento: jest.fn().mockResolvedValue(),
    encolarEmail: jest.fn().mockResolvedValue(),
  };
  const repositorio = { transaccion: jest.fn((trabajo) => trabajo(tx)) };
  return { servicio: new PedidoEstadoService(repositorio, () => AHORA), tx };
};

/** Ninguna escritura sobre el pedido ni mails. */
const sinCambios = (tx) => {
  expect(tx.actualizarEstados).not.toHaveBeenCalled();
  expect(tx.guardarDatosPago).not.toHaveBeenCalled();
  expect(tx.encolarEmail).not.toHaveBeenCalled();
};

describe("registrarResultadoPago", () => {
  it("pendiente → aprobado: cambia el estado, deja de vencer y encola el mail", async () => {
    const { servicio, tx } = armar();

    const r = await servicio.registrarResultadoPago(7, APROBADO);

    expect(r).toEqual({ cambiado: true, numero: "VEL-ABC234" });
    expect(tx.actualizarEstados).toHaveBeenCalledWith(7, { estadoPago: "aprobado" });
    expect(tx.guardarDatosPago).toHaveBeenCalledWith(7, {
      mpPaymentId: "123",
      mpMetodo: "visa",
      expiraEn: null,
    });
    expect(tx.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoAnterior: "pendiente",
        estadoNuevo: "aprobado",
        origen: "webhook",
      })
    );
    expect(tx.encolarEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "pago_confirmado", destinatario: "ana@example.com" })
    );
  });

  it("pendiente → rechazado: mantiene el vencimiento para poder reintentar", async () => {
    const { servicio, tx } = armar();

    await servicio.registrarResultadoPago(7, RECHAZADO);

    expect(tx.actualizarEstados).toHaveBeenCalledWith(7, { estadoPago: "rechazado" });
    expect(tx.guardarDatosPago).toHaveBeenCalledWith(7, { mpPaymentId: "124", mpMetodo: "visa" });
    expect(tx.encolarEmail).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "pago_rechazado" })
    );
  });

  it("rechazado → aprobado: el reintento que sale bien se registra", async () => {
    const { servicio, tx } = armar(pedido({ estadoPago: "rechazado" }));

    const r = await servicio.registrarResultadoPago(7, APROBADO);

    expect(r.cambiado).toBe(true);
    expect(tx.actualizarEstados).toHaveBeenCalledWith(7, { estadoPago: "aprobado" });
  });

  it.each([
    ["aprobado", APROBADO],
    ["rechazado", RECHAZADO],
  ])("el mismo aviso dos veces (%s) no repite nada", async (estado, pago) => {
    const { servicio, tx } = armar(pedido({ estadoPago: estado }));

    const r = await servicio.registrarResultadoPago(7, pago);

    expect(r.motivo).toBe("YA_REGISTRADO");
    sinCambios(tx);
    expect(tx.registrarEvento).not.toHaveBeenCalled();
  });

  it("un rechazo que llega después de la aprobación se ignora", async () => {
    const { servicio, tx } = armar(pedido({ estadoPago: "aprobado" }));

    const r = await servicio.registrarResultadoPago(7, RECHAZADO);

    expect(r.motivo).toBe("FUERA_DE_ORDEN");
    sinCambios(tx);
  });

  it("un pago aprobado sobre un pedido cancelado queda para revisar, sin reabrirlo", async () => {
    const { servicio, tx } = armar(pedido({ estadoPago: "cancelado", estadoPedido: "cancelado" }));

    const r = await servicio.registrarResultadoPago(7, APROBADO);

    expect(r.motivo).toBe("REQUIERE_REVISION");
    sinCambios(tx);
    expect(tx.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ detalle: expect.stringContaining("devolver") })
    );
  });

  it("si el pedido no existe, no hace nada", async () => {
    const { servicio, tx } = armar(null);

    const r = await servicio.registrarResultadoPago(99, APROBADO);

    expect(r).toEqual({ cambiado: false, motivo: "NO_EXISTE" });
    sinCambios(tx);
  });

  it("si falla el encolado del mail, propaga el error para que se deshaga todo", async () => {
    const { servicio, tx } = armar();
    tx.encolarEmail.mockRejectedValue(new Error("ERROR_DE_BASE"));

    await expect(servicio.registrarResultadoPago(7, APROBADO)).rejects.toThrow("ERROR_DE_BASE");
  });

  it("un resultado desconocido es un error de programación", async () => {
    const { servicio } = armar();

    await expect(
      servicio.registrarResultadoPago(7, { estado: "pending", pagoId: "1" })
    ).rejects.toThrow("Resultado de pago desconocido");
  });
});
