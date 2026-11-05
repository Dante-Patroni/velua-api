const { PedidoEstadoService, sinPuntosFinales } = require("../../src/services/PedidoEstadoService");

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const ADMIN = 1;
const MOTIVO = "La clienta pidió cancelar por WhatsApp";

const pedido = (cambios = {}) => ({
  id: 1,
  numero: "VEL-AAAAAA",
  clienteNombre: "Valentina",
  clienteEmail: "valentina@ejemplo.test",
  medioPago: "mercadopago",
  metodoEntrega: "envio",
  estadoPago: "aprobado",
  estadoPedido: "nuevo",
  comprobanteInformadoEn: null,
  ...cambios,
});

/**
 * @description Repositorio en memoria. La transacción copia el estado y lo
 * restaura si algo falla, como un ROLLBACK.
 * @param {Object} [datos] - Estado inicial.
 * @param {Object[]} [datos.pedidos] - Pedidos.
 * @param {Object[]} [datos.items] - Ítems con pedidoId, varianteId y cantidad.
 * @param {Object} [datos.stock] - Stock por varianteId.
 * @returns {Object} Repositorio falso con su estado y su transacción.
 */
function crearRepositorio({ pedidos = [pedido()], items = [], stock = {} } = {}) {
  let estado = {
    pedidos: pedidos.map((p) => ({ ...p })),
    items: items.map((i) => ({ ...i })),
    stock: { ...stock },
    eventos: [],
    emails: [],
  };
  const buscar = (id) => estado.pedidos.find((p) => p.id === id);

  const tx = {
    bloquearPedido: jest.fn(async (id) => {
      const p = buscar(id);
      return p ? { ...p } : null;
    }),
    listarItems: jest.fn(async (pedidoId) =>
      estado.items
        .filter((i) => i.pedidoId === pedidoId)
        .map(({ varianteId, cantidad }) => ({ varianteId, cantidad })),
    ),
    reponerStock: jest.fn(async (varianteId, cantidad) => {
      estado.stock[varianteId] = (estado.stock[varianteId] ?? 0) + cantidad;
    }),
    actualizarEstados: jest.fn(async (id, cambios) => {
      Object.assign(buscar(id), cambios);
    }),
    guardarSeguimiento: jest.fn(async (id, seguimiento) => {
      buscar(id).seguimiento = seguimiento;
    }),
    guardarAviso: jest.fn(async (id, fecha) => {
      buscar(id).comprobanteInformadoEn = fecha;
    }),
    guardarDatosPago: jest.fn(async (id, datos) => {
      Object.assign(buscar(id), datos);
    }),
    registrarEvento: jest.fn(async (evento) => {
      estado.eventos.push(evento);
    }),
    encolarEmail: jest.fn(async (email) => {
      estado.emails.push(email);
    }),
  };

  return {
    get estado() {
      return estado;
    },
    tx,
    transaccion: jest.fn(async (fn) => {
      const copia = JSON.parse(JSON.stringify(estado));
      try {
        return await fn(tx);
      } catch (error) {
        estado = copia;
        throw error;
      }
    }),
  };
}

const servicio = (repo) => new PedidoEstadoService(repo, () => AHORA);

