const { PedidoAdminService } = require("../../src/services/PedidoAdminService");

const CREADO = new Date("2026-10-20T23:20:24.000Z");

/** Pedido tal como lo devuelve el repositorio, con ítems y eventos. */
const PEDIDO = {
  id: 7,
  numero: "VEL-ABC234",
  creadoEn: CREADO,
  clienteNombre: "Ana Pérez",
  clienteEmail: "ana@example.com",
  clienteTelefono: "3584000000",
  clienteDocumento: "30111222",
  metodoEntrega: "envio",
  zonaEnvioId: 2,
  zonaEnvio: { id: 2, nombre: "Río Cuarto" },
  direccionCalle: "Av. Colón",
  direccionNumero: "1250",
  direccionExtra: null,
  direccionCiudad: "Río Cuarto",
  direccionProvincia: "Córdoba",
  direccionCp: "5800",
  subtotal: "17000.00",
  descuentoCupon: "0.00",
  ajustePago: "1700.00",
  costoEnvio: "2000.00",
  total: "17300.00",
  estadoPago: "aprobado",
  estadoPedido: "nuevo",
  medioPago: "transferencia",
  mpPreferenceId: "pref-interna",
  mpPaymentId: null,
  mpMetodo: null,
  expiraEn: null,
  comprobanteInformadoEn: CREADO,
  seguimiento: null,
  notasCliente: "Tocar timbre",
  notasInternas: null,
  items: [
    {
      id: 1,
      varianteId: 3,
      nombreProducto: "Éclat Noir",
      nombreVariante: "100 g",
      sku: "EN-100",
      precioUnitario: "8500.00",
      cantidad: 2,
      subtotal: "17000.00",
    },
  ],
  eventos: [
    {
      id: 1,
      campo: "pago",
      estadoAnterior: null,
      estadoNuevo: "pendiente",
      origen: "checkout",
      usuarioId: null,
      detalle: null,
      creadoEn: CREADO,
    },
  ],
};

/**
 * @description Repositorio falso con un solo pedido.
 * @returns {Object} Repositorio con listarParaPanel y buscarParaPanel.
 */
const crearRepositorio = () => ({
  listarParaPanel: jest.fn().mockResolvedValue({ filas: [PEDIDO], total: 1 }),
  buscarParaPanel: jest.fn().mockResolvedValue(PEDIDO),
});

describe("PedidoAdminService.listar", () => {
  it("usa página 1 y 20 por página si no se piden otros", async () => {
    const repositorio = crearRepositorio();

    const r = await new PedidoAdminService(repositorio).listar();

    expect(repositorio.listarParaPanel).toHaveBeenCalledWith({
      estadoPago: null,
      estadoPedido: null,
      pagina: 1,
      limite: 20,
    });
    expect(r.meta).toEqual({ pagina: 1, limite: 20, total: 1 });
  });

  it("pasa los filtros al repositorio", async () => {
    const repositorio = crearRepositorio();

    await new PedidoAdminService(repositorio).listar({
      estadoPago: "pendiente",
      estadoPedido: "nuevo",
      pagina: 2,
      limite: 10,
    });

    expect(repositorio.listarParaPanel).toHaveBeenCalledWith({
      estadoPago: "pendiente",
      estadoPedido: "nuevo",
      pagina: 2,
      limite: 10,
    });
  });

  it("la lista muestra lo mínimo: sin mail, teléfono, documento ni dirección", async () => {
    const r = await new PedidoAdminService(crearRepositorio()).listar();

    expect(r.datos).toEqual([
      {
        id: 7,
        numero: "VEL-ABC234",
        creadoEn: CREADO,
        clienteNombre: "Ana Pérez",
        total: "17300.00",
        medioPago: "transferencia",
        estadoPago: "aprobado",
        estadoPedido: "nuevo",
        metodoEntrega: "envio",
        expiraEn: null,
      },
    ]);
  });
});

describe("PedidoAdminService.detalle", () => {
  it("devuelve contacto, entrega, totales con descuentos, ítems y eventos", async () => {
    const r = await new PedidoAdminService(crearRepositorio()).detalle(7);

    expect(r.cliente).toEqual({
      nombre: "Ana Pérez",
      email: "ana@example.com",
      telefono: "3584000000",
      documento: "30111222",
    });
    expect(r.entrega).toEqual({
      metodo: "envio",
      zona: "Río Cuarto",
      direccion: {
        calle: "Av. Colón",
        numero: "1250",
        extra: null,
        ciudad: "Río Cuarto",
        provincia: "Córdoba",
        cp: "5800",
      },
      seguimiento: null,
    });
    expect(r.totales).toEqual({
      subtotal: "17000.00",
      descuentoCupon: "0.00",
      ajusteMedioPago: "1700.00",
      costoEnvio: "2000.00",
      total: "17300.00",
    });
    expect(r.items).toHaveLength(1);
    expect(r.eventos).toHaveLength(1);
  });

  it("con retiro, la dirección es null", async () => {
    const repositorio = crearRepositorio();
    repositorio.buscarParaPanel.mockResolvedValue({
      ...PEDIDO,
      metodoEntrega: "retiro",
      zonaEnvioId: null,
      zonaEnvio: null,
      direccionCalle: null,
      direccionNumero: null,
      direccionCiudad: null,
      direccionProvincia: null,
      direccionCp: null,
    });

    const r = await new PedidoAdminService(repositorio).detalle(7);

    expect(r.entrega).toEqual({ metodo: "retiro", zona: null, direccion: null, seguimiento: null });
  });

  it("no expone datos internos del procesador de pagos", async () => {
    const r = await new PedidoAdminService(crearRepositorio()).detalle(7);

    expect(JSON.stringify(r)).not.toContain("pref-interna");
  });

  it("si no existe, lanza NO_ENCONTRADO", async () => {
    const repositorio = crearRepositorio();
    repositorio.buscarParaPanel.mockResolvedValue(null);

    await expect(new PedidoAdminService(repositorio).detalle(999)).rejects.toThrow("NO_ENCONTRADO");
  });
});
