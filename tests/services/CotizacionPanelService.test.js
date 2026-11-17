const { CotizacionPanelService } = require("../../src/services/CotizacionPanelService");
const { Cotizador } = require("../../src/services/cotizador");

/** Configuración del panel con los dos medios habilitados y descuentos distintos. */
const config = (cambios = {}) => ({
  umbralEnvioGratis: null,
  descuentoEfectivo: 10,
  descuentoTransferencia: 5,
  mediosDisponibles: { efectivo: true, transferencia: true },
  ...cambios,
});

/** Carrito como llega de la ruta (matchedData). */
const datos = (cambios = {}) => ({
  items: [
    { varianteId: 2, cantidad: 1 },
    { varianteId: 1, cantidad: 2 },
  ],
  entrega: { metodo: "en_mano" },
  ...cambios,
});

/** Cotizador falso: registra con qué se lo llamó. */
const cotizadorFalso = () => ({
  cotizar: jest.fn(async () => ({
    totales: { total: "1.00" },
    mediosPago: {
      efectivo: { disponible: true, total: "1.00" },
      transferencia: { disponible: true, total: "1.00" },
      mercadopago: { disponible: false, total: null },
    },
  })),
});

describe("CotizacionPanelService", () => {
  test("pide el efectivo y pasa el carrito normalizado", async () => {
    const cotizador = cotizadorFalso();
    const servicio = new CotizacionPanelService(cotizador, config());

    await expect(servicio.cotizar(datos({ medioPago: "efectivo" }))).resolves.toEqual({
      totales: { total: "1.00" },
      mediosPago: {
        efectivo: { disponible: true, total: "1.00" },
        transferencia: { disponible: true, total: "1.00" },
      },
    });
    expect(cotizador.cotizar).toHaveBeenCalledWith({
      items: [
        { varianteId: 1, cantidad: 2 },
        { varianteId: 2, cantidad: 1 },
      ],
      zonaEnvioId: null,
      medioPago: "efectivo",
      incluirEfectivo: true,
    });
  });

  // El servicio recibe solo lo validado, pero no confía en eso: incluirEfectivo lo
  // fija él, venga lo que venga.
  test("un incluirEfectivo en los datos no cambia nada", async () => {
    const cotizador = cotizadorFalso();

    await new CotizacionPanelService(cotizador, config()).cotizar(
      datos({ incluirEfectivo: false })
    );

    expect(cotizador.cotizar.mock.calls[0][0].incluirEfectivo).toBe(true);
  });

  test("con envío, pasa la zona", async () => {
    const cotizador = cotizadorFalso();

    await new CotizacionPanelService(cotizador, config()).cotizar(
      datos({ entrega: { metodo: "envio", zonaEnvioId: 3 } })
    );

    expect(cotizador.cotizar.mock.calls[0][0].zonaEnvioId).toBe(3);
  });

  test("sin medio de pago cotiza aunque un medio esté deshabilitado", async () => {
    const cotizador = cotizadorFalso();
    const servicio = new CotizacionPanelService(
      cotizador,
      config({ mediosDisponibles: { efectivo: true, transferencia: false } })
    );

    await servicio.cotizar(datos());

    expect(cotizador.cotizar.mock.calls[0][0].medioPago).toBeNull();
  });

  test.each([
    ["un medio deshabilitado", { medioPago: "transferencia" }, "MEDIO_PAGO_NO_DISPONIBLE"],
    ["Mercado Pago", { medioPago: "mercadopago" }, "DATOS_INVALIDOS"],
    ["una zona con retiro", { entrega: { metodo: "retiro", zonaEnvioId: 3 } }, "DATOS_INVALIDOS"],
    ["envío sin zona", { entrega: { metodo: "envio" } }, "DATOS_INVALIDOS"],
    [
      "una variante repetida",
      {
        items: [
          { varianteId: 1, cantidad: 1 },
          { varianteId: 1, cantidad: 2 },
        ],
      },
      "DATOS_INVALIDOS",
    ],
  ])("%s: %s, sin llamar al cotizador", async (_caso, cambios, codigo) => {
    const cotizador = cotizadorFalso();
    const servicio = new CotizacionPanelService(
      cotizador,
      config({ mediosDisponibles: { efectivo: true, transferencia: false } })
    );

    await expect(servicio.cotizar(datos(cambios))).rejects.toThrow(codigo);
    expect(cotizador.cotizar).not.toHaveBeenCalled();
  });
});

describe("CotizacionPanelService con el cotizador real", () => {
  const variante = (id, precio) => ({
    id,
    nombre: "100 g",
    precio,
    stock: 20,
    activa: true,
    productoId: id,
    producto: {
      id,
      nombre: `Jabón ${id}`,
      slug: `jabon-${id}`,
      activo: true,
      disponibleDesde: null,
    },
  });
  const repositorio = {
    buscarVariantes: jest.fn(async (ids) =>
      [variante(1, "10000.00"), variante(2, "20000.00")].filter((v) => ids.includes(v.id))
    ),
    buscarZonaEnvio: jest.fn(async () => null),
    listarZonasEnvio: jest.fn(async () => []),
  };
  const servicioCon = (cfg) => new CotizacionPanelService(new Cotizador(repositorio, cfg), cfg);

  // 40000 de subtotal: 10 % en efectivo y 5 % por transferencia.
  test("cada medio trae su total, con su descuento", async () => {
    const { mediosPago } = await servicioCon(config()).cotizar(datos());

    expect(mediosPago.efectivo).toEqual({ disponible: true, total: "36000.00" });
    expect(mediosPago.transferencia).toEqual({ disponible: true, total: "38000.00" });
  });

  test("sin medio elegido, totales.total no lleva descuento: no es el de ningún medio", async () => {
    const { totales, mediosPago } = await servicioCon(config()).cotizar(datos());

    expect(totales.total).toBe("40000.00");
    expect(totales.total).not.toBe(mediosPago.efectivo.total);
    expect(totales.total).not.toBe(mediosPago.transferencia.total);
  });

  // Es el número que la venta compara con totalEsperado.
  test.each(["efectivo", "transferencia"])(
    "con %s elegido, totales.total es el total de ese medio",
    async (medioPago) => {
      const { totales, mediosPago } = await servicioCon(config()).cotizar(datos({ medioPago }));

      expect(totales.total).toBe(mediosPago[medioPago].total);
    }
  );

  test("un medio deshabilitado, sin elegir: disponible false y sin total", async () => {
    const cfg = config({ mediosDisponibles: { efectivo: true, transferencia: false } });

    const { mediosPago } = await servicioCon(cfg).cotizar(datos());

    expect(mediosPago.transferencia).toEqual({ disponible: false, total: null });
    expect(mediosPago.efectivo.disponible).toBe(true);
  });

  test("mediosPago trae solo los medios del panel", async () => {
    const { mediosPago } = await servicioCon(config()).cotizar(datos());

    expect(Object.keys(mediosPago).sort()).toEqual(["efectivo", "transferencia"]);
  });
});
