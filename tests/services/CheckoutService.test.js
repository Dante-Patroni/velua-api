const { CheckoutService, generarNumero, ALFABETO } = require("../../src/services/CheckoutService");

const AHORA = new Date("2026-10-06T15:00:00.000Z");
const HORA = 60 * 60 * 1000;

/**
 * Variante tal como la devuelve la lectura con bloqueo.
 */
const variante = (cambios = {}) => ({
  id: 1,
  nombre: "100 g",
  sku: "VEL-ECLAT-NOIR",
  precio: "8500.00",
  stock: 10,
  activa: true,
  productoId: 1,
  producto: { id: 1, nombre: "Éclat Noir", slug: "eclat-noir", activo: true },
  ...cambios,
});

const ZONA = { id: 5, nombre: "Provincia de Córdoba", costo: "6500.00", activa: true };

/**
 * Repositorio en memoria que simula la transacción: si el trabajo lanza un error,
 * el estado vuelve a como estaba. Es lo que permite probar que una falla a mitad de
 * camino no deja nada.
 */
const crearRepositorio = ({ variantes = [variante()], zonas = [ZONA] } = {}) => {
  const estado = {
    variantes: variantes.map((v) => structuredClone(v)),
    pedidos: [],
    items: [],
    eventos: [],
    emails: [],
  };

  const tx = {
    buscarVariantes: jest.fn(async (ids) =>
      estado.variantes.filter((v) => ids.includes(v.id)).map((v) => structuredClone(v))
    ),
    buscarZonaEnvio: jest.fn(async (id) => zonas.find((z) => z.id === id) ?? null),
    listarZonasEnvio: jest.fn(async () => zonas),
    descontarStock: jest.fn(async (id, cantidad) => {
      const v = estado.variantes.find((x) => x.id === id);
      if (!v || v.stock < cantidad) throw new Error("STOCK_INSUFICIENTE");
      v.stock -= cantidad;
    }),
    existeNumero: jest.fn(async (numero) => estado.pedidos.some((p) => p.numero === numero)),
    crearPedido: jest.fn(async (datos) => {
      const pedido = { id: estado.pedidos.length + 1, ...datos };
      estado.pedidos.push(pedido);
      return pedido;
    }),
    crearItems: jest.fn(async (items) => estado.items.push(...items)),
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
    buscarPorNumero: jest.fn(),
  };
};

/**
 * Entrada válida de checkout, con envío.
 */
const entrada = (cambios = {}) => ({
  items: [{ varianteId: 1, cantidad: 2 }],
  cliente: { nombre: " Lucía Fernández ", email: "Lucia@Ejemplo.TEST", telefono: "358 412-3344" },
  entrega: {
    metodo: "envio",
    zonaEnvioId: 5,
    direccion: {
      calle: "Av. Colón",
      numero: "1250",
      ciudad: "Córdoba",
      provincia: "Córdoba",
      cp: "5000",
    },
  },
  medioPago: "mercadopago",
  totalEsperado: "23500.00",
  ...cambios,
});

const servicioCon = (repositorio, config = {}) =>
  new CheckoutService(repositorio, config, () => AHORA);

