const CatalogoService = require("../../src/services/CatalogoService");

const HOY = "2026-10-17";

const categoria = {
  id: 1,
  padreId: null,
  nombre: "Jabones",
  slug: "jabones",
  descripcion: null,
  imagenUrl: null,
};

/**
 * Producto como lo devuelve el repositorio, con sus relaciones.
 */
const producto = (cambios = {}) => ({
  id: 1,
  nombre: "Éclat Noir",
  slug: "eclat-noir",
  descripcionCorta: "Carbón activado",
  descripcion: "Jabón facial",
  ingredientes: "Aceite de oliva",
  modoUso: "Con agua tibia",
  destacado: false,
  disponibleDesde: null,
  categoria,
  variantes: [
    {
      id: 1,
      nombre: "100 g",
      sku: "VEL-ECLAT-NOIR",
      precio: "8500.00",
      precioAnterior: null,
      stock: 5,
    },
  ],
  imagenes: [],
  ...cambios,
});

const servicioCon = (fila) =>
  new CatalogoService(
    {
      listarProductos: jest.fn(async () => ({ filas: [fila], total: 1 })),
      obtenerProductoPorSlug: jest.fn(async () => fila),
    },
    { hoy: () => HOY }
  );

describe("CatalogoService, productos próximamente", () => {
  it("un producto sin fecha se muestra disponible", async () => {
    const { datos } = await servicioCon(producto()).listarProductos();

    expect(datos[0]).toMatchObject({
      disponibleDesde: null,
      proximamente: false,
      diasRestantes: null,
    });
  });

  it("en la grilla, un producto con fecha futura informa cuántos días faltan", async () => {
    const { datos } = await servicioCon(
      producto({ disponibleDesde: "2026-11-05" })
    ).listarProductos();

    expect(datos[0]).toMatchObject({
      disponibleDesde: "2026-11-05",
      proximamente: true,
      diasRestantes: 19,
    });
  });

  it("en la ficha, un producto con fecha futura informa cuántos días faltan", async () => {
    const ficha = await servicioCon(
      producto({ disponibleDesde: "2026-10-18" })
    ).obtenerProductoPorSlug("eclat-noir");

    expect(ficha).toMatchObject({ proximamente: true, diasRestantes: 1 });
  });

  it("el mismo día de la fecha ya se muestra disponible", async () => {
    const ficha = await servicioCon(producto({ disponibleDesde: HOY })).obtenerProductoPorSlug(
      "eclat-noir"
    );

    expect(ficha).toMatchObject({ disponibleDesde: HOY, proximamente: false, diasRestantes: null });
  });

  it("con una fecha inválida se muestra como próximamente (falla segura)", async () => {
    const { datos } = await servicioCon(
      producto({ disponibleDesde: "2026-02-31" })
    ).listarProductos();

    expect(datos[0]).toMatchObject({ proximamente: true, diasRestantes: null });
  });
  it("pasa al repositorio la fecha de hoy para filtrar los próximos", async () => {
    const repo = { listarProductos: jest.fn(async () => ({ filas: [], total: 0 })) };

    await new CatalogoService(repo, { hoy: () => HOY }).listarProductos({ proximamente: true });

    expect(repo.listarProductos).toHaveBeenCalledWith(
      expect.objectContaining({ proximamente: true, hoy: HOY })
    );
  });
});