describe("cambiarEstadoPreparacion", () => {
  test("pasa a en preparación con el pago aprobado y registra quién lo hizo", async () => {
    const repo = crearRepositorio();

    const r = await servicio(repo).cambiarEstadoPreparacion(1, {
      hacia: "en_preparacion",
      usuarioId: ADMIN,
    });

    expect(r).toEqual({ cambiado: true, numero: "VEL-AAAAAA" });
    expect(repo.estado.pedidos[0].estadoPedido).toBe("en_preparacion");
    expect(repo.estado.eventos).toEqual([
      expect.objectContaining({
        campo: "preparacion",
        estadoAnterior: "nuevo",
        estadoNuevo: "en_preparacion",
        origen: "panel",
        usuarioId: ADMIN,
      }),
    ]);
    expect(repo.estado.emails).toEqual([]);
  });

  test("no prepara un pedido sin pago aprobado", async () => {
    const repo = crearRepositorio({ pedidos: [pedido({ estadoPago: "pendiente" })] });

    await expect(
      servicio(repo).cambiarEstadoPreparacion(1, { hacia: "en_preparacion", usuarioId: ADMIN }),
    ).rejects.toThrow("PAGO_NO_APROBADO");

    expect(repo.estado.pedidos[0].estadoPedido).toBe("nuevo");
    expect(repo.estado.eventos).toEqual([]);
  });

  test("despacha un envío con seguimiento, lo guarda y encola el mail", async () => {
    const repo = crearRepositorio({ pedidos: [pedido({ estadoPedido: "en_preparacion" })] });

    await servicio(repo).cambiarEstadoPreparacion(1, {
      hacia: "enviado",
      seguimiento: "AB123456789AR",
      usuarioId: ADMIN,
    });

    expect(repo.estado.pedidos[0]).toMatchObject({
      estadoPedido: "enviado",
      seguimiento: "AB123456789AR",
    });
    expect(repo.estado.eventos[0].detalle).toContain("AB123456789AR");
    expect(repo.estado.emails).toEqual([
      expect.objectContaining({
        tipo: "pedido_enviado",
        destinatario: "valentina@ejemplo.test",
        datos: expect.objectContaining({ seguimiento: "AB123456789AR" }),
      }),
    ]);
  });

  test("no despacha un envío sin seguimiento", async () => {
    const repo = crearRepositorio({ pedidos: [pedido({ estadoPedido: "en_preparacion" })] });

    await expect(
      servicio(repo).cambiarEstadoPreparacion(1, { hacia: "enviado", usuarioId: ADMIN }),
    ).rejects.toThrow("SEGUIMIENTO_REQUERIDO");

    expect(repo.estado.pedidos[0].estadoPedido).toBe("en_preparacion");
    expect(repo.estado.emails).toEqual([]);
  });

  test("un retiro pasa a enviado sin seguimiento", async () => {
    const repo = crearRepositorio({
      pedidos: [pedido({ estadoPedido: "en_preparacion", metodoEntrega: "retiro" })],
    });

    await servicio(repo).cambiarEstadoPreparacion(1, { hacia: "enviado", usuarioId: ADMIN });

    expect(repo.estado.pedidos[0].estadoPedido).toBe("enviado");
    expect(repo.tx.guardarSeguimiento).not.toHaveBeenCalled();
    expect(repo.estado.emails[0].datos.seguimiento).toBeNull();
  });

  test("marca entregado un pedido enviado, sin mail", async () => {
    const repo = crearRepositorio({ pedidos: [pedido({ estadoPedido: "enviado" })] });

    await servicio(repo).cambiarEstadoPreparacion(1, { hacia: "entregado", usuarioId: ADMIN });

    expect(repo.estado.pedidos[0].estadoPedido).toBe("entregado");
    expect(repo.estado.emails).toEqual([]);
  });

  test("no salta estados: de nuevo a enviado es inválido", async () => {
    const repo = crearRepositorio();

    await expect(
      servicio(repo).cambiarEstadoPreparacion(1, {
        hacia: "enviado",
        seguimiento: "AB123456789AR",
        usuarioId: ADMIN,
      }),
    ).rejects.toThrow("TRANSICION_INVALIDA");

    expect(repo.estado.pedidos[0].estadoPedido).toBe("nuevo");
  });

  test("rechaza destinos fuera de la lista sin abrir la transacción", async () => {
    const repo = crearRepositorio();

    for (const hacia of ["cancelado", "nuevo", "__proto__", "toString"]) {
      await expect(
        servicio(repo).cambiarEstadoPreparacion(1, { hacia, usuarioId: ADMIN }),
      ).rejects.toThrow("TRANSICION_INVALIDA");
    }

    expect(repo.transaccion).not.toHaveBeenCalled();
  });

  test("repetir el estado actual no hace nada", async () => {
    const repo = crearRepositorio({ pedidos: [pedido({ estadoPedido: "en_preparacion" })] });

    const r = await servicio(repo).cambiarEstadoPreparacion(1, {
      hacia: "en_preparacion",
      usuarioId: ADMIN,
    });

    expect(r).toEqual({ cambiado: false, numero: "VEL-AAAAAA", motivo: "YA_REGISTRADO" });
    expect(repo.estado.eventos).toEqual([]);
  });

  test("un pedido inexistente da NO_ENCONTRADO", async () => {
    const repo = crearRepositorio({ pedidos: [] });

    await expect(
      servicio(repo).cambiarEstadoPreparacion(99, { hacia: "en_preparacion", usuarioId: ADMIN }),
    ).rejects.toThrow("NO_ENCONTRADO");
  });

  test("si falla encolar el mail, no queda despachado ni con seguimiento", async () => {
    const repo = crearRepositorio({ pedidos: [pedido({ estadoPedido: "en_preparacion" })] });
    repo.tx.encolarEmail.mockRejectedValueOnce(new Error("COLA_CAIDA"));

    await expect(
      servicio(repo).cambiarEstadoPreparacion(1, {
        hacia: "enviado",
        seguimiento: "AB123456789AR",
        usuarioId: ADMIN,
      }),
    ).rejects.toThrow("COLA_CAIDA");

    expect(repo.estado.pedidos[0].estadoPedido).toBe("en_preparacion");
    expect(repo.estado.pedidos[0].seguimiento).toBeUndefined();
    expect(repo.estado.eventos).toEqual([]);
  });
});

