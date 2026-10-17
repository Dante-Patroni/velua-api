const ProductoAdminService = require("../../src/services/ProductoAdminService");

/**
 * Producto como lo devuelve el repositorio.
 */
const productoCrudo = (cambios = {}) => ({
  id: 1,
  categoriaId: 4,
  nombre: "Éclat Noir",
  slug: "eclat-noir",
  activo: 1,
  destacado: 0,
  disponibleDesde: null,
  categoria: { id: 4, nombre: "L’Essence Botanique", slug: "essence-botanique" },
  variantes: [],
  imagenes: [],
  ...cambios,
});

const variante = { nombre: "100 g", precio: "8500", stock: 5 };

describe("ProductoAdminService, fecha de lanzamiento", () => {
  let repositorio;
  let servicio;

  beforeEach(() => {
    repositorio = {
      buscarPorId: jest.fn().mockResolvedValue(productoCrudo()),
      existeSlug: jest.fn().mockResolvedValue(false),
      existeCategoria: jest.fn().mockResolvedValue(true),
      categoriaTieneHijas: jest.fn().mockResolvedValue(false),
      crearConVariantes: jest.fn().mockResolvedValue({ id: 1 }),
      actualizar: jest.fn().mockResolvedValue(undefined),
    };
    servicio = new ProductoAdminService(repositorio);
  });

  const crear = (cambios = {}) =>
    servicio.crear({ categoriaId: 4, nombre: "Éclat Noir", variantes: [variante], ...cambios });

  it("crea el producto con su fecha de lanzamiento", async () => {
    await crear({ disponibleDesde: "2026-11-05" });

    expect(repositorio.crearConVariantes).toHaveBeenCalledWith(
      expect.objectContaining({ disponibleDesde: "2026-11-05" }),
      expect.any(Array)
    );
  });

  it("sin fecha, crea el producto disponible", async () => {
    await crear();

    expect(repositorio.crearConVariantes).toHaveBeenCalledWith(
      expect.objectContaining({ disponibleDesde: null }),
      expect.any(Array)
    );
  });

  it("rechaza una fecha que no existe, sin crear nada", async () => {
    const error = await crear({ disponibleDesde: "2026-02-31" }).catch((e) => e);

    expect(error.message).toBe("DATOS_INVALIDOS");
    expect(error.details).toHaveProperty("disponibleDesde");
    expect(repositorio.crearConVariantes).not.toHaveBeenCalled();
  });

  it("cambia la fecha al editar", async () => {
    await servicio.actualizar(1, { disponibleDesde: "2026-12-01" });

    expect(repositorio.actualizar).toHaveBeenCalledWith(1, { disponibleDesde: "2026-12-01" });
  });

  it("quita la fecha si llega vacía", async () => {
    await servicio.actualizar(1, { disponibleDesde: "" });

    expect(repositorio.actualizar).toHaveBeenCalledWith(1, { disponibleDesde: null });
  });

  it("no toca la fecha si no viene en los cambios", async () => {
    await servicio.actualizar(1, { nombre: "Éclat Noir II" });

    expect(repositorio.actualizar).toHaveBeenCalledWith(1, { nombre: "Éclat Noir II" });
  });

  it("rechaza al editar una fecha con otro formato, sin guardar nada", async () => {
    const error = await servicio.actualizar(1, { disponibleDesde: "05/11/2026" }).catch((e) => e);

    expect(error.message).toBe("DATOS_INVALIDOS");
    expect(repositorio.actualizar).not.toHaveBeenCalled();
  });

  it("muestra la fecha en la ficha del panel", async () => {
    repositorio.buscarPorId.mockResolvedValue(productoCrudo({ disponibleDesde: "2026-11-05" }));

    const ficha = await servicio.obtener(1);

    expect(ficha.disponibleDesde).toBe("2026-11-05");
  });
});
