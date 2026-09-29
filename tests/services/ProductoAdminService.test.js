const ProductoAdminService = require("../../src/services/ProductoAdminService");

/**
 * Variante como la devuelve el repositorio.
 */
const varianteCruda = (cambios = {}) => ({
  id: 10,
  productoId: 1,
  nombre: "100 g",
  sku: "VEL-100",
  precio: "8500.00",
  precioAnterior: null,
  stock: 12,
  pesoGramos: 100,
  activa: 1,
  ...cambios,
});

/**
 * Producto como lo devuelve el repositorio, con sus campos internos.
 */
const productoCrudo = (cambios = {}) => ({
  id: 1,
  categoriaId: 4,
  nombre: "Éclat Noir",
  slug: "eclat-noir",
  descripcionCorta: "Con carbón activado",
  descripcion: "Texto largo",
  ingredientes: "Aceite de oliva",
  modoUso: "Humedecer y enjuagar",
  activo: 1,
  destacado: 0,
  creadoEn: "2026-09-01T10:00:00.000Z",
  categoria: { id: 4, nombre: "L’Essence Botanique", slug: "essence-botanique", orden: 1 },
  variantes: [varianteCruda()],
  imagenes: [{ id: 3, url: "https://cdn/a.jpg", alt: "A", orden: 0, publicId: "velua/a" }],
  ...cambios,
});

