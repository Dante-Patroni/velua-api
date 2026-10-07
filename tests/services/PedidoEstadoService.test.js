const { PedidoEstadoService, estaVencido } = require("../../src/services/PedidoEstadoService");

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const HORA = 60 * 60 * 1000;
const haceHoras = (h) => new Date(AHORA.getTime() - h * HORA);

/**
 * Pedido con la reserva vencida hace una hora, listo para cancelar.
 */
const pedido = (cambios = {}) => ({
  id: 1,
  numero: "VEL-AAAAAA",
  clienteNombre: "Valentina Ruiz",
  clienteEmail: "valentina@ejemplo.test",
  medioPago: "mercadopago",
  estadoPago: "pendiente",
  estadoPedido: "nuevo",
  expiraEn: haceHoras(1),
  comprobanteInformadoEn: null,
  ...cambios,
});

/**
 * Repositorio en memoria que simula la transacción: si el trabajo lanza un error,
 * el estado vuelve a como estaba.
 */
const crearRepositorio = ({
  pedidos = [pedido()],
  items = [
    { pedidoId: 1, varianteId: 7, cantidad: 2 },
    { pedidoId: 1, varianteId: 3, cantidad: 1 },
  ],
  stock = { 3: 0, 7: 5 },
} = {}) => {
  const estado = {
    pedidos: pedidos.map((p) => structuredClone(p)),
    items: structuredClone(items),
    stock: { ...stock },
    eventos: [],
    emails: [],
  };

  const tx = {
    bloquearPedido: jest.fn(async (id) => {
      const p = estado.pedidos.find((x) => x.id === id);
      return p ? structuredClone(p) : null;
    }),
    listarItems: jest.fn(async (pedidoId) =>
      estado.items
        .filter((i) => i.pedidoId === pedidoId)
        .map(({ varianteId, cantidad }) => ({ varianteId, cantidad }))
    ),
    reponerStock: jest.fn(async (id, cantidad) => {
      estado.stock[id] = (estado.stock[id] ?? 0) + cantidad;
    }),
    actualizarEstados: jest.fn(async (id, cambios) => {
      Object.assign(
        estado.pedidos.find((p) => p.id === id),
        cambios
      );
    }),
    registrarEvento: jest.fn(async (e) => estado.eventos.push(e)),
    encolarEmail: jest.fn(async (e) => estado.emails.push(e)),
  };

  return {
    estado,
    tx,
    transaccion: jest.fn(async (trabajo) => {
      const copia = structuredClone(estado);
      try {
        return await trabajo(tx);
      } catch (error) {
        Object.assign(estado, copia);
        throw error;
      }
    }),
  };
};

const servicio = (repo) => new PedidoEstadoService(repo, () => AHORA);

describe("estaVencido", () => {
  it("es true con pago pendiente, plazo pasado y sin comprobante", () => {
    expect(estaVencido(pedido(), AHORA)).toBe(true);
  });

  it("también vence un pago rechazado", () => {
    // El rechazo no libera el stock: lo libera el vencimiento
    expect(estaVencido(pedido({ estadoPago: "rechazado" }), AHORA)).toBe(true);
  });

  it("vence justo en el momento del plazo", () => {
    expect(estaVencido(pedido({ expiraEn: AHORA }), AHORA)).toBe(true);
  });

  it("no vence si el plazo todavía no pasó", () => {
    expect(estaVencido(pedido({ expiraEn: new Date(AHORA.getTime() + 1000) }), AHORA)).toBe(false);
  });

  it("no vence si la clienta avisó que transfirió", () => {
    const p = pedido({ medioPago: "transferencia", comprobanteInformadoEn: haceHoras(2) });
    expect(estaVencido(p, AHORA)).toBe(false);
  });

  it.each(["aprobado", "cancelado", "devuelto"])("no vence con pago %s", (estadoPago) => {
    expect(estaVencido(pedido({ estadoPago }), AHORA)).toBe(false);
  });

  it("no vence si no tiene plazo", () => {
    expect(estaVencido(pedido({ expiraEn: null }), AHORA)).toBe(false);
  });

  it("acepta el plazo como cadena, como puede llegar de la base", () => {
    expect(estaVencido(pedido({ expiraEn: haceHoras(1).toISOString() }), AHORA)).toBe(true);
  });
});

