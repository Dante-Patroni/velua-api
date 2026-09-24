/**
 * @description Interfaz del repositorio de imágenes de producto.
 */
class ImagenRepository {
  /**
   * @description Indica si existe un producto con ese id.
   * @param {number} _productoId - Id del producto.
   * @returns {Promise<boolean>} true si existe.
   */
  async existeProducto(_productoId) {
    throw new Error("Metodo existeProducto no implementado");
  }

  /**
   * @description Lista las imágenes de un producto, ordenadas.
   * @param {number} _productoId - Id del producto.
   * @returns {Promise<Array<Object>>} Imágenes crudas.
   */
  async listarDeProducto(_productoId) {
    throw new Error("Metodo listarDeProducto no implementado");
  }

  /**
   * @description Busca una imagen por id.
   * @param {number} _imagenId - Id de la imagen.
   * @returns {Promise<Object|null>} Imagen cruda, o null.
   */
  async buscarPorId(_imagenId) {
    throw new Error("Metodo buscarPorId no implementado");
  }

  /**
   * @description Devuelve el próximo valor de orden para un producto.
   * @param {number} _productoId - Id del producto.
   * @returns {Promise<number>} Mayor orden existente más uno.
   */
  async siguienteOrden(_productoId) {
    throw new Error("Metodo siguienteOrden no implementado");
  }

  /**
   * @description Crea el registro de una imagen ya subida.
   * @param {Object} _datos - productoId, url, publicId, alt y orden.
   * @returns {Promise<Object>} Imagen creada.
   */
  async crear(_datos) {
    throw new Error("Metodo crear no implementado");
  }

  /**
   * @description Actualiza los campos indicados de una imagen.
   * @param {number} _imagenId - Id de la imagen.
   * @param {Object} _cambios - Campos a modificar.
   * @returns {Promise<void>}
   */
  async actualizar(_imagenId, _cambios) {
    throw new Error("Metodo actualizar no implementado");
  }

  /**
   * @description Borra el registro de una imagen.
   * @param {number} _imagenId - Id de la imagen.
   * @returns {Promise<void>}
   */
  async borrar(_imagenId) {
    throw new Error("Metodo borrar no implementado");
  }

  /**
   * @description Asigna el orden según la posición en el arreglo, en una transacción.
   * @param {Array<number>} _idsEnOrden - Ids de todas las imágenes del producto.
   * @returns {Promise<void>}
   */
  async reordenar(_idsEnOrden) {
    throw new Error("Metodo reordenar no implementado");
  }
}

module.exports = ImagenRepository;