describe("ProductoAdminService", () => {
  let servicio;
  let repositorio;

  beforeEach(() => {
    repositorio = {
      listar: jest.fn(),
      buscarPorId: jest.fn().mockResolvedValue(productoCrudo()),
      existeSlug: jest.fn().mockResolvedValue(false),
      existeCategoria: jest.fn().mockResolvedValue(true),
      existeSku: jest.fn().mockResolvedValue(false),
      crearConVariantes: jest.fn().mockResolvedValue({ id: 1 }),
      actualizar: jest.fn().mockResolvedValue(undefined),
      crearVariante: jest.fn().mockResolvedValue({ id: 11 }),
      actualizarVariante: jest.fn().mockResolvedValue(undefined),
    };
    servicio = new ProductoAdminService(repositorio);
  });

  describe("listar", () => {
    it("arma la grilla con los totales convertidos", async () => {
      repositorio.listar.mockResolvedValue({
        filas: [
          {
            ...productoCrudo(),
            cantidadVariantes: "2",
            precioDesde: "8500.00",
            stockTotal: "20",
            cantidadImagenes: "3",
          },
        ],
        total: 15,
      });

      const { datos, meta } = await servicio.listar({ pagina: 2, limite: 10 });

      expect(datos[0].cantidadVariantes).toBe(2);
      expect(datos[0].stockTotal).toBe(20);
      expect(datos[0].cantidadImagenes).toBe(3);
      expect(meta).toEqual({ pagina: 2, limite: 10, total: 15 });
    });

    it("conserva el precio como cadena", async () => {
      repositorio.listar.mockResolvedValue({
        filas: [{ ...productoCrudo(), precioDesde: "8500.00" }],
        total: 1,
      });

      const { datos } = await servicio.listar({});

      expect(datos[0].precioDesde).toBe("8500.00");
    });

    it("no trae variantes ni imágenes en la grilla", async () => {
      repositorio.listar.mockResolvedValue({ filas: [productoCrudo()], total: 1 });

      const { datos } = await servicio.listar({});

      expect(datos[0]).not.toHaveProperty("variantes");
      expect(datos[0]).not.toHaveProperty("imagenes");
    });
  });

  describe("obtener", () => {
    it("lanza NO_ENCONTRADO si no existe", async () => {
      repositorio.buscarPorId.mockResolvedValue(null);

      await expect(servicio.obtener(99)).rejects.toThrow("NO_ENCONTRADO");
    });

    it("el panel SÍ ve el stock real de cada variante", async () => {
      // A diferencia de la tienda, que solo expone hayStock
      const p = await servicio.obtener(1);

      expect(p.variantes[0].stock).toBe(12);
    });

    it("ve también las variantes desactivadas", async () => {
      repositorio.buscarPorId.mockResolvedValue(
        productoCrudo({
          variantes: [varianteCruda({ id: 10, activa: 1 }), varianteCruda({ id: 11, activa: 0 })],
        })
      );

      const p = await servicio.obtener(1);

      expect(p.variantes).toHaveLength(2);
      expect(p.variantes[1].activa).toBe(false);
    });

    it("no filtra campos internos", async () => {
      const p = await servicio.obtener(1);

      expect(p).not.toHaveProperty("creadoEn");
      expect(p).not.toHaveProperty("categoriaId");
      expect(p.categoria).not.toHaveProperty("orden");
      expect(p.variantes[0]).not.toHaveProperty("productoId");
    });

    it("expone el id de cada imagen, que el panel necesita para borrarlas", async () => {
      const p = await servicio.obtener(1);

      expect(p.imagenes[0].id).toBe(3);
      expect(p.imagenes[0]).not.toHaveProperty("publicId");
    });
  });

  describe("crear", () => {
    const base = {
      categoriaId: 4,
      nombre: "Jabón de Prueba",
      variantes: [{ nombre: "100 g", precio: "8500", stock: 5 }],
    };

    it("rechaza un producto sin variantes", async () => {
      await expect(servicio.crear({ ...base, variantes: [] })).rejects.toThrow("SIN_VARIANTES");
      expect(repositorio.crearConVariantes).not.toHaveBeenCalled();
    });

    it("rechaza una categoría que no existe, indicando el campo", async () => {
      repositorio.existeCategoria.mockResolvedValue(false);

      await expect(servicio.crear(base)).rejects.toThrow("DATOS_INVALIDOS");
      await servicio.crear(base).catch((e) => {
        expect(e.details).toHaveProperty("categoriaId");
      });
    });

    it("genera el slug del nombre", async () => {
      await servicio.crear({ ...base, nombre: "Soleil d’Été" });

      expect(repositorio.crearConVariantes).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "soleil-d-ete" }),
        expect.any(Array)
      );
    });

    it("agrega sufijo si el slug generado está tomado", async () => {
      repositorio.existeSlug.mockImplementation(async (s) => s === "velours");

      await servicio.crear({ ...base, nombre: "Velours" });

      expect(repositorio.crearConVariantes).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "velours-2" }),
        expect.any(Array)
      );
    });

    it("rechaza un slug elegido a mano que ya existe", async () => {
      repositorio.existeSlug.mockResolvedValue(true);

      await expect(servicio.crear({ ...base, slug: "eclat-noir" })).rejects.toThrow(
        "CONFLICTO_DE_DATOS"
      );
    });

    it("normaliza los importes a dos decimales", async () => {
      await servicio.crear({
        ...base,
        variantes: [{ nombre: "100 g", precio: "8500", stock: 1 }],
      });

      const [, variantes] = repositorio.crearConVariantes.mock.calls[0];
      expect(variantes[0].precio).toBe("8500.00");
    });

    it("acepta la coma como separador decimal", async () => {
      await servicio.crear({
        ...base,
        variantes: [{ nombre: "100 g", precio: "8500,75", stock: 1 }],
      });

      const [, variantes] = repositorio.crearConVariantes.mock.calls[0];
      expect(variantes[0].precio).toBe("8500.75");
    });

    it("no pierde precisión con importes grandes", async () => {
      await servicio.crear({
        ...base,
        variantes: [{ nombre: "100 g", precio: "9999999999.99", stock: 1 }],
      });

      const [, variantes] = repositorio.crearConVariantes.mock.calls[0];
      expect(variantes[0].precio).toBe("9999999999.99");
    });

    it("rechaza un precio que no es un importe", async () => {
      await expect(
        servicio.crear({ ...base, variantes: [{ nombre: "A", precio: "ocho mil", stock: 1 }] })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza un precio con más de dos decimales", async () => {
      await expect(
        servicio.crear({ ...base, variantes: [{ nombre: "A", precio: "8500.123", stock: 1 }] })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza un precio anterior menor que el actual", async () => {
      // Sin esto la tienda mostraria un descuento negativo
      await expect(
        servicio.crear({
          ...base,
          variantes: [{ nombre: "A", precio: "8500", precioAnterior: "8000", stock: 1 }],
        })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza un precio anterior igual al actual", async () => {
      // Es el bug del "0% OFF" que tienen las dos tiendas del rubro que miramos
      await expect(
        servicio.crear({
          ...base,
          variantes: [{ nombre: "A", precio: "8500", precioAnterior: "8500.00", stock: 1 }],
        })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("acepta un precio anterior mayor", async () => {
      await servicio.crear({
        ...base,
        variantes: [{ nombre: "A", precio: "8500", precioAnterior: "9900", stock: 1 }],
      });

      const [, variantes] = repositorio.crearConVariantes.mock.calls[0];
      expect(variantes[0].precioAnterior).toBe("9900.00");
    });

    it("rechaza SKU repetidos en la misma carga", async () => {
      await expect(
        servicio.crear({
          ...base,
          variantes: [
            { nombre: "A", precio: "1", stock: 0, sku: "IGUAL" },
            { nombre: "B", precio: "2", stock: 0, sku: "IGUAL" },
          ],
        })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza un stock negativo", async () => {
      await expect(
        servicio.crear({ ...base, variantes: [{ nombre: "A", precio: "1", stock: -3 }] })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza un stock con decimales", async () => {
      await expect(
        servicio.crear({ ...base, variantes: [{ nombre: "A", precio: "1", stock: 2.5 }] })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza una variante sin nombre", async () => {
      await expect(
        servicio.crear({ ...base, variantes: [{ precio: "1", stock: 1 }] })
      ).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("crea el producto activo y las variantes activas", async () => {
      await servicio.crear(base);

      const [producto, variantes] = repositorio.crearConVariantes.mock.calls[0];
      expect(producto.activo).toBe(true);
      expect(variantes[0].activa).toBe(true);
    });
  });

  describe("actualizar", () => {
    it("lanza NO_ENCONTRADO si no existe", async () => {
      repositorio.buscarPorId.mockResolvedValue(null);

      await expect(servicio.actualizar(99, { nombre: "X" })).rejects.toThrow("NO_ENCONTRADO");
    });

    it("cambiar el nombre NO cambia el slug", async () => {
      await servicio.actualizar(1, { nombre: "Éclat Noir Intenso" });

      const cambios = repositorio.actualizar.mock.calls[0][1];
      expect(cambios.nombre).toBe("Éclat Noir Intenso");
      expect(cambios).not.toHaveProperty("slug");
    });

    it("rechaza mover el producto a una categoría inexistente", async () => {
      repositorio.existeCategoria.mockResolvedValue(false);

      await expect(servicio.actualizar(1, { categoriaId: 99 })).rejects.toThrow("DATOS_INVALIDOS");
      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it("no escribe nada si no hay cambios", async () => {
      await servicio.actualizar(1, {});

      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it("guardar el mismo slug no dispara verificación", async () => {
      await servicio.actualizar(1, { slug: "eclat-noir" });

      expect(repositorio.existeSlug).not.toHaveBeenCalled();
    });
  });

  describe("cambiarEstado", () => {
    it("despublica un producto activo", async () => {
      await servicio.cambiarEstado(1, false);

      expect(repositorio.actualizar).toHaveBeenCalledWith(1, { activo: false });
    });

    it("no escribe si el estado ya es el pedido", async () => {
      repositorio.buscarPorId.mockResolvedValue(productoCrudo({ activo: 0 }));

      await servicio.cambiarEstado(1, false);

      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });
  });

  describe("borrar", () => {
    let imagenes;

    beforeEach(() => {
      imagenes = { borrarArchivoRemoto: jest.fn().mockResolvedValue(true) };
      repositorio.tieneVentas = jest.fn().mockResolvedValue(false);
      repositorio.borrar = jest.fn().mockResolvedValue(undefined);
      servicio = new ProductoAdminService(repositorio, imagenes);
    });

    it("lanza NO_ENCONTRADO si el producto no existe", async () => {
      repositorio.buscarPorId.mockResolvedValue(null);

      await expect(servicio.borrar(99)).rejects.toThrow("NO_ENCONTRADO");
      expect(repositorio.borrar).not.toHaveBeenCalled();
    });

    it("rechaza borrar un producto que se vendió", async () => {
      // Borrarlo dejaria pedidos apuntando a un producto que ya no existe
      repositorio.tieneVentas.mockResolvedValue(true);

      await expect(servicio.borrar(1)).rejects.toThrow("PRODUCTO_CON_VENTAS");
      expect(repositorio.borrar).not.toHaveBeenCalled();
      expect(imagenes.borrarArchivoRemoto).not.toHaveBeenCalled();
    });

    it("borra los archivos remotos antes que el producto", async () => {
      // Las filas se van en cascada, los archivos en Cloudinary no
      repositorio.buscarPorId.mockResolvedValue(
        productoCrudo({
          imagenes: [
            { id: 3, url: "u1", publicId: "velua/productos/a", alt: null, orden: 0 },
            { id: 4, url: "u2", publicId: "velua/productos/b", alt: null, orden: 1 },
          ],
        })
      );

      await servicio.borrar(1);

      expect(imagenes.borrarArchivoRemoto).toHaveBeenCalledWith("velua/productos/a");
      expect(imagenes.borrarArchivoRemoto).toHaveBeenCalledWith("velua/productos/b");
      expect(repositorio.borrar).toHaveBeenCalledWith(1);
    });

    it("no intenta borrar archivos de imágenes sin publicId", async () => {
      repositorio.buscarPorId.mockResolvedValue(
        productoCrudo({
          imagenes: [{ id: 3, url: "u", publicId: null, alt: null, orden: 0 }],
        })
      );

      await servicio.borrar(1);

      expect(imagenes.borrarArchivoRemoto).not.toHaveBeenCalled();
      expect(repositorio.borrar).toHaveBeenCalledWith(1);
    });

    it("borra un producto sin imágenes", async () => {
      repositorio.buscarPorId.mockResolvedValue(productoCrudo({ imagenes: [] }));

      await servicio.borrar(1);

      expect(repositorio.borrar).toHaveBeenCalledWith(1);
    });
  });

  describe("agregarVariante", () => {
    it("rechaza un SKU que ya usa otra variante", async () => {
      repositorio.existeSku.mockResolvedValue(true);

      await expect(
        servicio.agregarVariante(1, { nombre: "60 g", precio: "5500", stock: 3, sku: "VEL-100" })
      ).rejects.toThrow("CONFLICTO_DE_DATOS");
      expect(repositorio.crearVariante).not.toHaveBeenCalled();
    });

    it("agrega la variante al producto", async () => {
      await servicio.agregarVariante(1, { nombre: "60 g", precio: "5500", stock: 3 });

      expect(repositorio.crearVariante).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ nombre: "60 g", precio: "5500.00", activa: true })
      );
    });
  });

  describe("actualizarVariante", () => {
    it("rechaza una variante que no es de ese producto", async () => {
      await expect(servicio.actualizarVariante(1, 999, { stock: 5 })).rejects.toThrow(
        "NO_ENCONTRADO"
      );
    });

    it("actualiza solo el stock", async () => {
      await servicio.actualizarVariante(1, 10, { stock: 25 });

      expect(repositorio.actualizarVariante).toHaveBeenCalledWith(10, { stock: 25 });
    });

    it("valida el precio anterior contra el precio actual si no se manda uno nuevo", async () => {
      // La variante vale 8500: poner 8000 como anterior tiene que fallar
      await expect(servicio.actualizarVariante(1, 10, { precioAnterior: "8000" })).rejects.toThrow(
        "DATOS_INVALIDOS"
      );
    });

    it("valida el precio anterior contra el precio nuevo si se mandan los dos", async () => {
      await servicio.actualizarVariante(1, 10, { precio: "6000", precioAnterior: "7000" });

      expect(repositorio.actualizarVariante).toHaveBeenCalledWith(10, {
        precio: "6000.00",
        precioAnterior: "7000.00",
      });
    });

    it("permite quitar el precio anterior", async () => {
      await servicio.actualizarVariante(1, 10, { precioAnterior: null });

      expect(repositorio.actualizarVariante).toHaveBeenCalledWith(10, { precioAnterior: null });
    });

    it("excluye la propia variante al verificar el SKU", async () => {
      await servicio.actualizarVariante(1, 10, { sku: "VEL-100-B" });

      expect(repositorio.existeSku).toHaveBeenCalledWith("VEL-100-B", 10);
    });
  });

  describe("cambiarEstadoVariante", () => {
    it("no deja desactivar la última variante activa", async () => {
      // Quedaria un producto visible que no se puede comprar
      await expect(servicio.cambiarEstadoVariante(1, 10, false)).rejects.toThrow(
        "ULTIMA_VARIANTE_ACTIVA"
      );
      expect(repositorio.actualizarVariante).not.toHaveBeenCalled();
    });

    it("desactiva una variante si queda otra activa", async () => {
      repositorio.buscarPorId.mockResolvedValue(
        productoCrudo({
          variantes: [varianteCruda({ id: 10 }), varianteCruda({ id: 11, sku: "VEL-60" })],
        })
      );

      await servicio.cambiarEstadoVariante(1, 10, false);

      expect(repositorio.actualizarVariante).toHaveBeenCalledWith(10, { activa: false });
    });

    it("permite reactivar una variante desactivada", async () => {
      repositorio.buscarPorId.mockResolvedValue(
        productoCrudo({
          variantes: [varianteCruda({ id: 10 }), varianteCruda({ id: 11, activa: 0 })],
        })
      );

      await servicio.cambiarEstadoVariante(1, 11, true);

      expect(repositorio.actualizarVariante).toHaveBeenCalledWith(11, { activa: true });
    });

    it("rechaza una variante de otro producto", async () => {
      await expect(servicio.cambiarEstadoVariante(1, 999, false)).rejects.toThrow("NO_ENCONTRADO");
    });
  });
});
