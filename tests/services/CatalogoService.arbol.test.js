const CatalogoService = require("../../src/services/CatalogoService");

/**
 * Categoría como la devuelve el repositorio del catálogo.
 */
const fila = (id, nombre, padreId = null) => ({
  id,
  padreId,
  nombre,
  slug: nombre.toLowerCase().replace(/\s+/g, "-"),
  descripcion: null,
  imagenUrl: null,
});

const servicioCon = (filas) =>
  new CatalogoService({ listarCategorias: jest.fn().mockResolvedValue(filas) });

describe("CatalogoService.listarCategorias", () => {
  it("arma el árbol: las de primer nivel arriba, con sus hijas adentro", async () => {
    const arbol = await servicioCon([
      fila(1, "Jabones"),
      fila(4, "Essence", 1),
      fila(5, "Art", 1),
      fila(2, "Cuidado capilar"),
      fila(3, "Combos"),
    ]).listarCategorias();

    expect(arbol.map((c) => c.nombre)).toEqual(["Jabones", "Cuidado capilar", "Combos"]);
    expect(arbol[0].hijas.map((c) => c.nombre)).toEqual(["Essence", "Art"]);
    expect(arbol[1].hijas).toEqual([]);
  });

  it("respeta el orden en que vienen, en los dos niveles", async () => {
    const arbol = await servicioCon([
      fila(3, "Combos"),
      fila(5, "Art", 1),
      fila(1, "Jabones"),
      fila(4, "Essence", 1),
    ]).listarCategorias();

    expect(arbol.map((c) => c.nombre)).toEqual(["Combos", "Jabones"]);
    expect(arbol[1].hijas.map((c) => c.nombre)).toEqual(["Art", "Essence"]);
  });

  it("una hija cuyo padre no vino no aparece en ningún lado", async () => {
    // Pasa si el padre está desactivado: el repositorio ya la filtra, pero si
    // llegara, no tiene que colarse como si fuera de primer nivel
    const arbol = await servicioCon([
      fila(2, "Cuidado capilar"),
      fila(4, "Essence", 1),
    ]).listarCategorias();

    expect(arbol.map((c) => c.nombre)).toEqual(["Cuidado capilar"]);
  });

  it("sin padres asignados, todas quedan arriba: igual que hoy", async () => {
    const arbol = await servicioCon([
      fila(4, "Essence"),
      fila(5, "Art"),
      fila(6, "Edition"),
    ]).listarCategorias();

    expect(arbol).toHaveLength(3);
    expect(arbol.every((c) => c.hijas.length === 0)).toBe(true);
  });

  it("cada categoría trae padreId; las hijas no traen hijas", async () => {
    const [jabones] = await servicioCon([
      fila(1, "Jabones"),
      fila(4, "Essence", 1),
    ]).listarCategorias();

    expect(jabones.padreId).toBeNull();
    expect(jabones.hijas[0].padreId).toBe(1);
    expect(jabones.hijas[0]).not.toHaveProperty("hijas");
  });
});
