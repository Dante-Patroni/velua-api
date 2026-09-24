const { ImagenAdminService, MAXIMO_IMAGENES } = require("../../src/services/ImagenAdminService");

/**
 * Imagen como la devuelve el repositorio, con su publicId interno.
 */
const imagenCruda = (cambios = {}) => ({
  id: 3,
  productoId: 7,
  url: "https://res.cloudinary.com/x/velua/productos/abc.jpg",
  publicId: "velua/productos/abc",
  alt: "Jabón sobre madera",
  orden: 0,
  ...cambios,
});

const ARCHIVO = Buffer.from("contenido de la imagen");

describe("ImagenAdminService", () => {
  let servicio;
  let repositorio;
  let almacenamiento;

  beforeEach(() => {
    repositorio = {
      existeProducto: jest.fn().mockResolvedValue(true),
      listarDeProducto: jest.fn().mockResolvedValue([imagenCruda()]),
      buscarPorId: jest.fn().mockResolvedValue(imagenCruda()),
      siguienteOrden: jest.fn().mockResolvedValue(1),
      crear: jest.fn().mockResolvedValue(imagenCruda({ id: 4 })),
      actualizar: jest.fn().mockResolvedValue(undefined),
      borrar: jest.fn().mockResolvedValue(undefined),
      reordenar: jest.fn().mockResolvedValue(undefined),
    };
    almacenamiento = {
      subir: jest.fn().mockResolvedValue({
        url: "https://res.cloudinary.com/x/nueva.jpg",
        publicId: "velua/productos/nueva",
      }),
      borrar: jest.fn().mockResolvedValue(true),
    };
    servicio = new ImagenAdminService(repositorio, almacenamiento);
  });

  describe("listar", () => {
    it("lanza NO_ENCONTRADO si el producto no existe", async () => {
      repositorio.existeProducto.mockResolvedValue(false);

      await expect(servicio.listar(99)).rejects.toThrow("NO_ENCONTRADO");
    });

    it("no expone el publicId ni el productoId", async () => {
      // El publicId es interno: identifica el archivo en el proveedor
      const imagenes = await servicio.listar(7);

      expect(imagenes[0]).not.toHaveProperty("publicId");
      expect(imagenes[0]).not.toHaveProperty("productoId");
    });

    it("expone id, url, alt y orden", async () => {
      const [i] = await servicio.listar(7);

      expect(i).toEqual({
        id: 3,
        url: "https://res.cloudinary.com/x/velua/productos/abc.jpg",
        alt: "Jabón sobre madera",
        orden: 0,
      });
    });
  });

  describe("subir", () => {
    it("rechaza si el producto no existe, sin subir nada", async () => {
      repositorio.existeProducto.mockResolvedValue(false);

      await expect(servicio.subir(99, ARCHIVO)).rejects.toThrow("NO_ENCONTRADO");
      expect(almacenamiento.subir).not.toHaveBeenCalled();
    });

    it("sube el archivo y guarda url y publicId", async () => {
      await servicio.subir(7, ARCHIVO, "Texto alternativo");

      expect(almacenamiento.subir).toHaveBeenCalledWith(ARCHIVO, "velua/productos");
      expect(repositorio.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          productoId: 7,
          url: "https://res.cloudinary.com/x/nueva.jpg",
          publicId: "velua/productos/nueva",
          alt: "Texto alternativo",
        })
      );
    });

    it("guarda el publicId, sin el cual no se podría borrar el archivo remoto", async () => {
      await servicio.subir(7, ARCHIVO);

      const datos = repositorio.crear.mock.calls[0][0];
      expect(datos.publicId).toBeTruthy();
    });

    it("la agrega al final de la galería", async () => {
      repositorio.siguienteOrden.mockResolvedValue(5);

      await servicio.subir(7, ARCHIVO);

      expect(repositorio.crear).toHaveBeenCalledWith(expect.objectContaining({ orden: 5 }));
    });

    it("guarda alt en null si viene vacío", async () => {
      await servicio.subir(7, ARCHIVO, "   ");

      expect(repositorio.crear).toHaveBeenCalledWith(expect.objectContaining({ alt: null }));
    });

    it("rechaza cuando el producto llegó al máximo de imágenes", async () => {
      repositorio.listarDeProducto.mockResolvedValue(
        Array.from({ length: MAXIMO_IMAGENES }, (_, i) => imagenCruda({ id: i + 1 }))
      );

      await expect(servicio.subir(7, ARCHIVO)).rejects.toThrow("LIMITE_IMAGENES");
      expect(almacenamiento.subir).not.toHaveBeenCalled();
    });

    it("borra el archivo remoto si falla el registro en la base", async () => {
      // Sin esta compensacion quedaria un huerfano consumiendo cuota para siempre
      repositorio.crear.mockRejectedValue(new Error("ERROR_INTERNO"));

      await expect(servicio.subir(7, ARCHIVO)).rejects.toThrow("ERROR_INTERNO");
      expect(almacenamiento.borrar).toHaveBeenCalledWith("velua/productos/nueva");
    });

    it("propaga el error del proveedor sin registrar nada", async () => {
      almacenamiento.subir.mockRejectedValue(new Error("ERROR_AL_SUBIR"));

      await expect(servicio.subir(7, ARCHIVO)).rejects.toThrow("ERROR_AL_SUBIR");
      expect(repositorio.crear).not.toHaveBeenCalled();
    });
  });

  describe("borrar", () => {
    it("rechaza una imagen de otro producto", async () => {
      repositorio.buscarPorId.mockResolvedValue(imagenCruda({ productoId: 99 }));

      await expect(servicio.borrar(7, 3)).rejects.toThrow("NO_ENCONTRADO");
      expect(almacenamiento.borrar).not.toHaveBeenCalled();
      expect(repositorio.borrar).not.toHaveBeenCalled();
    });

    it("borra el archivo remoto y después la fila", async () => {
      await servicio.borrar(7, 3);

      expect(almacenamiento.borrar).toHaveBeenCalledWith("velua/productos/abc");
      expect(repositorio.borrar).toHaveBeenCalledWith(3);
    });

    it("borra la fila aunque falle el borrado remoto", async () => {
      // Una fila apuntando a una imagen inexistente deja la tienda con una foto rota
      almacenamiento.borrar.mockResolvedValue(false);

      await servicio.borrar(7, 3);

      expect(repositorio.borrar).toHaveBeenCalledWith(3);
    });

    it("borra la fila de una imagen sin publicId, como las del seed", async () => {
      repositorio.buscarPorId.mockResolvedValue(imagenCruda({ publicId: null }));

      await servicio.borrar(7, 3);

      expect(almacenamiento.borrar).not.toHaveBeenCalled();
      expect(repositorio.borrar).toHaveBeenCalledWith(3);
    });
  });

  describe("actualizarAlt", () => {
    it("rechaza una imagen de otro producto", async () => {
      repositorio.buscarPorId.mockResolvedValue(imagenCruda({ productoId: 99 }));

      await expect(servicio.actualizarAlt(7, 3, "X")).rejects.toThrow("NO_ENCONTRADO");
    });

    it("guarda el texto alternativo recortado", async () => {
      await servicio.actualizarAlt(7, 3, "  Jabón de caléndula  ");

      expect(repositorio.actualizar).toHaveBeenCalledWith(3, { alt: "Jabón de caléndula" });
    });

    it("permite dejarlo vacío", async () => {
      await servicio.actualizarAlt(7, 3, "");

      expect(repositorio.actualizar).toHaveBeenCalledWith(3, { alt: null });
    });
  });

  describe("reordenar", () => {
    beforeEach(() => {
      repositorio.listarDeProducto.mockResolvedValue([
        imagenCruda({ id: 1, orden: 0 }),
        imagenCruda({ id: 2, orden: 1 }),
        imagenCruda({ id: 3, orden: 2 }),
      ]);
    });

    it("reordena con la lista completa", async () => {
      await servicio.reordenar(7, [3, 1, 2]);

      expect(repositorio.reordenar).toHaveBeenCalledWith([3, 1, 2]);
    });

    it("rechaza una lista con imágenes faltantes", async () => {
      await expect(servicio.reordenar(7, [3, 1])).rejects.toThrow("DATOS_INVALIDOS");
      expect(repositorio.reordenar).not.toHaveBeenCalled();
    });

    it("rechaza ids repetidos", async () => {
      await expect(servicio.reordenar(7, [1, 1, 2])).rejects.toThrow("DATOS_INVALIDOS");
    });

    it("rechaza imágenes de otro producto", async () => {
      await expect(servicio.reordenar(7, [1, 2, 99])).rejects.toThrow("DATOS_INVALIDOS");
    });
  });
});
