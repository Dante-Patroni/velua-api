const CategoriaAdminService = require("../../src/services/CategoriaAdminService");

/**
 * Categoría como la devuelve el repositorio.
 */
const categoriaCruda = (cambios = {}) => ({
  id: 5,
  nombre: "L’Art du Savon",
  slug: "art-du-savon",
  descripcion: null,
  imagenUrl: null,
  imagenPublicId: null,
  orden: 2,
  activa: 1,
  cantidadProductos: 6,
  ...cambios,
});

const ARCHIVO = Buffer.from("contenido de prueba");
const SUBIDA = {
  url: "https://res.cloudinary.com/x/nueva.jpg",
  publicId: "velua/categorias/nueva",
};

describe("CategoriaAdminService, imagen", () => {
  let repositorio;
  let storage;
  let servicio;
  let guardada;

  beforeEach(() => {
    guardada = categoriaCruda();
    repositorio = {
      buscarPorId: jest.fn(async () => (guardada ? { ...guardada } : null)),
      actualizar: jest.fn(async (_id, cambios) => Object.assign(guardada, cambios)),
    };
    storage = {
      subir: jest.fn().mockResolvedValue(SUBIDA),
      borrar: jest.fn().mockResolvedValue(true),
    };
    servicio = new CategoriaAdminService(repositorio, storage);
  });

  describe("subirImagen", () => {
    it("sube a la carpeta de categorías y guarda la URL y el public_id", async () => {
      await servicio.subirImagen(5, ARCHIVO);

      expect(storage.subir).toHaveBeenCalledWith(ARCHIVO, "velua/categorias");
      expect(repositorio.actualizar).toHaveBeenCalledWith(5, {
        imagenUrl: SUBIDA.url,
        imagenPublicId: SUBIDA.publicId,
      });
    });

    it("devuelve la categoría con la imagen nueva y sin el public_id", async () => {
      const r = await servicio.subirImagen(5, ARCHIVO);

      expect(r.imagenUrl).toBe(SUBIDA.url);
      // Es un dato interno: el panel no lo necesita
      expect(r).not.toHaveProperty("imagenPublicId");
    });

    it("borra la imagen anterior después de guardar la nueva", async () => {
      guardada = categoriaCruda({
        imagenUrl: "https://res.cloudinary.com/x/vieja.jpg",
        imagenPublicId: "velua/categorias/vieja",
      });

      await servicio.subirImagen(5, ARCHIVO);

      expect(storage.borrar).toHaveBeenCalledWith("velua/categorias/vieja");
      const ordenGuardar = repositorio.actualizar.mock.invocationCallOrder[0];
      const ordenBorrar = storage.borrar.mock.invocationCallOrder[0];
      expect(ordenGuardar).toBeLessThan(ordenBorrar);
    });

    it("no borra nada si no había imagen", async () => {
      await servicio.subirImagen(5, ARCHIVO);

      expect(storage.borrar).not.toHaveBeenCalled();
    });

    it("no borra nada si la imagen anterior se cargó a mano, sin public_id", async () => {
      guardada = categoriaCruda({ imagenUrl: "https://otro.sitio/foto.jpg" });

      await servicio.subirImagen(5, ARCHIVO);

      expect(storage.borrar).not.toHaveBeenCalled();
    });

    it("si guardar falla, borra la recién subida y propaga el error", async () => {
      repositorio.actualizar.mockRejectedValueOnce(new Error("se cayó la base"));

      await expect(servicio.subirImagen(5, ARCHIVO)).rejects.toThrow("se cayó la base");

      expect(storage.borrar).toHaveBeenCalledWith(SUBIDA.publicId);
    });

    it("si borrar la anterior falla, igual responde bien", async () => {
      guardada = categoriaCruda({ imagenPublicId: "velua/categorias/vieja" });
      storage.borrar.mockRejectedValueOnce(new Error("Cloudinary no responde"));

      const r = await servicio.subirImagen(5, ARCHIVO);

      expect(r.imagenUrl).toBe(SUBIDA.url);
    });

    it("NO_ENCONTRADO si la categoría no existe, sin subir nada", async () => {
      guardada = null;

      await expect(servicio.subirImagen(99, ARCHIVO)).rejects.toThrow("NO_ENCONTRADO");
      expect(storage.subir).not.toHaveBeenCalled();
    });

    it("si la subida falla, no toca la base", async () => {
      storage.subir.mockRejectedValueOnce(new Error("ERROR_AL_SUBIR"));

      await expect(servicio.subirImagen(5, ARCHIVO)).rejects.toThrow("ERROR_AL_SUBIR");
      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });
  });

  describe("quitarImagen", () => {
    beforeEach(() => {
      guardada = categoriaCruda({
        imagenUrl: "https://res.cloudinary.com/x/vieja.jpg",
        imagenPublicId: "velua/categorias/vieja",
      });
    });

    it("limpia la URL y el public_id", async () => {
      const r = await servicio.quitarImagen(5);

      expect(repositorio.actualizar).toHaveBeenCalledWith(5, {
        imagenUrl: null,
        imagenPublicId: null,
      });
      expect(r.imagenUrl).toBeNull();
    });

    it("borra el archivo del proveedor después de limpiar la base", async () => {
      await servicio.quitarImagen(5);

      expect(storage.borrar).toHaveBeenCalledWith("velua/categorias/vieja");
      const ordenGuardar = repositorio.actualizar.mock.invocationCallOrder[0];
      const ordenBorrar = storage.borrar.mock.invocationCallOrder[0];
      expect(ordenGuardar).toBeLessThan(ordenBorrar);
    });

    it("si el borrado remoto falla, la imagen igual queda quitada", async () => {
      storage.borrar.mockRejectedValueOnce(new Error("Cloudinary no responde"));

      const r = await servicio.quitarImagen(5);

      expect(r.imagenUrl).toBeNull();
    });

    it("NO_ENCONTRADO si la categoría no existe", async () => {
      guardada = null;

      await expect(servicio.quitarImagen(99)).rejects.toThrow("NO_ENCONTRADO");
    });
  });
});
