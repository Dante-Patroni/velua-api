const { Cotizador, AVISOS, TOPE_POR_VARIANTE } = require("../../src/services/cotizador");

/**
 * Variante como la devuelve el repositorio, con su producto.
 */
const variante = (cambios = {}) => ({
  id: 1,
  nombre: "100 g",
  precio: "8500.00",
  stock: 20,
  activa: true,
  productoId: 1,
  producto: { id: 1, nombre: "Éclat Noir", slug: "eclat-noir", activo: true },
  ...cambios,
});

const zona = (cambios = {}) => ({
  id: 1,
  nombre: "Provincia de Córdoba",
  costo: "6500.00",
  demoraTexto: "2 a 4 días hábiles",
  activa: true,
  ...cambios,
});

/**
 * Repositorio simulado a partir de las variantes y zonas que se le pasen.
 */
const repositorioCon = (variantes, zonas = []) => ({
  buscarVariantes: jest.fn(async (ids) => variantes.filter((v) => ids.includes(v.id))),
  buscarZonaEnvio: jest.fn(async (id) => zonas.find((z) => z.id === id) ?? null),
  listarZonasEnvio: jest.fn(async () => zonas),
});

describe("Cotizador", () => {
  describe("validación del carrito", () => {
    const servicio = new Cotizador(repositorioCon([variante()]));

    it("rechaza un carrito vacío", async () => {
      await expect(servicio.cotizar({ items: [] })).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza una cantidad de cero o negativa", async () => {
      await expect(servicio.cotizar({ items: [{ varianteId: 1, cantidad: 0 }] })).rejects.toThrow(
        "DATOS_INVALIDOS"
      );
      await expect(servicio.cotizar({ items: [{ varianteId: 1, cantidad: -3 }] })).rejects.toThrow(
        "DATOS_INVALIDOS"
      );
    });

    it("rechaza una cantidad con decimales", async () => {
      await expect(servicio.cotizar({ items: [{ varianteId: 1, cantidad: 2.5 }] })).rejects.toThrow(
        "DATOS_INVALIDOS"
      );
    });

    it("rechaza la misma variante dos veces", async () => {
      // Dos lineas de lo mismo darian un subtotal correcto pero un carrito confuso
      await expect(
        servicio.cotizar({
          items: [
            { varianteId: 1, cantidad: 1 },
            { varianteId: 1, cantidad: 2 },
          ],
        })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("indica el índice del ítem que falla", async () => {
      // La clave va como arreglo: toHaveProperty leeria los corchetes como
      // acceso a un arreglo y buscaria en el lugar equivocado
      expect.assertions(1);

      await servicio
        .cotizar({
          items: [
            { varianteId: 1, cantidad: 1 },
            { varianteId: 2, cantidad: 0 },
          ],
        })
        .catch((e) => {
          expect(e.details).toHaveProperty(["items[1].cantidad"]);
        });
    });
  });

  describe("el precio sale de la base, no del carrito", () => {
    it("ignora cualquier precio que venga en el ítem", async () => {
      // Si el precio viniera del cliente, cualquiera podria comprar a cero
      const servicio = new Cotizador(repositorioCon([variante({ precio: "8500.00" })]));

      const r = await servicio.cotizar({
        items: [{ varianteId: 1, cantidad: 2, precio: "1.00", subtotal: "2.00" }],
      });

      expect(r.items[0].precioUnitario).toBe("8500.00");
      expect(r.totales.subtotal).toBe("17000.00");
    });
  });

  describe("subtotal", () => {
    it("suma precio por cantidad de cada línea", async () => {
      const servicio = new Cotizador(
        repositorioCon([
          variante({ id: 1, precio: "8500.00" }),
          variante({
            id: 2,
            precio: "5500.00",
            producto: { id: 2, nombre: "Velours", slug: "velours", activo: true },
          }),
        ])
      );

      const r = await servicio.cotizar({
        items: [
          { varianteId: 1, cantidad: 3 },
          { varianteId: 2, cantidad: 2 },
        ],
      });

      expect(r.totales.subtotal).toBe("36500.00");
      expect(r.items[0].subtotal).toBe("25500.00");
      expect(r.items[1].subtotal).toBe("11000.00");
    });

    it("conserva los centavos sin error de punto flotante", async () => {
      const servicio = new Cotizador(repositorioCon([variante({ precio: "333.33" })]));

      const r = await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 3 }] });

      expect(r.totales.subtotal).toBe("999.99");
    });
  });

  describe("descuento por medio de pago", () => {
    it("aplica el porcentaje configurado con transferencia", async () => {
      const servicio = new Cotizador(repositorioCon([variante()]), {
        descuentoTransferencia: 10,
      });

      const r = await servicio.cotizar({
        items: [{ varianteId: 1, cantidad: 1 }],
        medioPago: "transferencia",
      });

      expect(r.totales.ajusteMedioPago).toBe("850.00");
      expect(r.totales.total).toBe("7650.00");
    });

    it("no descuenta con otro medio de pago", async () => {
      const servicio = new Cotizador(repositorioCon([variante()]), {
        descuentoTransferencia: 10,
      });

      const r = await servicio.cotizar({
        items: [{ varianteId: 1, cantidad: 1 }],
        medioPago: "mercadopago",
      });

      expect(r.totales.ajusteMedioPago).toBe("0.00");
    });

    it("no descuenta si no se eligió medio de pago", async () => {
      const servicio = new Cotizador(repositorioCon([variante()]), {
        descuentoTransferencia: 10,
      });

      const r = await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 1 }] });

      expect(r.totales.ajusteMedioPago).toBe("0.00");
    });

    it("no descuenta si el porcentaje no está configurado", async () => {
      const servicio = new Cotizador(repositorioCon([variante()]));

      const r = await servicio.cotizar({
        items: [{ varianteId: 1, cantidad: 1 }],
        medioPago: "transferencia",
      });

      expect(r.totales.ajusteMedioPago).toBe("0.00");
    });
  });

  describe("envío", () => {
    it("sin zona, cotiza como retiro y no cobra envío", async () => {
      const servicio = new Cotizador(repositorioCon([variante()], [zona()]));

      const r = await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 1 }] });

      expect(r.totales.costoEnvio).toBe("0.00");
      expect(r.envio.modo).toBe("retiro");
    });

    it("cobra la tarifa de la zona elegida", async () => {
      const servicio = new Cotizador(repositorioCon([variante()], [zona()]));

      const r = await servicio.cotizar({
        items: [{ varianteId: 1, cantidad: 1 }],
        zonaEnvioId: 1,
      });

      expect(r.totales.costoEnvio).toBe("6500.00");
      expect(r.totales.total).toBe("15000.00");
      expect(r.envio.nombre).toBe("Provincia de Córdoba");
    });

    it("rechaza una zona que no existe", async () => {
      const servicio = new Cotizador(repositorioCon([variante()], [zona()]));

      await expect(
        servicio.cotizar({ items: [{ varianteId: 1, cantidad: 1 }], zonaEnvioId: 99 })
      ).rejects.toThrow("ZONA_INVALIDA");
    });

    it("no cobra envío al llegar al umbral", async () => {
      const servicio = new Cotizador(repositorioCon([variante()], [zona()]), {
        umbralEnvioGratis: "30000.00",
      });

      const r = await servicio.cotizar({
        items: [{ varianteId: 1, cantidad: 4 }],
        zonaEnvioId: 1,
      });

      expect(r.totales.costoEnvio).toBe("0.00");
      expect(r.envio.gratis).toBe(true);
    });

    it("cobra envío si el descuento baja el monto por debajo del umbral", async () => {
      // Es la razon por la que el envio se calcula DESPUES de los descuentos:
      // si fuera antes, la marca regalaria el envio de un pedido que ya no llega
      const servicio = new Cotizador(repositorioCon([variante()], [zona()]), {
        umbralEnvioGratis: "34000.00",
        descuentoTransferencia: 10,
      });

      const r = await servicio.cotizar({
        items: [{ varianteId: 1, cantidad: 4 }],
        zonaEnvioId: 1,
        medioPago: "transferencia",
      });

      expect(r.totales.subtotal).toBe("34000.00");
      expect(r.totales.ajusteMedioPago).toBe("3400.00");
      expect(r.totales.costoEnvio).toBe("6500.00");
      expect(r.envio.gratis).toBe(false);
    });

    it("sin umbral configurado, el envío nunca es gratis", async () => {
      const servicio = new Cotizador(repositorioCon([variante()], [zona()]));

      const r = await servicio.cotizar({
        items: [{ varianteId: 1, cantidad: 10 }],
        zonaEnvioId: 1,
      });

      expect(r.totales.costoEnvio).toBe("6500.00");
    });
  });

  describe("disponibilidad", () => {
    it("avisa y saca una variante que no existe", async () => {
      const servicio = new Cotizador(repositorioCon([variante({ id: 1 })]));

      const r = await servicio.cotizar({
        items: [
          { varianteId: 1, cantidad: 1 },
          { varianteId: 99, cantidad: 1 },
        ],
      });

      expect(r.items).toHaveLength(1);
      expect(r.avisos[0].motivo).toBe(AVISOS.VARIANTE_INEXISTENTE);
    });

    it("avisa y saca una variante desactivada", async () => {
      const servicio = new Cotizador(
        repositorioCon([variante({ id: 1 }), variante({ id: 2, activa: false })])
      );

      const r = await servicio.cotizar({
        items: [
          { varianteId: 1, cantidad: 1 },
          { varianteId: 2, cantidad: 1 },
        ],
      });

      expect(r.items).toHaveLength(1);
      expect(r.avisos[0].motivo).toBe(AVISOS.VARIANTE_INACTIVA);
    });

    it("avisa y saca una variante de un producto despublicado", async () => {
      const servicio = new Cotizador(
        repositorioCon([
          variante({ id: 1 }),
          variante({
            id: 2,
            producto: { id: 2, nombre: "Velours", slug: "velours", activo: false },
          }),
        ])
      );

      const r = await servicio.cotizar({
        items: [
          { varianteId: 1, cantidad: 1 },
          { varianteId: 2, cantidad: 1 },
        ],
      });

      expect(r.items).toHaveLength(1);
      expect(r.avisos[0].motivo).toBe(AVISOS.PRODUCTO_INACTIVO);
    });

    it("avisa y saca una variante sin stock", async () => {
      const servicio = new Cotizador(
        repositorioCon([variante({ id: 1 }), variante({ id: 2, stock: 0 })])
      );

      const r = await servicio.cotizar({
        items: [
          { varianteId: 1, cantidad: 1 },
          { varianteId: 2, cantidad: 1 },
        ],
      });

      expect(r.items).toHaveLength(1);
      expect(r.avisos[0].motivo).toBe(AVISOS.SIN_STOCK);
    });

    it("falla si no queda ningún ítem vendible", async () => {
      const servicio = new Cotizador(repositorioCon([variante({ stock: 0 })]));

      await expect(servicio.cotizar({ items: [{ varianteId: 1, cantidad: 1 }] })).rejects.toThrow(
        "CARRITO_SIN_ITEMS_VALIDOS"
      );
    });
  });

  describe("límites de cantidad", () => {
    it("ajusta al stock disponible y avisa cuánto queda", async () => {
      const servicio = new Cotizador(repositorioCon([variante({ stock: 3 })]));

      const r = await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 8 }] });

      expect(r.items[0].cantidad).toBe(3);
      expect(r.avisos[0].motivo).toBe(AVISOS.AJUSTADO_POR_STOCK);
      expect(r.avisos[0].pedida).toBe(8);
      expect(r.avisos[0].disponible).toBe(3);
    });

    it("avisa una sola vez cuando los dos límites recortan", async () => {
      // Pide 50, hay 12 y el tope es 10: dos avisos se contradirian entre si
      const servicio = new Cotizador(repositorioCon([variante({ stock: 12 })]));

      const r = await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 50 }] });

      expect(r.items[0].cantidad).toBe(10);
      expect(r.avisos).toHaveLength(1);
      expect(r.avisos[0].motivo).toBe(AVISOS.AJUSTADO_POR_TOPE);
    });

    it("ajusta al tope comercial aunque haya stock de sobra", async () => {
      // El stock es un hecho; el tope es una decision de la marca. Un pedido de
      // cincuenta unidades es mayorista y se habla por WhatsApp.
      const servicio = new Cotizador(repositorioCon([variante({ stock: 100 })]));

      const r = await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 50 }] });

      expect(r.items[0].cantidad).toBe(TOPE_POR_VARIANTE);
      expect(r.avisos[0].motivo).toBe(AVISOS.AJUSTADO_POR_TOPE);
      expect(r.avisos[0].maximo).toBe(TOPE_POR_VARIANTE);
    });

    it("el stock manda cuando es menor que el tope", async () => {
      const servicio = new Cotizador(repositorioCon([variante({ stock: 4 })]));

      const r = await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 50 }] });

      expect(r.items[0].cantidad).toBe(4);
      expect(r.avisos[0].motivo).toBe(AVISOS.AJUSTADO_POR_STOCK);
    });

    it("el subtotal usa la cantidad ajustada, no la pedida", async () => {
      const servicio = new Cotizador(repositorioCon([variante({ stock: 2 })]));

      const r = await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 9 }] });

      expect(r.totales.subtotal).toBe("17000.00");
    });
  });

  describe("cotizar no modifica nada", () => {
    it("no toca el stock de las variantes", async () => {
      const repositorio = repositorioCon([variante({ stock: 20 })]);
      const servicio = new Cotizador(repositorio);

      await servicio.cotizar({ items: [{ varianteId: 1, cantidad: 5 }] });

      // El repositorio de cotizacion es de solo lectura: no expone escrituras
      expect(Object.keys(repositorio)).toEqual([
        "buscarVariantes",
        "buscarZonaEnvio",
        "listarZonasEnvio",
      ]);
    });

    it("busca todas las variantes en una sola consulta", async () => {
      const repositorio = repositorioCon([
        variante({ id: 1 }),
        variante({ id: 2 }),
        variante({ id: 3 }),
      ]);
      const servicio = new Cotizador(repositorio);

      await servicio.cotizar({
        items: [
          { varianteId: 1, cantidad: 1 },
          { varianteId: 2, cantidad: 1 },
          { varianteId: 3, cantidad: 1 },
        ],
      });

      expect(repositorio.buscarVariantes).toHaveBeenCalledTimes(1);
      expect(repositorio.buscarVariantes).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe("listarZonasEnvio", () => {
    it("devuelve los costos como cadena", async () => {
      const servicio = new Cotizador(repositorioCon([], [zona()]));

      const zonas = await servicio.listarZonasEnvio();

      expect(zonas[0].costo).toBe("6500.00");
      expect(typeof zonas[0].costo).toBe("string");
    });

    it("no expone campos internos de la zona", async () => {
      const servicio = new Cotizador(repositorioCon([], [zona()]));

      const [z] = await servicio.listarZonasEnvio();

      expect(z).not.toHaveProperty("activa");
      expect(z).not.toHaveProperty("orden");
    });
  });
});