describe("cancelarManual", () => {
  const sinPagar = (cambios = {}) =>
    crearRepositorio({
      pedidos: [pedido({ estadoPago: "pendiente", ...cambios })],
      items: [
        { pedidoId: 1, varianteId: 7, cantidad: 2 },
        { pedidoId: 1, varianteId: 3, cantidad: 1 },
      ],
      stock: { 3: 5, 7: 0 },
    });

  test("cancela un pedido pendiente, repone en orden y registra el motivo", async () => {
    const repo = sinPagar();

    const r = await servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN });

    expect(r).toEqual({ cancelado: true, numero: "VEL-AAAAAA" });
    expect(repo.estado.stock).toEqual({ 3: 6, 7: 2 });
    expect(repo.tx.reponerStock.mock.calls.map(([v]) => v)).toEqual([3, 7]);
    expect(repo.estado.pedidos[0]).toMatchObject({
      estadoPago: "cancelado",
      estadoPedido: "cancelado",
    });
    expect(repo.estado.eventos).toHaveLength(2);
    for (const evento of repo.estado.eventos) {
      expect(evento).toMatchObject({ origen: "panel", usuarioId: ADMIN, estadoNuevo: "cancelado" });
    }
    expect(repo.estado.eventos[0].detalle).toContain(MOTIVO);
  });

  test("el motivo interno no viaja en el mail a la clienta", async () => {
    const repo = sinPagar();

    await servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN });

    expect(repo.estado.emails).toHaveLength(1);
    expect(repo.estado.emails[0]).toMatchObject({
      tipo: "pedido_cancelado",
      datos: expect.objectContaining({ motivo: "tienda" }),
    });
    expect(JSON.stringify(repo.estado.emails[0])).not.toContain(MOTIVO);
  });

  test("también cancela un pedido con el pago rechazado", async () => {
    const repo = sinPagar({ estadoPago: "rechazado" });

    const r = await servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN });

    expect(r.cancelado).toBe(true);
  });

  test("no cancela un pedido pagado: primero va la devolución", async () => {
    const repo = sinPagar({ estadoPago: "aprobado" });

    await expect(
      servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN }),
    ).rejects.toThrow("PEDIDO_PAGADO");

    expect(repo.tx.reponerStock).not.toHaveBeenCalled();
    expect(repo.estado.pedidos[0].estadoPago).toBe("aprobado");
  });

  test("con comprobante informado, exige confirmar que el dinero no llegó", async () => {
    const repo = sinPagar({ medioPago: "transferencia", comprobanteInformadoEn: AHORA });

    await expect(
      servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN }),
    ).rejects.toThrow("COMPROBANTE_INFORMADO");

    expect(repo.estado.stock).toEqual({ 3: 5, 7: 0 });
    expect(repo.estado.pedidos[0].estadoPago).toBe("pendiente");
  });

  test("con comprobante informado y la confirmación, cancela y lo deja anotado", async () => {
    const repo = sinPagar({ medioPago: "transferencia", comprobanteInformadoEn: AHORA });

    await servicio(repo).cancelarManual(1, {
      motivo: MOTIVO,
      confirmaSinPago: true,
      usuarioId: ADMIN,
    });

    expect(repo.estado.pedidos[0].estadoPago).toBe("cancelado");
    expect(repo.estado.eventos[0].detalle).toContain("se confirmó que el dinero no llegó");
  });

  test("sin motivo no cancela ni abre la transacción", async () => {
    const repo = sinPagar();

    for (const motivo of ["", "   ", undefined, null, ".....", " ... "]) {
      await expect(
        servicio(repo).cancelarManual(1, { motivo, usuarioId: ADMIN }),
      ).rejects.toThrow("DATOS_INVALIDOS");
    }

    expect(repo.transaccion).not.toHaveBeenCalled();
  });

  test("cancelar dos veces repone una sola vez", async () => {
    const repo = sinPagar();

    await servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN });
    const segunda = await servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN });

    expect(segunda).toEqual({ cancelado: false, numero: "VEL-AAAAAA", motivo: "YA_CANCELADO" });
    expect(repo.estado.stock).toEqual({ 3: 6, 7: 2 });
    expect(repo.estado.emails).toHaveLength(1);
  });

  test("no cancela un pedido devuelto", async () => {
    const repo = sinPagar({ estadoPago: "devuelto", estadoPedido: "cancelado" });

    await expect(
      servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN }),
    ).rejects.toThrow("TRANSICION_INVALIDA");
  });

  test("no cancela un pedido sin pagar que ya no está en nuevo (dato inconsistente)", async () => {
    const repo = sinPagar({ estadoPedido: "en_preparacion" });

    await expect(
      servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN }),
    ).rejects.toThrow("TRANSICION_INVALIDA");

    expect(repo.tx.reponerStock).not.toHaveBeenCalled();
  });

  test("si falla encolar el mail, no repone stock ni cancela", async () => {
    const repo = sinPagar();
    repo.tx.encolarEmail.mockRejectedValueOnce(new Error("COLA_CAIDA"));

    await expect(
      servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN }),
    ).rejects.toThrow("COLA_CAIDA");

    expect(repo.estado.stock).toEqual({ 3: 5, 7: 0 });
    expect(repo.estado.pedidos[0].estadoPago).toBe("pendiente");
    expect(repo.estado.eventos).toEqual([]);
  });


  test("no cancela un pedido con link de Mercado Pago", async () => {
    const repo = sinPagar({ mpPreferenceId: "pref-123", expiraEn: new Date("2026-10-07T15:30:00.000Z") });

    await expect(
      servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN }),
    ).rejects.toThrow("PAGO_EN_CURSO");

    expect(repo.tx.reponerStock).not.toHaveBeenCalled();
  });

  test("tampoco con la reserva vencida: puede haber un pago en proceso", async () => {
    const repo = sinPagar({ mpPreferenceId: "pref-123", expiraEn: new Date("2026-10-07T14:00:00.000Z") });

    await expect(
      servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN }),
    ).rejects.toThrow("PAGO_EN_CURSO");

    expect(repo.estado.pedidos[0].estadoPago).toBe("pendiente");
  });

  test("cancela un pedido de Mercado Pago que nunca tuvo link", async () => {
    const repo = sinPagar({ mpPreferenceId: null });

    const r = await servicio(repo).cancelarManual(1, { motivo: MOTIVO, usuarioId: ADMIN });

    expect(r.cancelado).toBe(true);
  });

  test.each(["Pidió cancelar.", "Pidió cancelar ...", "Pidió cancelar . . ."])(
    "un motivo como %j no queda con dos puntos",
    async (motivo) => {
      const repo = sinPagar();

      await servicio(repo).cancelarManual(1, { motivo, usuarioId: ADMIN });

      expect(repo.estado.eventos[0].detalle).toContain("Motivo: Pidió cancelar.");
      expect(repo.estado.eventos[0].detalle).not.toContain("..");
    },
  );
});