describe("cancelarVencido", () => {
  it("cancela el pago y la preparación", async () => {
    const repo = crearRepositorio();

    const r = await servicio(repo).cancelarVencido(1);

    expect(r).toEqual({ cancelado: true, numero: "VEL-AAAAAA" });
    expect(repo.estado.pedidos[0].estadoPago).toBe("cancelado");
    expect(repo.estado.pedidos[0].estadoPedido).toBe("cancelado");
  });

  it("devuelve el stock de cada ítem", async () => {
    const repo = crearRepositorio();

    await servicio(repo).cancelarVencido(1);

    expect(repo.estado.stock).toEqual({ 3: 1, 7: 7 });
  });

  it("repone en orden de variante, igual que el checkout bloquea", async () => {
    const repo = crearRepositorio();

    await servicio(repo).cancelarVencido(1);

    const orden = repo.tx.reponerStock.mock.calls.map(([id]) => id);
    expect(orden).toEqual([3, 7]);
  });

  it("saltea los ítems sin variante", async () => {
    const repo = crearRepositorio({
      items: [
        { pedidoId: 1, varianteId: null, cantidad: 1 },
        { pedidoId: 1, varianteId: 7, cantidad: 2 },
      ],
    });

    await servicio(repo).cancelarVencido(1);

    expect(repo.tx.reponerStock).toHaveBeenCalledTimes(1);
    expect(repo.estado.stock[7]).toBe(7);
  });

  it("registra un evento por cada estado, con origen job", async () => {
    const repo = crearRepositorio();

    await servicio(repo).cancelarVencido(1);

    expect(repo.estado.eventos).toEqual([
      expect.objectContaining({
        campo: "pago",
        estadoAnterior: "pendiente",
        estadoNuevo: "cancelado",
        origen: "job",
      }),
      expect.objectContaining({
        campo: "preparacion",
        estadoAnterior: "nuevo",
        estadoNuevo: "cancelado",
        origen: "job",
      }),
    ]);
  });

  it("encola el mail de pedido cancelado", async () => {
    const repo = crearRepositorio();

    await servicio(repo).cancelarVencido(1);

    expect(repo.estado.emails).toEqual([
      expect.objectContaining({
        pedidoId: 1,
        tipo: "pedido_cancelado",
        destinatario: "valentina@ejemplo.test",
        datos: expect.objectContaining({ numero: "VEL-AAAAAA", motivo: "vencimiento" }),
      }),
    ]);
  });

  it("no repone el stock dos veces sobre el mismo pedido", async () => {
    const repo = crearRepositorio();
    const s = servicio(repo);

    await s.cancelarVencido(1);
    const segunda = await s.cancelarVencido(1);

    expect(segunda).toEqual({ cancelado: false, motivo: "YA_NO_CORRESPONDE" });
    expect(repo.estado.stock).toEqual({ 3: 1, 7: 7 });
    expect(repo.estado.eventos).toHaveLength(2);
    expect(repo.estado.emails).toHaveLength(1);
  });

  it("no toca un pedido que se aprobó mientras tanto", async () => {
    // El job lo encontró vencido, pero el webhook lo aprobó antes del candado
    const repo = crearRepositorio({ pedidos: [pedido({ estadoPago: "aprobado" })] });

    const r = await servicio(repo).cancelarVencido(1);

    expect(r).toEqual({ cancelado: false, motivo: "YA_NO_CORRESPONDE" });
    expect(repo.tx.reponerStock).not.toHaveBeenCalled();
    expect(repo.tx.actualizarEstados).not.toHaveBeenCalled();
  });

  it("no toca un pedido con comprobante informado", async () => {
    const repo = crearRepositorio({
      pedidos: [pedido({ medioPago: "transferencia", comprobanteInformadoEn: haceHoras(2) })],
    });

    const r = await servicio(repo).cancelarVencido(1);

    expect(r.cancelado).toBe(false);
    expect(repo.estado.stock).toEqual({ 3: 0, 7: 5 });
  });

  it("devuelve NO_EXISTE si el pedido no está", async () => {
    const repo = crearRepositorio();

    expect(await servicio(repo).cancelarVencido(99)).toEqual({
      cancelado: false,
      motivo: "NO_EXISTE",
    });
  });

  it("si falla el encolado del mail, no queda nada hecho", async () => {
    const repo = crearRepositorio();
    repo.tx.encolarEmail.mockRejectedValueOnce(new Error("se cayó la base"));

    await expect(servicio(repo).cancelarVencido(1)).rejects.toThrow("se cayó la base");

    expect(repo.estado.pedidos[0].estadoPago).toBe("pendiente");
    expect(repo.estado.stock).toEqual({ 3: 0, 7: 5 });
    expect(repo.estado.eventos).toHaveLength(0);
  });

  it("lanza TRANSICION_INVALIDA si la preparación ya no se puede cancelar", async () => {
    // No debería pasar: con el pago pendiente la preparación no avanza. Si pasa,
    // es un dato roto y conviene que salte en lugar de cancelarlo igual.
    const repo = crearRepositorio({ pedidos: [pedido({ estadoPedido: "entregado" })] });

    await expect(servicio(repo).cancelarVencido(1)).rejects.toThrow("TRANSICION_INVALIDA");
    expect(repo.estado.stock).toEqual({ 3: 0, 7: 5 });
  });
});
