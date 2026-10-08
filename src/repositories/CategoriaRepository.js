/**
 * @description Interfaz del repositorio de categorías para el panel de administración.
 * A diferencia de CatalogoRepository, devuelve también las categorías inactivas.
 */
class CategoriaRepository {
  /**
   * @description Lista todas las categorías, activas e inactivas, ordenadas por su campo orden.
   * Cada una incluye cuántos productos activos tiene.
   * @returns {Promise<Array<Object>>} Categorías crudas con cantidadProductos.
   */
  async listarTodas() {
    throw new Error("Metodo listarTodas no implementado");
  }

  /**
   * @description Busca una categoría por id, esté activa o no.
   * @param {number} _id - Id de la categoría.
   * @returns {Promise<Object|null>} Categoría cruda con cantidadProductos, o null.
   */
  async buscarPorId(_id) {
    throw new Error("Metodo buscarPorId no implementado");
  }

  /**
   * @description Indica si un slug ya está en uso por otra categoría.
   * @param {string} _slug - Slug a verificar.
   * @param {number} [_excluirId] - Id a ignorar, para cuando se edita la propia categoría.
   * @returns {Promise<boolean>} true si el slug está tomado.
   */
  async existeSlug(_slug, _excluirId) {
    throw new Error("Metodo existeSlug no implementado");
  }

  /**
   * @description Indica si una categoría tiene productos, publicados o no.
   * @param {number} _id - Id de la categoría.
   * @returns {Promise<boolean>} true si tiene al menos uno.
   */
  async tieneProductos(_id) {
    throw new Error("Metodo tieneProductos no implementado");
  }

  /**
   * @description Devuelve el próximo valor de orden disponible, para ubicar una categoría nueva al final.
   * @returns {Promise<number>} Mayor orden existente más uno.
   */
  async siguienteOrden() {
    throw new Error("Metodo siguienteOrden no implementado");
  }

  /**
   * @description Crea una categoría.
   * @param {Object} _datos - Nombre, slug, descripción, imagenUrl, orden y activa.
   * @returns {Promise<Object>} Categoría creada.
   */
  async crear(_datos) {
    throw new Error("Metodo crear no implementado");
  }

  /**
   * @description Actualiza los campos indicados de una categoría.
   * @param {number} _id - Id de la categoría.
   * @param {Object} _cambios - Campos a modificar.
   * @returns {Promise<void>}
   */
  async actualizar(_id, _cambios) {
    throw new Error("Metodo actualizar no implementado");
  }

  /**
   * @description Asigna el orden de las categorías según la posición en el arreglo, en una sola transacción.
   * @param {number[]} _idsEnOrden - Ids de todas las categorías, en el orden deseado.
   * @returns {Promise<void>}
   */
  async reordenar(_idsEnOrden) {
    throw new Error("Metodo reordenar no implementado");
  }
}

module.exports = CategoriaRepository;