describe("registrarAviso", () => {
  const HORA = 60 * 60 * 1000;
  /** Pedido por transferencia, pendiente y con la reserva vigente. */
  const porTransferencia = (cambios = {}) =>
    pedido({
      medioPago: "transferencia",
      estadoPago: "pendiente",
      expiraEn: new Date(AHORA.getTime() + HORA),
      ...cambios,
    });
  const VENCIDO = { expiraEn: new Date(AHORA.getTime() - HORA) };

  test.each(["pendiente", "rechazado"])(
    "la clienta avisa con el pago %s: guarda la fecha y un evento",
    async (estadoPago) => {
      const repo = crearRepositorio({ pedidos: [porTransferencia({ estadoPago })] });

      const r = await servicio(repo).registrarAviso(1, { origen: "cliente" });

      expect(r).toEqual({ registrado: true, numero: "VEL-AAAAAA" });
      expect(repo.estado.pedidos[0].comprobanteInformadoEn).toEqual(AHORA);
      expect(repo.estado.pedidos[0].estadoPago).toBe(estadoPago);
      expect(repo.estado.eventos).toEqual([
        {
          pedidoId: 1,
          campo: "aviso",
          estadoAnterior: null,
          estadoNuevo: "comprobante_informado",
          origen: "cliente",
          usuarioId: null,
        },
      ]);
    }
  );

  test("bloquea el pedido antes de decidir", async () => {
    const repo = crearRepositorio({ pedidos: [porTransferencia()] });

    await servicio(repo).registrarAviso(1, { origen: "cliente" });

    expect(repo.tx.bloquearPedido).toHaveBeenCalledWith(1);
    expect(repo.tx.bloquearPedido.mock.invocationCallOrder[0]).toBeLessThan(
      repo.tx.guardarAviso.mock.invocationCallOrder[0]
    );
  });

  test.each([
    ["vigente", {}],
    ["vencido", VENCIDO],
  ])("un segundo aviso con la reserva %s no escribe nada", async (_caso, cambios) => {
    const avisado = porTransferencia({ comprobanteInformadoEn: AHORA, ...cambios });
    const repo = crearRepositorio({ pedidos: [avisado] });

    const r = await servicio(repo).registrarAviso(1, { origen: "cliente" });

    expect(r).toEqual({ registrado: false, numero: "VEL-AAAAAA", motivo: "YA_INFORMADO" });
    expect(repo.tx.guardarAviso).not.toHaveBeenCalled();
    expect(repo.estado.eventos).toHaveLength(0);
  });

  test("la clienta no puede avisar con la reserva vencida", async () => {
    const repo = crearRepositorio({ pedidos: [porTransferencia(VENCIDO)] });

    await expect(servicio(repo).registrarAviso(1, { origen: "cliente" })).rejects.toThrow(
      "PEDIDO_VENCIDO"
    );
    expect(repo.estado.pedidos[0].comprobanteInformadoEn).toBeNull();
    expect(repo.estado.eventos).toHaveLength(0);
  });

  test("la dueña sí puede avisar un pedido vencido, y queda su usuario", async () => {
    const repo = crearRepositorio({ pedidos: [porTransferencia(VENCIDO)] });

    const r = await servicio(repo).registrarAviso(1, { origen: "panel", usuarioId: ADMIN });

    expect(r.registrado).toBe(true);
    expect(repo.estado.eventos[0]).toMatchObject({ origen: "panel", usuarioId: ADMIN });
  });

  test.each([
    ["con Mercado Pago", { medioPago: "mercadopago" }, "PEDIDO_NO_PAGABLE"],
    ["con el pago aprobado", { estadoPago: "aprobado" }, "PEDIDO_YA_PAGADO"],
    ["cancelado", { estadoPago: "cancelado", estadoPedido: "cancelado" }, "PEDIDO_NO_PAGABLE"],
    ["devuelto", { estadoPago: "devuelto" }, "PEDIDO_NO_PAGABLE"],
  ])("%s responde %s sin escribir nada", async (_caso, cambios, codigo) => {
    const repo = crearRepositorio({ pedidos: [porTransferencia(cambios)] });

    await expect(
      servicio(repo).registrarAviso(1, { origen: "panel", usuarioId: ADMIN })
    ).rejects.toThrow(codigo);
    expect(repo.tx.guardarAviso).not.toHaveBeenCalled();
    expect(repo.estado.eventos).toHaveLength(0);
  });

  test("un pedido inexistente es NO_ENCONTRADO", async () => {
    const repo = crearRepositorio({ pedidos: [] });

    await expect(servicio(repo).registrarAviso(9, { origen: "cliente" })).rejects.toThrow(
      "NO_ENCONTRADO"
    );
  });

  test("con origen cliente, el usuario siempre queda null", async () => {
    const repo = crearRepositorio({ pedidos: [porTransferencia()] });

    await servicio(repo).registrarAviso(1, { origen: "cliente", usuarioId: 99 });

    expect(repo.estado.eventos[0].usuarioId).toBeNull();
  });

  test.each([
    ["el panel sin usuario", { origen: "panel" }],
    ["un origen desconocido", { origen: "job" }],
  ])("%s ni abre la transacción", async (_caso, aviso) => {
    const repo = crearRepositorio({ pedidos: [porTransferencia()] });

    await expect(servicio(repo).registrarAviso(1, aviso)).rejects.toThrow("registrarAviso");
    expect(repo.transaccion).not.toHaveBeenCalled();
  });
});

