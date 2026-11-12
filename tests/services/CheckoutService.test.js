const crypto = require("crypto");
const { CheckoutService, generarNumero, ALFABETO } = require("../../src/services/CheckoutService");
const { normalizarVenta, huellaDeVenta } = require("../../src/services/ventaPanel");

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
  producto: {
    id: 1,
    nombre: "Éclat Noir",
    slug: "eclat-noir",
    activo: true,
    disponibleDesde: null,
  },
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
      // Como el índice único de la base: otra venta con la misma clave ya guardada.
      if (datos.claveVenta && estado.pedidos.some((p) => p.claveVenta === datos.claveVenta)) {
        throw new Error("CLAVE_VENTA_DUPLICADA");
      }
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
    buscarPorClaveVenta: jest.fn(
      async (clave) => estado.pedidos.find((p) => p.claveVenta === clave) ?? null
    ),
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

/** Servicio con la transferencia habilitada, salvo que el test diga otra cosa. */
const servicioCon = (repositorio, config = {}) =>
  new CheckoutService(repositorio, { transferenciaHabilitada: true, ...config }, () => AHORA);

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

  describe("transferencia sin datos bancarios", () => {
    it.each([
      ["deshabilitada", (repo) => servicioCon(repo, { transferenciaHabilitada: false })],
      ["sin configurar", (repo) => new CheckoutService(repo, {}, () => AHORA)],
    ])("%s: rechaza sin crear el pedido ni apartar stock", async (_caso, armar) => {
      const repo = crearRepositorio();

      await expect(
        armar(repo).crearPedido(entrada({ medioPago: "transferencia" }))
      ).rejects.toThrow("MEDIO_PAGO_NO_DISPONIBLE");

      expect(repo.estado.variantes[0].stock).toBe(10);
      expect(repo.estado.pedidos).toHaveLength(0);
      expect(repo.estado.emails).toHaveLength(0);
    });

    it("Mercado Pago sigue funcionando aunque la transferencia esté deshabilitada", async () => {
      const repo = crearRepositorio();

      const r = await servicioCon(repo, { transferenciaHabilitada: false }).crearPedido(
        entrada({ medioPago: "mercadopago" })
      );

      expect(r.medioPago).toBe("mercadopago");
      expect(repo.estado.pedidos).toHaveLength(1);
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
          variante({
            id: 3,
            producto: { id: 3, nombre: "C", slug: "c", activo: true, disponibleDesde: null },
          }),
          variante({ id: 1 }),
          variante({
            id: 2,
            producto: { id: 2, nombre: "B", slug: "b", activo: true, disponibleDesde: null },
          }),
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

    // Antes: "genera 2000 números distintos". Con 31^6 combinaciones, dos iguales
    // salían ~1 de cada 450 corridas aunque el código estuviera bien. Que no se
    // repitan depende del azar de crypto, que no es código nuestro; lo nuestro es
    // usarlo bien y qué pasa cuando igual choca. Eso se prueba siempre igual.
    it("arma cada carácter con crypto.randomInt sobre el alfabeto", () => {
      const azar = jest.spyOn(crypto, "randomInt");
      for (const indice of [0, 1, 2, 28, 29, 30]) azar.mockReturnValueOnce(indice);

      try {
        expect(generarNumero()).toBe("VEL-234XYZ");
        expect(azar).toHaveBeenCalledTimes(6);
        for (const [maximo] of azar.mock.calls) expect(maximo).toBe(ALFABETO.length);
      } finally {
        azar.mockRestore();
      }
    });

    it("si cinco números seguidos ya existen, falla en vez de repetir uno", async () => {
      const repo = crearRepositorio();
      repo.tx.existeNumero.mockResolvedValue(true);

      await expect(servicioCon(repo).crearPedido(entrada())).rejects.toThrow(
        "No se pudo generar un número de pedido libre"
      );
      expect(repo.tx.existeNumero).toHaveBeenCalledTimes(5);
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

    describe("datos para transferir", () => {
      const DATOS = {
        alias: "velua.prueba.mp",
        cbu: "0000000000000000000000",
        titular: "Tienda de Prueba",
      };
      /** Pedido por transferencia, pendiente y con la reserva vigente. */
      const vigente = (cambios = {}) => ({
        ...pedidoGuardado,
        expiraEn: new Date(AHORA.getTime() + HORA),
        ...cambios,
      });
      const consultar = async (pedido, config = { datosTransferencia: DATOS }) => {
        const repo = crearRepositorio();
        repo.buscarPorNumero.mockResolvedValue(pedido);
        return servicioCon(repo, config).consultarPorNumero("VEL-4K7Q2X");
      };

      it("con el pago pendiente y la reserva vigente, trae los datos y el monto", async () => {
        const r = await consultar(vigente());

        expect(r.transferencia).toEqual({ ...DATOS, monto: "23500.00" });
      });

      it("vencido pero con aviso, los sigue mostrando: espera a la dueña", async () => {
        const r = await consultar(
          vigente({ expiraEn: new Date(AHORA.getTime() - HORA), comprobanteInformadoEn: AHORA })
        );

        expect(r.transferencia).toEqual({ ...DATOS, monto: "23500.00" });
      });

      it.each([
        ["con Mercado Pago", vigente({ medioPago: "mercadopago" }), undefined],
        ["con el pago aprobado", vigente({ estadoPago: "aprobado" }), undefined],
        ["cancelado", vigente({ estadoPago: "cancelado" }), undefined],
        ["vencido sin aviso", vigente({ expiraEn: new Date(AHORA.getTime() - HORA) }), undefined],
        [
          "con la transferencia deshabilitada",
          vigente(),
          { transferenciaHabilitada: false, datosTransferencia: DATOS },
        ],
        ["sin datos configurados", vigente(), {}],
      ])("%s no los muestra", async (_caso, pedido, config) => {
        const r = await consultar(pedido, config);

        expect(r.transferencia).toBeNull();
      });
    });

    it("lanza NO_ENCONTRADO si no existe", async () => {
      const repo = crearRepositorio();
      repo.buscarPorNumero.mockResolvedValue(null);

      await expect(servicioCon(repo).consultarPorNumero("VEL-ZZZZZZ")).rejects.toThrow(
        "NO_ENCONTRADO"
      );
    });
  });

  describe("informarComprobante", () => {
    /** Servicio con un registrarAviso falso: las reglas se prueban en PedidoEstadoService. */
    const armar = (resultado = { registrado: true, numero: "VEL-4K7Q2X" }) => {
      const repo = crearRepositorio();
      repo.buscarPorNumero.mockResolvedValue({ id: 7, numero: "VEL-4K7Q2X" });
      const pedidoEstadoService = { registrarAviso: jest.fn().mockResolvedValue(resultado) };
      const servicio = new CheckoutService(repo, {}, () => AHORA, null, console, {
        pedidoEstadoService,
      });
      return { repo, servicio, pedidoEstadoService };
    };

    it("busca el pedido por número y registra el aviso con origen cliente, sin usuario", async () => {
      const { servicio, pedidoEstadoService } = armar();

      const r = await servicio.informarComprobante("vel-4k7q2x");

      expect(pedidoEstadoService.registrarAviso).toHaveBeenCalledWith(7, { origen: "cliente" });
      expect(r).toEqual({ numero: "VEL-4K7Q2X", comprobanteInformado: true });
    });

    it("un segundo aviso responde lo mismo que el primero", async () => {
      const { servicio } = armar({
        registrado: false,
        numero: "VEL-4K7Q2X",
        motivo: "YA_INFORMADO",
      });

      await expect(servicio.informarComprobante("VEL-4K7Q2X")).resolves.toEqual({
        numero: "VEL-4K7Q2X",
        comprobanteInformado: true,
      });
    });

    it("un número mal formado es NO_ENCONTRADO, sin consultar la base", async () => {
      const { servicio, repo, pedidoEstadoService } = armar();

      await expect(servicio.informarComprobante("'; DROP TABLE")).rejects.toThrow("NO_ENCONTRADO");
      expect(repo.buscarPorNumero).not.toHaveBeenCalled();
      expect(pedidoEstadoService.registrarAviso).not.toHaveBeenCalled();
    });

    it("un pedido inexistente es NO_ENCONTRADO, sin registrar nada", async () => {
      const { servicio, repo, pedidoEstadoService } = armar();
      repo.buscarPorNumero.mockResolvedValue(null);

      await expect(servicio.informarComprobante("VEL-ZZZZZZ")).rejects.toThrow("NO_ENCONTRADO");
      expect(pedidoEstadoService.registrarAviso).not.toHaveBeenCalled();
    });

    it("deja pasar los errores de las reglas, como PEDIDO_VENCIDO", async () => {
      const { servicio, pedidoEstadoService } = armar();
      pedidoEstadoService.registrarAviso.mockRejectedValue(new Error("PEDIDO_VENCIDO"));

      await expect(servicio.informarComprobante("VEL-4K7Q2X")).rejects.toThrow("PEDIDO_VENCIDO");
    });
  });
});

describe("registrarVentaDelPanel", () => {
  const ADMIN = 1;
  const CLAVE = "3f1c2a9e-5b7d-4e8a-9c21-7d4e5f6a8b90";

  /** Venta en mano, cobrada en efectivo: 2 × 8500 con 10 % de descuento. */
  const venta = (cambios = {}) => ({
    items: [{ varianteId: 1, cantidad: 2 }],
    cliente: { nombre: " Ana Gómez ", telefono: " 358 400-1122 " },
    entrega: { metodo: "en_mano" },
    medioPago: "efectivo",
    cobradoEnEfectivo: true,
    totalEsperado: "15300.00",
    ...cambios,
  });

  /** Servicio del panel: efectivo y transferencia habilitados, 10 % cada uno. */
  const panelCon = (repo, config = {}) =>
    new CheckoutService(
      repo,
      {
        descuentoEfectivo: 10,
        descuentoTransferencia: 10,
        mediosDisponibles: { efectivo: true, transferencia: true },
        ...config,
      },
      () => AHORA
    );

  const registrar = (repo, datos = venta(), contexto = {}, config = {}) =>
    panelCon(repo, config).registrarVentaDelPanel(datos, {
      usuarioId: ADMIN,
      claveVenta: CLAVE,
      ...contexto,
    });

  describe("efectivo cobrado al registrar", () => {
    it("crea el pedido del panel con el pago aprobado y sin vencimiento", async () => {
      const repo = crearRepositorio();

      const r = await registrar(repo);

      expect(r.creada).toBe(true);
      expect(r.venta).toEqual({
        id: 1,
        numero: expect.stringMatching(/^VEL-[A-Z0-9]{6}$/),
        total: "15300.00",
        estadoPago: "aprobado",
        medioPago: "efectivo",
      });
      expect(repo.estado.pedidos[0]).toMatchObject({
        canal: "panel",
        estadoPago: "aprobado",
        expiraEn: null,
        clienteNombre: "Ana Gómez",
        clienteTelefono: "358 400-1122",
        clienteEmail: null,
        metodoEntrega: "en_mano",
        zonaEnvioId: null,
        direccionCalle: null,
        claveVenta: CLAVE,
        huellaVenta: expect.stringMatching(/^[0-9a-f]{64}$/),
      });
    });

    it("un solo evento, — → aprobado, con el usuario de la sesión", async () => {
      const repo = crearRepositorio();

      await registrar(repo);

      expect(repo.estado.eventos).toEqual([
        {
          pedidoId: 1,
          campo: "pago",
          estadoAnterior: null,
          estadoNuevo: "aprobado",
          origen: "panel",
          usuarioId: ADMIN,
          detalle: "Cobrado en efectivo al registrar la venta",
        },
      ]);
    });

    it("descuenta el stock una vez", async () => {
      const repo = crearRepositorio();

      await registrar(repo);

      expect(repo.estado.variantes[0].stock).toBe(8);
    });
  });

  describe("pendientes", () => {
    it.each([
      ["efectivo sin cobrar", { cobradoEnEfectivo: false }],
      ["efectivo sin decir si se cobró", { cobradoEnEfectivo: undefined }],
      ["transferencia", { medioPago: "transferencia", cobradoEnEfectivo: undefined }],
    ])("%s: pago pendiente, sin vencimiento", async (_caso, cambios) => {
      const repo = crearRepositorio();

      const r = await registrar(repo, venta(cambios));

      expect(r.venta.estadoPago).toBe("pendiente");
      expect(repo.estado.pedidos[0]).toMatchObject({ estadoPago: "pendiente", expiraEn: null });
      expect(repo.estado.eventos).toEqual([
        expect.objectContaining({
          estadoAnterior: null,
          estadoNuevo: "pendiente",
          origen: "panel",
          usuarioId: ADMIN,
          detalle: "Venta registrada desde el panel",
        }),
      ]);
    });
  });

  describe("mails", () => {
    it("sin email, se crea igual y no se encola nada", async () => {
      const repo = crearRepositorio();

      await registrar(repo);

      expect(repo.estado.pedidos).toHaveLength(1);
      expect(repo.estado.emails).toEqual([]);
    });

    it("con email, un solo pedido_recibido, sin vencimiento y con el pago aprobado", async () => {
      const repo = crearRepositorio();
      const conEmail = venta({ cliente: { ...venta().cliente, email: " Ana@Ejemplo.TEST " } });

      await registrar(repo, conEmail);

      expect(repo.estado.emails).toHaveLength(1);
      expect(repo.estado.emails[0]).toMatchObject({
        tipo: "pedido_recibido",
        destinatario: "ana@ejemplo.test",
        datos: { estadoPago: "aprobado", expiraEn: null, medioPago: "efectivo" },
      });
    });
  });

  describe("envío", () => {
    it("guarda la dirección y cobra el envío de la zona", async () => {
      const repo = crearRepositorio();
      const conEnvio = venta({
        entrega: {
          metodo: "envio",
          zonaEnvioId: 5,
          direccion: {
            calle: "Sobremonte",
            numero: "1200",
            ciudad: "Río Cuarto",
            provincia: "Córdoba",
            cp: "5800",
          },
        },
        totalEsperado: "21800.00",
      });

      const r = await registrar(repo, conEnvio);

      expect(r.venta.total).toBe("21800.00");
      expect(repo.estado.pedidos[0]).toMatchObject({
        metodoEntrega: "envio",
        zonaEnvioId: 5,
        direccionCalle: "Sobremonte",
        costoEnvio: "6500.00",
      });
    });
  });

  describe("medio deshabilitado por su configuración", () => {
    // Un DESCUENTO_EFECTIVO inválido deja { habilitado: false, descuento: 0 }: sin la
    // puerta, la venta se cobraría sin descuento y sin aviso (revisión del #73).
    it.each([
      [
        "efectivo",
        venta(),
        { descuentoEfectivo: 0, mediosDisponibles: { efectivo: false, transferencia: true } },
      ],
      [
        "transferencia",
        venta({ medioPago: "transferencia", cobradoEnEfectivo: undefined }),
        { mediosDisponibles: { efectivo: true, transferencia: false } },
      ],
      ["sin mediosDisponibles", venta(), { mediosDisponibles: undefined }],
    ])("%s: MEDIO_PAGO_NO_DISPONIBLE, sin cotizar ni crear nada", async (_caso, datos, config) => {
      const repo = crearRepositorio();

      await expect(registrar(repo, datos, {}, config)).rejects.toThrow("MEDIO_PAGO_NO_DISPONIBLE");
      expect(repo.transaccion).not.toHaveBeenCalled();
      expect(repo.estado.pedidos).toEqual([]);
      expect(repo.estado.variantes[0].stock).toBe(10);
    });
  });

  describe("idempotencia", () => {
    it("un reintento con la misma clave y la misma venta devuelve la original, sin tocar nada", async () => {
      const repo = crearRepositorio();
      const primera = await registrar(repo);

      // La misma venta, escrita distinto: espacios, y la clave en mayúsculas
      const reintento = await registrar(
        repo,
        venta({
          cliente: { nombre: "Ana Gómez", telefono: "358 400-1122" },
          totalEsperado: "15300",
        }),
        { claveVenta: CLAVE.toUpperCase() }
      );

      expect(reintento).toEqual({ creada: false, venta: primera.venta });
      expect(repo.transaccion).toHaveBeenCalledTimes(1);
      expect(repo.estado.pedidos).toHaveLength(1);
      expect(repo.estado.eventos).toHaveLength(1);
      expect(repo.estado.variantes[0].stock).toBe(8);
    });

    it("el reintento devuelve el estado actual del pedido", async () => {
      const repo = crearRepositorio();
      await registrar(repo, venta({ cobradoEnEfectivo: false }));
      repo.estado.pedidos[0].estadoPago = "cancelado";

      const r = await registrar(repo, venta({ cobradoEnEfectivo: false }));

      expect(r.venta.estadoPago).toBe("cancelado");
    });

    it("la misma clave con otra venta: CLAVE_REUTILIZADA, sin crear nada", async () => {
      const repo = crearRepositorio();
      await registrar(repo);

      await expect(
        registrar(
          repo,
          venta({ items: [{ varianteId: 1, cantidad: 1 }], totalEsperado: "7650.00" })
        )
      ).rejects.toThrow("CLAVE_REUTILIZADA");
      expect(repo.estado.pedidos).toHaveLength(1);
      expect(repo.estado.variantes[0].stock).toBe(8);
    });

    describe("carrera: otro reintento guardó primero", () => {
      /**
       * Simula dos pedidos simultáneos: cuando este busca la clave, todavía no hay
       * nada; cuando intenta guardar, la otra venta ya está (el índice lo frena).
       */
      const yaGuardadaPorOtro = (datos) => {
        const repo = crearRepositorio();
        repo.estado.pedidos.push({
          id: 41,
          numero: "VEL-OTRA23",
          total: "15300.00",
          estadoPago: "aprobado",
          medioPago: "efectivo",
          claveVenta: CLAVE,
          huellaVenta: huellaDeVenta(normalizarVenta(datos)),
        });
        repo.buscarPorClaveVenta.mockResolvedValueOnce(null);
        return repo;
      };

      it("misma venta: vuelve atrás entera y responde como reintento", async () => {
        const repo = yaGuardadaPorOtro(venta());

        const r = await registrar(repo);

        expect(r).toEqual({
          creada: false,
          venta: {
            id: 41,
            numero: "VEL-OTRA23",
            total: "15300.00",
            estadoPago: "aprobado",
            medioPago: "efectivo",
          },
        });
        // Lo que esta transacción había hecho volvió atrás
        expect(repo.estado.variantes[0].stock).toBe(10);
        expect(repo.estado.pedidos).toHaveLength(1);
        expect(repo.estado.eventos).toEqual([]);
        expect(repo.estado.emails).toEqual([]);
      });

      it("otra venta: CLAVE_REUTILIZADA", async () => {
        const repo = yaGuardadaPorOtro(venta({ notas: "Otra venta" }));

        await expect(registrar(repo)).rejects.toThrow("CLAVE_REUTILIZADA");
        expect(repo.estado.variantes[0].stock).toBe(10);
      });
    });

    it("otro error de la base no se confunde con un reintento", async () => {
      const repo = crearRepositorio();
      repo.tx.crearPedido.mockRejectedValueOnce(new Error("ER_LOCK_DEADLOCK"));

      await expect(registrar(repo)).rejects.toThrow("ER_LOCK_DEADLOCK");
      expect(repo.buscarPorClaveVenta).toHaveBeenCalledTimes(1);
    });
  });

  describe("lo que se guarda es lo que entra en la huella", () => {
    it("la huella guardada es la de la venta normalizada, y sus datos son los guardados", async () => {
      const repo = crearRepositorio();
      const datos = venta({
        notas: "  Pasa a la tarde ",
        cliente: { ...venta().cliente, documento: " 30111222 " },
      });

      await registrar(repo, datos);

      const normalizada = normalizarVenta(datos);
      const guardado = repo.estado.pedidos[0];
      expect(guardado.huellaVenta).toBe(huellaDeVenta(normalizada));
      expect(guardado).toMatchObject({
        clienteNombre: normalizada.cliente.nombre,
        clienteTelefono: normalizada.cliente.telefono,
        clienteEmail: normalizada.cliente.email,
        clienteDocumento: normalizada.cliente.documento,
        metodoEntrega: normalizada.entrega.metodo,
        medioPago: normalizada.medioPago,
        notasCliente: normalizada.notas,
      });
    });
  });

  describe("datos inválidos: no toca la base", () => {
    it.each([
      ["sin usuario", venta(), { usuarioId: undefined }],
      ["usuario que no es entero", venta(), { usuarioId: "1" }],
      ["sin clave", venta(), { claveVenta: undefined }],
      ["clave que no es UUID", venta(), { claveVenta: "venta-1" }],
      ["Mercado Pago", venta({ medioPago: "mercadopago", cobradoEnEfectivo: undefined }), {}],
      ["cobrado con transferencia", venta({ medioPago: "transferencia" }), {}],
      [
        "dirección con entrega en mano",
        venta({ entrega: { metodo: "en_mano", direccion: { calle: "X" } } }),
        {},
      ],
    ])("%s: DATOS_INVALIDOS", async (_caso, datos, contexto) => {
      const repo = crearRepositorio();

      await expect(registrar(repo, datos, contexto)).rejects.toThrow("DATOS_INVALIDOS");
      expect(repo.buscarPorClaveVenta).not.toHaveBeenCalled();
      expect(repo.transaccion).not.toHaveBeenCalled();
    });
  });
});

describe("la tienda no cambia con el núcleo compartido", () => {
  it("crea con canal tienda, sin clave y con el evento sin usuario", async () => {
    const repo = crearRepositorio();

    await servicioCon(repo).crearPedido(entrada());

    expect(repo.estado.pedidos[0]).toMatchObject({
      canal: "tienda",
      estadoPago: "pendiente",
      claveVenta: null,
      huellaVenta: null,
      expiraEn: new Date(AHORA.getTime() + HORA),
    });
    expect(repo.estado.eventos[0]).toMatchObject({
      origen: "checkout",
      usuarioId: null,
      detalle: null,
    });
  });

  it("la tienda sigue rechazando el efectivo", async () => {
    const repo = crearRepositorio();

    await expect(
      servicioCon(repo, { mediosDisponibles: { efectivo: true } }).crearPedido(
        entrada({ medioPago: "efectivo" })
      )
    ).rejects.toThrow("DATOS_INVALIDOS");
    expect(repo.transaccion).not.toHaveBeenCalled();
  });
});