describe("CheckoutService", () => {
  describe("crearPedido, el camino feliz", () => {
    it("crea el pedido con los totales del cotizador", async () => {
      const repo = crearRepositorio();

      const r = await servicioCon(repo).crearPedido(entrada());

      expect(r.total).toBe("23500.00");
      expect(r.estadoPago).toBe("pendiente");
      expect(repo.estado.pedidos).toHaveLength(1);
      expect(repo.estado.pedidos[0]).toMatchObject({
        subtotal: "17000.00",
        costoEnvio: "6500.00",
        total: "23500.00",
        medioPago: "mercadopago",
      });
    });

    it("descuenta el stock", async () => {
      const repo = crearRepositorio();

      await servicioCon(repo).crearPedido(entrada());

      expect(repo.estado.variantes[0].stock).toBe(8);
    });

    it("congela nombre, precio y SKU en los ítems", async () => {
      // Si mañana cambia el precio del jabón, el pedido de hoy tiene que seguir
      // mostrando lo que se cobró
      const repo = crearRepositorio();

      await servicioCon(repo).crearPedido(entrada());

      expect(repo.estado.items[0]).toMatchObject({
        varianteId: 1,
        nombreProducto: "Éclat Noir",
        nombreVariante: "100 g",
        sku: "VEL-ECLAT-NOIR",
        precioUnitario: "8500.00",
        cantidad: 2,
        subtotal: "17000.00",
      });
    });

    it("limpia y normaliza los datos de la clienta", async () => {
      const repo = crearRepositorio();

      await servicioCon(repo).crearPedido(entrada());

      expect(repo.estado.pedidos[0].clienteNombre).toBe("Lucía Fernández");
      expect(repo.estado.pedidos[0].clienteEmail).toBe("lucia@ejemplo.test");
    });

    it("genera un número con el formato y el alfabeto acordados", async () => {
      const repo = crearRepositorio();

      const { numero } = await servicioCon(repo).crearPedido(entrada());

      expect(numero).toMatch(new RegExp(`^VEL-[${ALFABETO}]{6}$`));
    });

    it("registra el primer evento de la bitácora", async () => {
      const repo = crearRepositorio();

      await servicioCon(repo).crearPedido(entrada());

      expect(repo.estado.eventos[0]).toMatchObject({
        campo: "pago",
        estadoAnterior: null,
        estadoNuevo: "pendiente",
        origen: "checkout",
      });
    });

    it("deja el mail de confirmación en la bandeja de salida", async () => {
      const repo = crearRepositorio();

      const { numero } = await servicioCon(repo).crearPedido(entrada());

      expect(repo.estado.emails[0]).toMatchObject({
        tipo: "pedido_recibido",
        destinatario: "lucia@ejemplo.test",
      });
      expect(repo.estado.emails[0].datos.numero).toBe(numero);
      expect(repo.estado.emails[0].datos.totales.total).toBe("23500.00");
    });
  });

  describe("vencimiento de la reserva", () => {
    it("aparta el stock una hora con Mercado Pago", async () => {
      const repo = crearRepositorio();

      const r = await servicioCon(repo).crearPedido(entrada({ medioPago: "mercadopago" }));

      expect(r.expiraEn.getTime() - AHORA.getTime()).toBe(1 * HORA);
    });

    it("aparta el stock veinticuatro horas con transferencia", async () => {
      const repo = crearRepositorio();

      const r = await servicioCon(repo).crearPedido(entrada({ medioPago: "transferencia" }));

      expect(r.expiraEn.getTime() - AHORA.getTime()).toBe(24 * HORA);
    });
  });

  describe("nunca cobrar algo distinto de lo que la clienta vio", () => {
    it("rechaza si el carrito cambió, sin dejar nada", async () => {
      // Pide 5 y hay 3: el cotizador ajustaria y avisaria, el checkout rechaza
      const repo = crearRepositorio({ variantes: [variante({ stock: 3 })] });

      await expect(
        servicioCon(repo).crearPedido(
          entrada({ items: [{ varianteId: 1, cantidad: 5 }], totalEsperado: "49000.00" })
        )
      ).rejects.toThrow("CARRITO_DESACTUALIZADO");

      expect(repo.estado.variantes[0].stock).toBe(3);
      expect(repo.estado.pedidos).toHaveLength(0);
    });

    it("rechaza si el total no coincide con el que se mostró, sin dejar nada", async () => {
      // El precio cambio mientras la clienta compraba
      const repo = crearRepositorio({ variantes: [variante({ precio: "9200.00" })] });

      await expect(servicioCon(repo).crearPedido(entrada())).rejects.toThrow("TOTAL_CAMBIO");

      expect(repo.estado.variantes[0].stock).toBe(10);
      expect(repo.estado.pedidos).toHaveLength(0);
      expect(repo.estado.emails).toHaveLength(0);
    });

    it("compara totales en centavos, no como texto", async () => {
      const repo = crearRepositorio();

      const r = await servicioCon(repo).crearPedido(entrada({ totalEsperado: "23500" }));

      expect(r.total).toBe("23500.00");
    });

    it("aplica el descuento por transferencia al total", async () => {
      const repo = crearRepositorio();
      const servicio = servicioCon(repo, { descuentoTransferencia: 10 });

      // 17000 menos 1700 de descuento, mas 6500 de envio
      const r = await servicio.crearPedido(
        entrada({ medioPago: "transferencia", totalEsperado: "21800.00" })
      );

      expect(r.total).toBe("21800.00");
      expect(repo.estado.pedidos[0].ajustePago).toBe("1700.00");
    });
  });

  describe("todo o nada", () => {
    it("si falla el encolado del mail, se deshace todo", async () => {
      // Un pedido sin su mail de confirmacion es un pedido que la clienta no sabe
      // si se hizo
      const repo = crearRepositorio();
      repo.tx.encolarEmail.mockRejectedValue(new Error("ERROR_DE_BASE"));

      await expect(servicioCon(repo).crearPedido(entrada())).rejects.toThrow("ERROR_DE_BASE");

      expect(repo.estado.variantes[0].stock).toBe(10);
      expect(repo.estado.pedidos).toHaveLength(0);
      expect(repo.estado.items).toHaveLength(0);
      expect(repo.estado.eventos).toHaveLength(0);
    });

    it("si no alcanza el stock al descontar, se deshace todo", async () => {
      const repo = crearRepositorio();
      repo.tx.descontarStock.mockRejectedValue(new Error("STOCK_INSUFICIENTE"));

      await expect(servicioCon(repo).crearPedido(entrada())).rejects.toThrow("STOCK_INSUFICIENTE");

      expect(repo.estado.pedidos).toHaveLength(0);
    });
  });

  describe("bloqueo en orden", () => {
    it("descuenta el stock en orden ascendente de id", async () => {
      // Las filas ya estan bloqueadas en orden, y el descuento sigue el mismo orden
      const repo = crearRepositorio({
        variantes: [
          variante({ id: 3, producto: { id: 3, nombre: "C", slug: "c", activo: true } }),
          variante({ id: 1 }),
          variante({ id: 2, producto: { id: 2, nombre: "B", slug: "b", activo: true } }),
        ],
      });

      await servicioCon(repo).crearPedido(
        entrada({
          items: [
            { varianteId: 3, cantidad: 1 },
            { varianteId: 1, cantidad: 1 },
            { varianteId: 2, cantidad: 1 },
          ],
          totalEsperado: "32000.00",
        })
      );

      const ids = repo.tx.descontarStock.mock.calls.map(([id]) => id);
      expect(ids).toEqual([1, 2, 3]);
    });
  });

  describe("entrega", () => {
    it("con retiro no guarda zona ni dirección, y no cobra envío", async () => {
      const repo = crearRepositorio();

      const r = await servicioCon(repo).crearPedido(
        entrada({ entrega: { metodo: "retiro" }, totalEsperado: "17000.00" })
      );

      expect(r.total).toBe("17000.00");
      expect(repo.estado.pedidos[0]).toMatchObject({
        metodoEntrega: "retiro",
        zonaEnvioId: null,
        direccionCalle: null,
        costoEnvio: "0.00",
      });
    });

    it("con envío exige la zona", async () => {
      const repo = crearRepositorio();
      const e = entrada();
      delete e.entrega.zonaEnvioId;

      await expect(servicioCon(repo).crearPedido(e)).rejects.toMatchObject({
        message: "DATOS_INVALIDOS",
        details: { "entrega.zonaEnvioId": expect.any(String) },
      });
    });

    it("con envío exige la dirección completa y dice qué falta", async () => {
      const repo = crearRepositorio();
      const e = entrada();
      e.entrega.direccion.cp = "";
      e.entrega.direccion.ciudad = "  ";

      await expect(servicioCon(repo).crearPedido(e)).rejects.toMatchObject({
        message: "DATOS_INVALIDOS",
        details: {
          "entrega.direccion.cp": expect.any(String),
          "entrega.direccion.ciudad": expect.any(String),
        },
      });
    });

    it("rechaza un método de entrega desconocido", async () => {
      const repo = crearRepositorio();

      await expect(
        servicioCon(repo).crearPedido(entrada({ entrega: { metodo: "drone" } }))
      ).rejects.toThrow("DATOS_INVALIDOS");
    });
  });

  describe("validación de forma", () => {
    it("exige un medio de pago conocido", async () => {
      const repo = crearRepositorio();

      await expect(
        servicioCon(repo).crearPedido(entrada({ medioPago: "efectivo" }))
      ).rejects.toMatchObject({
        message: "DATOS_INVALIDOS",
        details: { medioPago: expect.any(String) },
      });
    });

    it("exige un total esperado con forma de importe", async () => {
      const repo = crearRepositorio();

      await expect(
        servicioCon(repo).crearPedido(entrada({ totalEsperado: "mucho" }))
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("no abre la transacción si los datos no son coherentes", async () => {
      const repo = crearRepositorio();

      await servicioCon(repo)
        .crearPedido(entrada({ medioPago: "efectivo" }))
        .catch(() => {});

      expect(repo.transaccion).not.toHaveBeenCalled();
    });
  });

  describe("número de pedido", () => {
    it("reintenta si el número ya existe", async () => {
      const repo = crearRepositorio();
      repo.tx.existeNumero.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await servicioCon(repo).crearPedido(entrada());

      expect(repo.tx.existeNumero).toHaveBeenCalledTimes(2);
    });

    it("nunca usa caracteres que se confunden al dictar", () => {
      for (let i = 0; i < 2000; i++) {
        expect(generarNumero().slice(4)).not.toMatch(/[01OIL]/);
      }
    });

    it("genera números distintos", () => {
      const numeros = new Set(Array.from({ length: 2000 }, generarNumero));

      expect(numeros.size).toBe(2000);
    });
  });

  describe("consultarPorNumero", () => {
    const pedidoGuardado = {
      numero: "VEL-4K7Q2X",
      clienteNombre: "Lucía Fernández",
      clienteEmail: "lucia@ejemplo.test",
      clienteTelefono: "358 412-3344",
      direccionCalle: "Av. Colón",
      estadoPago: "pendiente",
      estadoPedido: "nuevo",
      medioPago: "transferencia",
      metodoEntrega: "envio",
      expiraEn: AHORA,
      comprobanteInformadoEn: null,
      seguimiento: null,
      creadoEn: AHORA,
      subtotal: "17000.00",
      descuentoCupon: "0.00",
      ajustePago: "0.00",
      costoEnvio: "6500.00",
      total: "23500.00",
      items: [
        {
          nombreProducto: "Éclat Noir",
          nombreVariante: "100 g",
          cantidad: 2,
          precioUnitario: "8500.00",
          subtotal: "17000.00",
        },
      ],
    };

    it("no expone ningún dato personal", async () => {
      // Es publico: quien tenga el numero solo ve que se compro y en que estado esta
      const repo = crearRepositorio();
      repo.buscarPorNumero.mockResolvedValue(pedidoGuardado);

      const r = await servicioCon(repo).consultarPorNumero("VEL-4K7Q2X");
      const texto = JSON.stringify(r);

      expect(texto).not.toContain("Lucía");
      expect(texto).not.toContain("lucia@");
      expect(texto).not.toContain("358");
      expect(texto).not.toContain("Colón");
    });

    it("devuelve el estado, los ítems y los totales", async () => {
      const repo = crearRepositorio();
      repo.buscarPorNumero.mockResolvedValue(pedidoGuardado);

      const r = await servicioCon(repo).consultarPorNumero("VEL-4K7Q2X");

      expect(r).toMatchObject({
        numero: "VEL-4K7Q2X",
        estadoPago: "pendiente",
        comprobanteInformado: false,
        totales: { total: "23500.00" },
      });
      expect(r.items[0].producto).toBe("Éclat Noir");
    });

    it("acepta el número en minúsculas", async () => {
      const repo = crearRepositorio();
      repo.buscarPorNumero.mockResolvedValue(pedidoGuardado);

      await servicioCon(repo).consultarPorNumero("vel-4k7q2x");

      expect(repo.buscarPorNumero).toHaveBeenCalledWith("VEL-4K7Q2X");
    });

    it("rechaza un número mal formado sin consultar la base", async () => {
      const repo = crearRepositorio();

      await expect(servicioCon(repo).consultarPorNumero("'; DROP TABLE")).rejects.toThrow(
        "NO_ENCONTRADO"
      );
      expect(repo.buscarPorNumero).not.toHaveBeenCalled();
    });

    it("lanza NO_ENCONTRADO si no existe", async () => {
      const repo = crearRepositorio();
      repo.buscarPorNumero.mockResolvedValue(null);

      await expect(servicioCon(repo).consultarPorNumero("VEL-ZZZZZZ")).rejects.toThrow(
        "NO_ENCONTRADO"
      );
    });
  });
});
