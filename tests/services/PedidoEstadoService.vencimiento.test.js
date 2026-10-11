const { PedidoEstadoService } = require("../../src/services/PedidoEstadoService");

const AHORA = new Date("2026-10-11T15:00:00.000Z");
const HORA = 60 * 60 * 1000;
const enHoras = (h) => new Date(AHORA.getTime() + h * HORA);

/** Pedido de Mercado Pago con la reserva vencida hace una hora. */
const pedido = (cambios = {}) => ({
  id: 1,
  numero: "VEL-AAAAAA",
  clienteEmail: "valentina@ejemplo.test",
  medioPago: "mercadopago",
  estadoPago: "pendiente",
  estadoPedido: "nuevo",
  expiraEn: enHoras(-1),
  comprobanteInformadoEn: null,
  ...cambios,
});

/** Repositorio en memoria: si el trabajo lanza, el estado vuelve a como estaba. */
const crearRepositorio = (pedidos = [pedido()]) => {
  const estado = { pedidos: pedidos.map((p) => structuredClone(p)), eventos: [] };
  const tx = {
    bloquearPedido: jest.fn(async (id) => {
      const p = estado.pedidos.find((x) => x.id === id);
      return p ? structuredClone(p) : null;
    }),
    guardarDatosPago: jest.fn(async (id, datos) => {
      Object.assign(
        estado.pedidos.find((p) => p.id === id),
        datos
      );
    }),
    registrarEvento: jest.fn(async (e) => estado.eventos.push(e)),
    actualizarEstados: jest.fn(),
    reponerStock: jest.fn(),
    encolarEmail: jest.fn(),
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

describe("postergarVencimiento", () => {
  const POSTERGAR = { hasta: enHoras(1), motivo: "PAGO_EN_CURSO" };

  it("mueve el vencimiento y lo anota en la bitácora, con origen job", async () => {
    const repo = crearRepositorio();

    const r = await servicio(repo).postergarVencimiento(1, POSTERGAR);

    expect(r).toEqual({ postergado: true, numero: "VEL-AAAAAA" });
    expect(repo.estado.pedidos[0].expiraEn).toEqual(enHoras(1));
    expect(repo.estado.eventos).toEqual([
      expect.objectContaining({
        campo: "pago",
        estadoAnterior: "pendiente",
        estadoNuevo: "pendiente",
        origen: "job",
        detalle: expect.stringContaining("PAGO_EN_CURSO"),
      }),
    ]);
  });

  it("no toca el estado, el stock ni la bandeja de mails", async () => {
    const repo = crearRepositorio();

    await servicio(repo).postergarVencimiento(1, POSTERGAR);

    expect(repo.estado.pedidos[0].estadoPago).toBe("pendiente");
    expect(repo.tx.actualizarEstados).not.toHaveBeenCalled();
    expect(repo.tx.reponerStock).not.toHaveBeenCalled();
    expect(repo.tx.encolarEmail).not.toHaveBeenCalled();
  });

  it("no le pone vencimiento a un pedido que se aprobó mientras tanto", async () => {
    const repo = crearRepositorio([pedido({ estadoPago: "aprobado", expiraEn: null })]);

    const r = await servicio(repo).postergarVencimiento(1, POSTERGAR);

    expect(r).toEqual({ postergado: false, numero: "VEL-AAAAAA", motivo: "YA_NO_CORRESPONDE" });
    expect(repo.estado.pedidos[0].expiraEn).toBeNull();
    expect(repo.estado.eventos).toHaveLength(0);
  });

  it("no toca un pedido que todavía no venció", async () => {
    const repo = crearRepositorio([pedido({ expiraEn: enHoras(0.5) })]);

    const r = await servicio(repo).postergarVencimiento(1, POSTERGAR);

    expect(r.postergado).toBe(false);
    expect(repo.estado.pedidos[0].expiraEn).toEqual(enHoras(0.5));
  });

  it("devuelve NO_EXISTE si el pedido no está", async () => {
    const repo = crearRepositorio();

    expect(await servicio(repo).postergarVencimiento(99, POSTERGAR)).toEqual({
      postergado: false,
      motivo: "NO_EXISTE",
    });
  });

  it("si falla la bitácora, el vencimiento no queda movido", async () => {
    const repo = crearRepositorio();
    repo.tx.registrarEvento.mockRejectedValueOnce(new Error("se cayó la base"));

    await expect(servicio(repo).postergarVencimiento(1, POSTERGAR)).rejects.toThrow(
      "se cayó la base"
    );
    expect(repo.estado.pedidos[0].expiraEn).toEqual(enHoras(-1));
  });
});

describe("marcarRevision", () => {
  it("a un pedido vencido le saca el vencimiento y anota el motivo", async () => {
    const repo = crearRepositorio();

    const r = await servicio(repo).marcarRevision(1, { motivo: "MONTO_NO_COINCIDE" });

    expect(r).toEqual({ marcado: true, numero: "VEL-AAAAAA" });
    expect(repo.estado.pedidos[0].expiraEn).toBeNull();
    expect(repo.estado.eventos).toEqual([
      expect.objectContaining({
        origen: "job",
        detalle: expect.stringContaining("MONTO_NO_COINCIDE"),
      }),
    ]);
  });

  it("deja el stock apartado: no cancela, no repone ni encola mails", async () => {
    const repo = crearRepositorio();

    await servicio(repo).marcarRevision(1, { motivo: "PAGO_EN_CURSO_SIN_RESOLVER" });

    expect(repo.estado.pedidos[0].estadoPago).toBe("pendiente");
    expect(repo.tx.actualizarEstados).not.toHaveBeenCalled();
    expect(repo.tx.reponerStock).not.toHaveBeenCalled();
    expect(repo.tx.encolarEmail).not.toHaveBeenCalled();
  });

  it("sobre un pedido ya aprobado (cobro duplicado) solo anota", async () => {
    const repo = crearRepositorio([pedido({ estadoPago: "aprobado", expiraEn: null })]);

    const r = await servicio(repo).marcarRevision(1, { motivo: "PAGO_DUPLICADO" });

    expect(r.marcado).toBe(true);
    expect(repo.tx.guardarDatosPago).not.toHaveBeenCalled();
    expect(repo.estado.eventos).toHaveLength(1);
  });

  it("devuelve NO_EXISTE si el pedido no está", async () => {
    const repo = crearRepositorio();

    expect(await servicio(repo).marcarRevision(99, { motivo: "X" })).toEqual({
      marcado: false,
      motivo: "NO_EXISTE",
    });
  });
});
