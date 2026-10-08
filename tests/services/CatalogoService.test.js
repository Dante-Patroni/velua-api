const CatalogoService = require("../../src/services/CatalogoService");

/**
 * Construye un producto crudo, como lo devuelve el repositorio.
 * Los tests sobrescriben solo lo que necesitan.
 */
const productoCrudo = (cambios = {}) => ({
  id: 1,
  nombre: "Jabon Vegetal - Calendula y Karite",
  slug: "jabon-calendula-karite",
  descripcionCorta: "Jabon suave para pieles sensibles",
  descripcion: "Elaborado en frio con aceite de oliva y manteca de karite.",
  ingredientes: "Aceite de oliva, manteca de karite, calendula",
  modoUso: "Humedecer, frotar y enjuagar",
  activo: true,
  destacado: false,
  creadoEn: "2026-09-01T10:00:00.000Z",
  categoria: { id: 3, nombre: "Jabones", slug: "jabones", descripcion: null, imagenUrl: null },
  variantes: [
    { id: 10, nombre: "100 g", sku: "JAB-100", precio: "12500.00", precioAnterior: null, stock: 5 },
  ],
  imagenes: [{ url: "https://cdn/a.jpg", alt: "Jabon de calendula", orden: 0 }],
  ...cambios,
});

describe("CatalogoService", () => {
  let servicio;
  let repositorio;

  beforeEach(() => {
    repositorio = {
      listarCategorias: jest.fn(),
      listarProductos: jest.fn(),
      obtenerProductoPorSlug: jest.fn(),
    };
    servicio = new CatalogoService(repositorio);
  });

  describe("listarCategorias", () => {
    it("devuelve las categorías del repositorio como árbol", async () => {
      repositorio.listarCategorias.mockResolvedValue([
        {
          id: 1,
          padreId: null,
          nombre: "Jabones",
          slug: "jabones",
          descripcion: null,
          imagenUrl: null,
        },
      ]);

      await expect(servicio.listarCategorias()).resolves.toEqual([
        {
          id: 1,
          padreId: null,
          nombre: "Jabones",
          slug: "jabones",
          descripcion: null,
          imagenUrl: null,
          hijas: [],
        },
      ]);
      expect(repositorio.listarCategorias).toHaveBeenCalledTimes(1);
    });
  });

  describe("listarProductos", () => {
    it("pasa los filtros al repositorio sin modificarlos", async () => {
      const filtros = { pagina: 2, limite: 10, categoria: "jabones" };
      repositorio.listarProductos.mockResolvedValue({ filas: [], total: 0 });

      await servicio.listarProductos(filtros);

      expect(repositorio.listarProductos).toHaveBeenCalledWith(filtros);
    });

    it("toma el precio de la variante mas barata y conserva la cadena", async () => {
      repositorio.listarProductos.mockResolvedValue({
        filas: [
          productoCrudo({
            variantes: [
              { id: 10, precio: "12500.00", precioAnterior: null, stock: 5 },
              { id: 11, precio: "8500.00", precioAnterior: "9900.00", stock: 3 },
              { id: 12, precio: "19000.00", precioAnterior: null, stock: 1 },
            ],
          }),
        ],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      // toBe es estricto: un parseFloat daria 8500 y rompe el test
      expect(datos[0].precioDesde).toBe("8500.00");
      expect(datos[0].precioAnteriorDesde).toBe("9900.00");
    });

    it("compara precios numericamente, no como texto", async () => {
      // Como cadenas, "1000.00" > "900.00" es falso. Numericamente es verdadero.
      repositorio.listarProductos.mockResolvedValue({
        filas: [
          productoCrudo({
            variantes: [
              { id: 10, precio: "1000.00", precioAnterior: null, stock: 1 },
              { id: 11, precio: "900.00", precioAnterior: null, stock: 1 },
            ],
          }),
        ],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      expect(datos[0].precioDesde).toBe("900.00");
    });

    it("devuelve precioAnteriorDesde en null si la variante mas barata no esta en oferta", async () => {
      repositorio.listarProductos.mockResolvedValue({
        filas: [
          productoCrudo({
            variantes: [
              { id: 10, precio: "8500.00", precioAnterior: null, stock: 2 },
              { id: 11, precio: "12500.00", precioAnterior: "15000.00", stock: 2 },
            ],
          }),
        ],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      expect(datos[0].precioDesde).toBe("8500.00");
      expect(datos[0].precioAnteriorDesde).toBeNull();
    });

    it("marca hayStock si al menos una variante tiene unidades", async () => {
      repositorio.listarProductos.mockResolvedValue({
        filas: [
          productoCrudo({
            variantes: [
              { id: 10, precio: "8500.00", precioAnterior: null, stock: 0 },
              { id: 11, precio: "12500.00", precioAnterior: null, stock: 4 },
            ],
          }),
        ],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      expect(datos[0].hayStock).toBe(true);
    });

    it("marca hayStock en false si ninguna variante tiene unidades", async () => {
      repositorio.listarProductos.mockResolvedValue({
        filas: [
          productoCrudo({
            variantes: [
              { id: 10, precio: "8500.00", precioAnterior: null, stock: 0 },
              { id: 11, precio: "12500.00", precioAnterior: null, stock: 0 },
            ],
          }),
        ],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      expect(datos[0].hayStock).toBe(false);
    });

    it("no se rompe con un producto sin variantes", async () => {
      repositorio.listarProductos.mockResolvedValue({
        filas: [productoCrudo({ variantes: [] })],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      expect(datos[0].precioDesde).toBeNull();
      expect(datos[0].precioAnteriorDesde).toBeNull();
      expect(datos[0].hayStock).toBe(false);
    });

    it("devuelve imagen en null si el producto no tiene fotos", async () => {
      // Caso real del seed mientras no lleguen las fotos de la marca
      repositorio.listarProductos.mockResolvedValue({
        filas: [productoCrudo({ imagenes: [] })],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      expect(datos[0].imagen).toBeNull();
    });

    it("toma la primera imagen y expone solo url y alt", async () => {
      repositorio.listarProductos.mockResolvedValue({
        filas: [
          productoCrudo({
            imagenes: [
              { url: "https://cdn/principal.jpg", alt: "Principal", orden: 1 },
              { url: "https://cdn/otra.jpg", alt: "Otra", orden: 2 },
            ],
          }),
        ],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      expect(datos[0].imagen).toEqual({ url: "https://cdn/principal.jpg", alt: "Principal" });
    });

    it("no filtra campos internos hacia la respuesta", async () => {
      repositorio.listarProductos.mockResolvedValue({
        filas: [productoCrudo()],
        total: 1,
      });

      const { datos } = await servicio.listarProductos({});

      expect(datos[0]).not.toHaveProperty("activo");
      expect(datos[0]).not.toHaveProperty("creadoEn");
      expect(datos[0]).not.toHaveProperty("variantes");
      expect(datos[0]).not.toHaveProperty("imagenes");
    });

    it("arma meta con la pagina, el limite y el total del repositorio", async () => {
      repositorio.listarProductos.mockResolvedValue({ filas: [], total: 47 });

      const { meta } = await servicio.listarProductos({ pagina: 3, limite: 10 });

      expect(meta).toEqual({ pagina: 3, limite: 10, total: 47 });
    });

    it("usa pagina 1 y limite 20 cuando no se piden", async () => {
      repositorio.listarProductos.mockResolvedValue({ filas: [], total: 0 });

      const { meta } = await servicio.listarProductos({});

      expect(meta.pagina).toBe(1);
      expect(meta.limite).toBe(20);
    });
  });

  describe("obtenerProductoPorSlug", () => {
    it("lanza NO_ENCONTRADO si el repositorio no devuelve nada", async () => {
      repositorio.obtenerProductoPorSlug.mockResolvedValue(null);

      await expect(servicio.obtenerProductoPorSlug("no-existe")).rejects.toThrow("NO_ENCONTRADO");
      expect(repositorio.obtenerProductoPorSlug).toHaveBeenCalledWith("no-existe");
    });

    it("mapea las variantes al contrato, con hayStock y el precio como cadena", async () => {
      repositorio.obtenerProductoPorSlug.mockResolvedValue(
        productoCrudo({
          variantes: [
            {
              id: 10,
              nombre: "100 g",
              sku: "JAB-100",
              precio: "12500.00",
              precioAnterior: "15000.00",
              stock: 3,
            },
            {
              id: 11,
              nombre: "60 g",
              sku: null,
              precio: "8500.00",
              precioAnterior: null,
              stock: 0,
            },
          ],
        })
      );

      const producto = await servicio.obtenerProductoPorSlug("jabon-calendula-karite");

      expect(producto.variantes).toEqual([
        {
          id: 10,
          nombre: "100 g",
          sku: "JAB-100",
          precio: "12500.00",
          precioAnterior: "15000.00",
          hayStock: true,
        },
        {
          id: 11,
          nombre: "60 g",
          sku: null,
          precio: "8500.00",
          precioAnterior: null,
          hayStock: false,
        },
      ]);
    });

    it("no expone el stock real de las variantes", async () => {
      repositorio.obtenerProductoPorSlug.mockResolvedValue(productoCrudo());

      const producto = await servicio.obtenerProductoPorSlug("jabon-calendula-karite");

      expect(producto.variantes[0]).not.toHaveProperty("stock");
    });

    it("expone de cada imagen solo url y alt", async () => {
      repositorio.obtenerProductoPorSlug.mockResolvedValue(
        productoCrudo({
          imagenes: [
            { url: "https://cdn/a.jpg", alt: "A", orden: 0, publicId: "velua/a" },
            { url: "https://cdn/b.jpg", alt: "B", orden: 1, publicId: "velua/b" },
          ],
        })
      );

      const producto = await servicio.obtenerProductoPorSlug("jabon-calendula-karite");

      expect(producto.imagenes).toEqual([
        { url: "https://cdn/a.jpg", alt: "A" },
        { url: "https://cdn/b.jpg", alt: "B" },
      ]);
    });

    it("no filtra campos internos hacia la respuesta", async () => {
      repositorio.obtenerProductoPorSlug.mockResolvedValue(productoCrudo());

      const producto = await servicio.obtenerProductoPorSlug("jabon-calendula-karite");

      expect(producto).not.toHaveProperty("activo");
      expect(producto).not.toHaveProperty("creadoEn");
    });

    it("devuelve los campos de la ficha completa", async () => {
      repositorio.obtenerProductoPorSlug.mockResolvedValue(productoCrudo());

      const producto = await servicio.obtenerProductoPorSlug("jabon-calendula-karite");

      expect(producto.ingredientes).toBe("Aceite de oliva, manteca de karite, calendula");
      expect(producto.modoUso).toBe("Humedecer, frotar y enjuagar");
      expect(producto.categoria.slug).toBe("jabones");
    });
  });
});