describe("confirmarPagoTransferencia", () => {
  const HORA = 60 * 60 * 1000;
  /** Pedido por transferencia, pendiente, avisado y con la reserva vigente. */
  const avisado = (cambios = {}) =>
    pedido({
      medioPago: "transferencia",
      estadoPago: "pendiente",
      expiraEn: new Date(AHORA.getTime() + HORA),
      comprobanteInformadoEn: AHORA,
      ...cambios,
    });
  const confirmar = (repo, datos = {}) =>
    servicio(repo).confirmarPagoTransferencia(1, {
      usuarioId: ADMIN,
      verificadoEnBanco: true,
      ...datos,
    });

  test("con el pago pendiente, lo aprueba, deja de vencer y encola el mail", async () => {
    const repo = crearRepositorio({ pedidos: [avisado()] });

    const r = await confirmar(repo);

    expect(r).toEqual({ confirmado: true, numero: "VEL-AAAAAA" });
    expect(repo.estado.pedidos[0]).toMatchObject({ estadoPago: "aprobado", expiraEn: null });
    expect(repo.estado.eventos).toEqual([
      expect.objectContaining({
        campo: "pago",
        estadoAnterior: "pendiente",
        estadoNuevo: "aprobado",
        origen: "panel",
        usuarioId: ADMIN,
      }),
    ]);
    expect(repo.estado.eventos[0].detalle).not.toContain("Sin aviso");
    expect(repo.estado.emails).toEqual([
      expect.objectContaining({ tipo: "pago_confirmado", destinatario: "valentina@ejemplo.test" }),
    ]);
  });

  test("no guarda datos de Mercado Pago: solo termina el vencimiento", async () => {
    const repo = crearRepositorio({ pedidos: [avisado()] });

    await confirmar(repo);

    expect(repo.tx.guardarDatosPago).toHaveBeenCalledWith(1, { expiraEn: null });
  });

  test("con el pago rechazado también se puede confirmar", async () => {
    const repo = crearRepositorio({ pedidos: [avisado({ estadoPago: "rechazado" })] });

    await expect(confirmar(repo)).resolves.toMatchObject({ confirmado: true });
  });

  test("sin aviso previo de la clienta, confirma y lo anota en el historial", async () => {
    const repo = crearRepositorio({ pedidos: [avisado({ comprobanteInformadoEn: null })] });

    await confirmar(repo);

    expect(repo.estado.eventos[0].detalle).toContain("Sin aviso previo de la clienta");
  });

  test("con la reserva vencida, mientras no esté cancelado, se puede confirmar", async () => {
    const vencido = avisado({ expiraEn: new Date(AHORA.getTime() - HORA) });
    const repo = crearRepositorio({ pedidos: [vencido] });

    await expect(confirmar(repo)).resolves.toMatchObject({ confirmado: true });
  });

  test("si ya estaba aprobado, responde YA_CONFIRMADO sin escribir nada", async () => {
    const repo = crearRepositorio({ pedidos: [avisado({ estadoPago: "aprobado" })] });

    const r = await confirmar(repo);

    expect(r).toEqual({ confirmado: false, numero: "VEL-AAAAAA", motivo: "YA_CONFIRMADO" });
    expect(repo.estado.eventos).toHaveLength(0);
    expect(repo.estado.emails).toHaveLength(0);
  });

  test.each([
    ["con Mercado Pago", { medioPago: "mercadopago", estadoPago: "pendiente" }],
    ["cancelado", { estadoPago: "cancelado", estadoPedido: "cancelado" }],
    ["devuelto", { estadoPago: "devuelto" }],
  ])("%s responde PEDIDO_NO_PAGABLE sin escribir nada", async (_caso, cambios) => {
    const repo = crearRepositorio({ pedidos: [avisado(cambios)] });

    await expect(confirmar(repo)).rejects.toThrow("PEDIDO_NO_PAGABLE");
    expect(repo.estado.eventos).toHaveLength(0);
    expect(repo.estado.emails).toHaveLength(0);
  });

  test("un pedido inexistente es NO_ENCONTRADO", async () => {
    const repo = crearRepositorio({ pedidos: [] });

    await expect(confirmar(repo)).rejects.toThrow("NO_ENCONTRADO");
  });

  test.each([false, "true", 1, undefined])(
    "sin verificadoEnBanco exactamente true (%j) no abre la transacción",
    async (valor) => {
      const repo = crearRepositorio({ pedidos: [avisado()] });

      await expect(confirmar(repo, { verificadoEnBanco: valor })).rejects.toThrow(
        "DATOS_INVALIDOS"
      );
      expect(repo.transaccion).not.toHaveBeenCalled();
    }
  );

  test("sin usuario de la sesión no abre la transacción", async () => {
    const repo = crearRepositorio({ pedidos: [avisado()] });

    await expect(confirmar(repo, { usuarioId: undefined })).rejects.toThrow(
      "confirmarPagoTransferencia"
    );
    expect(repo.transaccion).not.toHaveBeenCalled();
  });
});

describe("sinPuntosFinales", () => {
  test("saca los puntos y espacios del final", () => {
    expect(sinPuntosFinales("Pidió cancelar.")).toBe("Pidió cancelar");
    expect(sinPuntosFinales("Pidió cancelar ...")).toBe("Pidió cancelar");
    expect(sinPuntosFinales(".....")).toBe("");
    expect(sinPuntosFinales("")).toBe("");
  });

  test("no toca los puntos del medio", () => {
    expect(sinPuntosFinales("Pidió cancelar. Llamó de nuevo")).toBe("Pidió cancelar. Llamó de nuevo");
  });

  test("es lineal: las tiradas enormes de puntos no la frenan (ReDoS)", () => {
    for (const entrada of [`${".".repeat(200_000)}x`, ".".repeat(200_000)]) {
      const inicio = performance.now();
      sinPuntosFinales(entrada);
      expect(performance.now() - inicio).toBeLessThan(100);
    }
  });
});