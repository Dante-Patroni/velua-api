const CategoriaAdminService = require("../../src/services/CategoriaAdminService");

/**
 * Categoría como la devuelve el repositorio.
 */
const categoria = (cambios = {}) => ({
  id: 5,
  nombre: "L’Art du Savon",
  slug: "art-du-savon",
  descripcion: null,
  imagenUrl: null,
  padreId: null,
  orden: 2,
  activa: 1,
  cantidadProductos: 6,
  cantidadHijas: 0,
  ...cambios,
});

/**
 * El árbol de prueba:
 *   1 Jabones (sin productos)  ▸ 5 L'Art du Savon
 *   2 Cuidado capilar (con productos)
 *   3 Combos (sin productos)
 */
const ARBOL = {
  1: categoria({
    id: 1,
    nombre: "Jabones",
    slug: "jabones",
    cantidadProductos: 0,
    cantidadHijas: 1,
  }),
  2: categoria({ id: 2, nombre: "Cuidado capilar", slug: "cuidado-capilar" }),
  3: categoria({ id: 3, nombre: "Combos", slug: "combos", cantidadProductos: 0 }),
  5: categoria({ id: 5, padreId: 1 }),
};
const CON_PRODUCTOS = new Set([2, 5]);

describe("CategoriaAdminService, categoría padre", () => {
  let repositorio;
  let servicio;

  beforeEach(() => {
    const filas = structuredClone(ARBOL);
    repositorio = {
      buscarPorId: jest.fn(async (id) => (filas[id] ? { ...filas[id] } : null)),
      tieneProductos: jest.fn(async (id) => CON_PRODUCTOS.has(Number(id))),
      existeSlug: jest.fn().mockResolvedValue(false),
      siguienteOrden: jest.fn().mockResolvedValue(9),
      crear: jest.fn(async (datos) => {
        filas[20] = categoria({ id: 20, ...datos });
        return filas[20];
      }),
      actualizar: jest.fn(async (id, cambios) => Object.assign(filas[id], cambios)),
    };
    servicio = new CategoriaAdminService(repositorio);
  });

  describe("al editar", () => {
    it("mueve una categoría debajo de un padre de primer nivel sin productos", async () => {
      const r = await servicio.actualizar(5, { padreId: 3 });

      expect(repositorio.actualizar).toHaveBeenCalledWith(5, { padreId: 3 });
      expect(r.padreId).toBe(3);
    });

    it("la pasa al primer nivel con padreId null, sin validar nada", async () => {
      const r = await servicio.actualizar(5, { padreId: null });

      expect(repositorio.actualizar).toHaveBeenCalledWith(5, { padreId: null });
      expect(repositorio.tieneProductos).not.toHaveBeenCalled();
      expect(r.padreId).toBeNull();
    });

    it("no toca el padre si el campo no viene", async () => {
      await servicio.actualizar(5, { nombre: "Otro nombre" });

      expect(repositorio.actualizar).toHaveBeenCalledWith(5, { nombre: "Otro nombre" });
    });

    it("no hace nada si el padre es el mismo que ya tenía", async () => {
      await servicio.actualizar(5, { padreId: 1 });

      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it("rechaza que sea su propio padre", async () => {
      await expect(servicio.actualizar(3, { padreId: 3 })).rejects.toThrow(
        "CATEGORIA_PADRE_INVALIDA"
      );
    });

    it("rechaza un padre que no existe", async () => {
      await expect(servicio.actualizar(5, { padreId: 99 })).rejects.toThrow(
        "CATEGORIA_PADRE_INVALIDA"
      );
    });

    it("rechaza un padre que ya es hija de otra: serían tres niveles", async () => {
      await expect(servicio.actualizar(3, { padreId: 5 })).rejects.toThrow(
        "CATEGORIA_PADRE_INVALIDA"
      );
    });

    it("rechaza mover una categoría que tiene hijas: serían tres niveles", async () => {
      await expect(servicio.actualizar(1, { padreId: 3 })).rejects.toThrow("CATEGORIA_CON_HIJAS");
    });

    it("rechaza un padre con productos: tendría productos e hijas", async () => {
      await expect(servicio.actualizar(5, { padreId: 2 })).rejects.toThrow(
        "CATEGORIA_CON_PRODUCTOS"
      );
    });

    it("si la validación falla, no guarda ningún cambio", async () => {
      await expect(servicio.actualizar(5, { nombre: "Nuevo", padreId: 2 })).rejects.toThrow();

      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });
  });

  describe("al crear", () => {
    it("crea directamente debajo de un padre válido", async () => {
      const r = await servicio.crear({ nombre: "Shampoos", padreId: 3 });

      expect(repositorio.crear).toHaveBeenCalledWith(expect.objectContaining({ padreId: 3 }));
      expect(r.padreId).toBe(3);
    });

    it("sin padre queda en el primer nivel", async () => {
      await servicio.crear({ nombre: "Cuidado corporal" });

      expect(repositorio.crear).toHaveBeenCalledWith(expect.objectContaining({ padreId: null }));
    });

    it("rechaza un padre con productos, antes de crear nada", async () => {
      await expect(servicio.crear({ nombre: "X", padreId: 2 })).rejects.toThrow(
        "CATEGORIA_CON_PRODUCTOS"
      );
      expect(repositorio.crear).not.toHaveBeenCalled();
    });

    it("rechaza un padre que ya es hija", async () => {
      await expect(servicio.crear({ nombre: "X", padreId: 5 })).rejects.toThrow(
        "CATEGORIA_PADRE_INVALIDA"
      );
    });
  });

  describe("respuesta", () => {
    it("incluye padreId y cantidadHijas", async () => {
      const r = await servicio.obtener(1);

      expect(r.padreId).toBeNull();
      expect(r.cantidadHijas).toBe(1);
    });
  });
});
