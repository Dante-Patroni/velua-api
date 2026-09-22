const CategoriaAdminService = require("../../src/services/CategoriaAdminService");

/**
 * Categoria como la devuelve el repositorio, con sus campos internos.
 */
const categoriaCruda = (cambios = {}) => ({
  id: 5,
  nombre: "L’Art du Savon",
  slug: "art-du-savon",
  descripcion: "El diseño manda",
  imagenUrl: null,
  orden: 2,
  activa: 1,
  cantidadProductos: 6,
  creado_en: "2026-09-01T10:00:00.000Z",
  ...cambios,
});

describe("CategoriaAdminService", () => {
  let servicio;
  let repositorio;

  beforeEach(() => {
    repositorio = {
      listarTodas: jest.fn(),
      buscarPorId: jest.fn(),
      existeSlug: jest.fn().mockResolvedValue(false),
      siguienteOrden: jest.fn().mockResolvedValue(4),
      crear: jest.fn(),
      actualizar: jest.fn().mockResolvedValue(undefined),
      reordenar: jest.fn().mockResolvedValue(undefined),
    };
    servicio = new CategoriaAdminService(repositorio);
  });

  describe("listar", () => {
    it("incluye las categorías inactivas", async () => {
      repositorio.listarTodas.mockResolvedValue([
        categoriaCruda({ id: 1, activa: 1 }),
        categoriaCruda({ id: 2, activa: 0 }),
      ]);

      const lista = await servicio.listar();

      expect(lista).toHaveLength(2);
      expect(lista[1].activa).toBe(false);
    });

    it("convierte activa y cantidadProductos a sus tipos", async () => {
      repositorio.listarTodas.mockResolvedValue([
        categoriaCruda({ activa: 1, cantidadProductos: "6" }),
      ]);

      const [c] = await servicio.listar();

      expect(c.activa).toBe(true);
      expect(c.cantidadProductos).toBe(6);
    });

    it("no filtra campos internos", async () => {
      repositorio.listarTodas.mockResolvedValue([categoriaCruda()]);

      const [c] = await servicio.listar();

      expect(c).not.toHaveProperty("creado_en");
    });
  });

  describe("obtener", () => {
    it("lanza NO_ENCONTRADO si no existe", async () => {
      repositorio.buscarPorId.mockResolvedValue(null);

      await expect(servicio.obtener(99)).rejects.toThrow("NO_ENCONTRADO");
    });
  });

  describe("crear", () => {
    beforeEach(() => {
      repositorio.crear.mockImplementation(async (datos) => ({ id: 9, ...datos }));
      repositorio.buscarPorId.mockImplementation(async () =>
        categoriaCruda({ id: 9, cantidadProductos: 0 })
      );
    });

    it("genera el slug a partir del nombre", async () => {
      await servicio.crear({ nombre: "Shampoo Sólido" });

      expect(repositorio.crear).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "shampoo-solido" })
      );
    });

    it("agrega un sufijo si el slug generado ya existe", async () => {
      repositorio.existeSlug.mockImplementation(async (s) => s === "combos");

      await servicio.crear({ nombre: "Combos" });

      expect(repositorio.crear).toHaveBeenCalledWith(expect.objectContaining({ slug: "combos-2" }));
    });

    it("usa el slug elegido a mano, normalizado", async () => {
      await servicio.crear({ nombre: "Combos", slug: "Cajas de Regalo" });

      expect(repositorio.crear).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "cajas-de-regalo" })
      );
    });

    it("rechaza un slug elegido a mano que ya está tomado", async () => {
      // A mano no se le agrega sufijo: la URL no seria la que se pidio
      repositorio.existeSlug.mockResolvedValue(true);

      await expect(servicio.crear({ nombre: "Combos", slug: "combos" })).rejects.toThrow(
        "CONFLICTO_DE_DATOS"
      );
      expect(repositorio.crear).not.toHaveBeenCalled();
    });

    it("rechaza un slug elegido que queda vacío al normalizar", async () => {
      await expect(servicio.crear({ nombre: "Combos", slug: "¡¡!!" })).rejects.toThrow(
        "DATOS_INVALIDOS"
      );
    });

    it("rechaza un nombre sin letras ni números", async () => {
      await expect(servicio.crear({ nombre: "¡¡!!" })).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("crea la categoría activa y al final del menú", async () => {
      await servicio.crear({ nombre: "Combos" });

      expect(repositorio.crear).toHaveBeenCalledWith(
        expect.objectContaining({ activa: true, orden: 4 })
      );
    });

    it("recorta espacios del nombre", async () => {
      await servicio.crear({ nombre: "  Combos  " });

      expect(repositorio.crear).toHaveBeenCalledWith(expect.objectContaining({ nombre: "Combos" }));
    });
  });

  describe("actualizar", () => {
    beforeEach(() => {
      repositorio.buscarPorId.mockResolvedValue(categoriaCruda());
    });

    it("lanza NO_ENCONTRADO si no existe", async () => {
      repositorio.buscarPorId.mockResolvedValue(null);

      await expect(servicio.actualizar(99, { nombre: "X" })).rejects.toThrow("NO_ENCONTRADO");
    });

    it("cambiar el nombre NO cambia el slug", async () => {
      await servicio.actualizar(5, { nombre: "L’Art du Savon Artisanal" });

      const cambios = repositorio.actualizar.mock.calls[0][1];
      expect(cambios.nombre).toBe("L’Art du Savon Artisanal");
      expect(cambios).not.toHaveProperty("slug");
    });

    it("guardar el mismo slug no dispara verificación ni cambio", async () => {
      // Sin esto, editar sin tocar el slug chocaria contra la propia categoria
      await servicio.actualizar(5, { slug: "art-du-savon", nombre: "Otro" });

      expect(repositorio.existeSlug).not.toHaveBeenCalled();
      expect(repositorio.actualizar.mock.calls[0][1]).not.toHaveProperty("slug");
    });

    it("cambia el slug si se edita a propósito", async () => {
      await servicio.actualizar(5, { slug: "arte-del-jabon" });

      expect(repositorio.actualizar).toHaveBeenCalledWith(5, { slug: "arte-del-jabon" });
    });

    it("excluye la propia categoría al verificar el slug nuevo", async () => {
      await servicio.actualizar(5, { slug: "arte-del-jabon" });

      expect(repositorio.existeSlug).toHaveBeenCalledWith("arte-del-jabon", 5);
    });

    it("rechaza un slug nuevo que usa otra categoría", async () => {
      repositorio.existeSlug.mockResolvedValue(true);

      await expect(servicio.actualizar(5, { slug: "jabones" })).rejects.toThrow(
        "CONFLICTO_DE_DATOS"
      );
      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it("no escribe nada si no hay cambios", async () => {
      await servicio.actualizar(5, {});

      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });
  });

  describe("cambiarEstado", () => {
    it("desactiva una categoría activa", async () => {
      repositorio.buscarPorId.mockResolvedValue(categoriaCruda({ activa: 1 }));

      await servicio.cambiarEstado(5, false);

      expect(repositorio.actualizar).toHaveBeenCalledWith(5, { activa: false });
    });

    it("devuelve cuántos productos quedan afectados", async () => {
      repositorio.buscarPorId.mockResolvedValue(categoriaCruda({ cantidadProductos: 6 }));

      const c = await servicio.cambiarEstado(5, false);

      expect(c.cantidadProductos).toBe(6);
    });

    it("no escribe si el estado ya es el pedido", async () => {
      repositorio.buscarPorId.mockResolvedValue(categoriaCruda({ activa: 0 }));

      await servicio.cambiarEstado(5, false);

      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it("lanza NO_ENCONTRADO si no existe", async () => {
      repositorio.buscarPorId.mockResolvedValue(null);

      await expect(servicio.cambiarEstado(99, false)).rejects.toThrow("NO_ENCONTRADO");
    });
  });

  describe("reordenar", () => {
    beforeEach(() => {
      repositorio.listarTodas.mockResolvedValue([
        categoriaCruda({ id: 1 }),
        categoriaCruda({ id: 2 }),
        categoriaCruda({ id: 3 }),
      ]);
    });

    it("reordena con la lista completa", async () => {
      await servicio.reordenar([3, 1, 2]);

      expect(repositorio.reordenar).toHaveBeenCalledWith([3, 1, 2]);
    });

    it("rechaza una lista con categorías faltantes", async () => {
      await expect(servicio.reordenar([3, 1])).rejects.toThrow("DATOS_INVALIDOS");
      expect(repositorio.reordenar).not.toHaveBeenCalled();
    });

    it("rechaza ids repetidos", async () => {
      await expect(servicio.reordenar([1, 1, 2])).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza ids que no existen", async () => {
      await expect(servicio.reordenar([1, 2, 99])).rejects.toThrow("DATOS_INVALIDOS");
    });
  });
});
