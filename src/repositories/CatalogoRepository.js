/**
 * @description Interfaz para el repositorio de catálogo.
 * Define los métodos obligatorios que debe implementar cualquier adaptador de base de datos.
 * El repositorio devuelve datos crudos, no mapeados al contrato de la API.
 */
class CatalogoRepository {
  /**
   * @description Lista las categorías activas.
   * @returns {Promise<Array<Object>>} Lista de categorías crudas.
   */
  async listarCategorias() {
    throw new Error("Metodo listarCategorias no implementado");
  }

  /**
   * @description Lista productos con sus relaciones activas (paginado y filtrado).
   * @param {Object} _filtros - Opciones (pagina, limite, categoria, destacados, q).
   * @returns {Promise<{ filas: Array<Object>, total: number }>} Filas crudas y total para paginación.
   */
  async listarProductos(_filtros = {}) {
    throw new Error("Metodo listarProductos no implementado");
  }

  /**
   * @description Obtiene un producto crudo con sus variantes e imágenes por slug.
   * @param {string} _slug - Slug del producto.
   * @returns {Promise<Object|null>} Objeto del producto o null si no existe.
   */
  async obtenerProductoPorSlug(_slug) {
    throw new Error("Metodo obtenerProductoPorSlug no implementado");
  }
}

module.exports = CatalogoRepository;
