/**
 * @description Carpeta donde se guardan las fotos de producto en el proveedor.
 */
const CARPETA = "velua/productos";

/**
 * @description Máximo de imágenes por producto. Existe para que nadie agote la
 * cuota del plan gratuito cargando cientos de fotos en un solo producto.
 */
const MAXIMO_IMAGENES = 8;

/**
 * @description Recorta una imagen al formato que expone el panel.
 * @param {Object} imagen - Imagen cruda del repositorio.
 * @returns {Object} Imagen con los campos del panel.
 */
const mapearImagen = (imagen) => ({
  id: imagen.id,
  url: imagen.url,
  alt: imagen.alt ?? null,
  orden: imagen.orden,
});

/**
 * @description Servicio de administración de las imágenes de un producto.
 */
class ImagenAdminService {
  /**
   * @description Instancia el servicio.
   * @param {Object} imagenRepository - Implementación de ImagenRepository.
   * @param {Object} imagenStorage - Implementación de ImagenStorage.
   */
  constructor(imagenRepository, imagenStorage) {
    this.imagenRepository = imagenRepository;
    this.imagenStorage = imagenStorage;
  }

  /**
   * @description Lista las imágenes de un producto.
   * @param {number} productoId - Id del producto.
   * @returns {Promise<Array<Object>>} Imágenes ordenadas.
   * @throws {Error} NO_ENCONTRADO
   */
  async listar(productoId) {
    await this.#exigirProducto(productoId);
    const imagenes = await this.imagenRepository.listarDeProducto(productoId);
    return imagenes.map(mapearImagen);
  }

  /**
   * @description Sube una imagen y la agrega al final de la galería.
   *
   * La subida al proveedor no puede entrar en la transacción de la base, porque
   * es un servicio externo. Si el registro falla después de subir, se borra el
   * archivo remoto: si no, quedaría un huérfano consumiendo cuota para siempre.
   *
   * @param {number} productoId - Id del producto.
   * @param {Buffer} archivo - Contenido del archivo ya validado.
   * @param {string} [alt] - Texto alternativo para accesibilidad.
   * @returns {Promise<Array<Object>>} Galería actualizada.
   * @throws {Error} NO_ENCONTRADO, LIMITE_IMAGENES, ERROR_AL_SUBIR
   */
  async subir(productoId, archivo, alt) {
    await this.#exigirProducto(productoId);

    const existentes = await this.imagenRepository.listarDeProducto(productoId);
    if (existentes.length >= MAXIMO_IMAGENES) {
      throw new Error("LIMITE_IMAGENES");
    }

    const { url, publicId } = await this.imagenStorage.subir(archivo, CARPETA);

    try {
      await this.imagenRepository.crear({
        productoId,
        url,
        publicId,
        alt: alt?.trim() || null,
        orden: await this.imagenRepository.siguienteOrden(productoId),
      });
    } catch (error) {
      await this.imagenStorage.borrar(publicId);
      throw error;
    }

    return this.listar(productoId);
  }

  /**
   * @description Cambia el texto alternativo de una imagen.
   * @param {number} productoId - Id del producto.
   * @param {number} imagenId - Id de la imagen.
   * @param {string} alt - Texto alternativo.
   * @returns {Promise<Array<Object>>} Galería actualizada.
   * @throws {Error} NO_ENCONTRADO
   */
  async actualizarAlt(productoId, imagenId, alt) {
    await this.#exigirImagenDelProducto(productoId, imagenId);
    await this.imagenRepository.actualizar(imagenId, { alt: alt?.trim() || null });
    return this.listar(productoId);
  }

  /**
   * @description Borra una imagen de la base y del proveedor.
   *
   * Si el borrado remoto falla, la fila se borra igual: un archivo huérfano en
   * el proveedor molesta menos que una fila apuntando a una imagen que ya no
   * existe, que dejaría la tienda con una foto rota.
   *
   * @param {number} productoId - Id del producto.
   * @param {number} imagenId - Id de la imagen.
   * @returns {Promise<Array<Object>>} Galería actualizada.
   * @throws {Error} NO_ENCONTRADO
   */
  async borrar(productoId, imagenId) {
    const imagen = await this.#exigirImagenDelProducto(productoId, imagenId);

    if (imagen.publicId) {
      await this.imagenStorage.borrar(imagen.publicId);
    }
    await this.imagenRepository.borrar(imagenId);

    return this.listar(productoId);
  }

  /**
   * @description Reordena la galería. La primera imagen es la principal, la que
   * se ve en la grilla de la tienda.
   *
   * Exige la lista completa de imágenes del producto: un orden parcial dejaría
   * dos en la misma posición y la principal sería impredecible.
   *
   * @param {number} productoId - Id del producto.
   * @param {Array<number>} idsEnOrden - Ids de todas las imágenes, en el orden deseado.
   * @returns {Promise<Array<Object>>} Galería en el orden nuevo.
   * @throws {Error} NO_ENCONTRADO, DATOS_INVALIDOS
   */
  async reordenar(productoId, idsEnOrden) {
    await this.#exigirProducto(productoId);

    const existentes = await this.imagenRepository.listarDeProducto(productoId);
    const idsExistentes = new Set(existentes.map((i) => i.id));
    const idsRecibidos = new Set(idsEnOrden);

    const sinRepetidos = idsRecibidos.size === idsEnOrden.length;
    const mismaCantidad = idsRecibidos.size === idsExistentes.size;
    const todasDelProducto = [...idsRecibidos].every((id) => idsExistentes.has(id));

    if (!sinRepetidos || !mismaCantidad || !todasDelProducto) {
      throw new Error("DATOS_INVALIDOS");
    }

    await this.imagenRepository.reordenar(idsEnOrden);
    return this.listar(productoId);
  }

  /**
   * @description Verifica que el producto exista.
   * @param {number} productoId - Id del producto.
   * @returns {Promise<void>}
   * @throws {Error} NO_ENCONTRADO
   */
  async #exigirProducto(productoId) {
    if (!(await this.imagenRepository.existeProducto(productoId))) {
      throw new Error("NO_ENCONTRADO");
    }
  }

  /**
   * @description Verifica que la imagen exista y pertenezca a ese producto.
   * @param {number} productoId - Id del producto.
   * @param {number} imagenId - Id de la imagen.
   * @returns {Promise<Object>} Imagen cruda.
   * @throws {Error} NO_ENCONTRADO
   */
  async #exigirImagenDelProducto(productoId, imagenId) {
    const imagen = await this.imagenRepository.buscarPorId(imagenId);
    if (!imagen || Number(imagen.productoId) !== Number(productoId)) {
      throw new Error("NO_ENCONTRADO");
    }
    return imagen;
  }
}

module.exports = { ImagenAdminService, MAXIMO_IMAGENES, CARPETA };
