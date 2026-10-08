/**
 * @description Interfaz del repositorio de productos para el panel de administración.
 * A diferencia de CatalogoRepository, incluye los productos y las variantes inactivas.
 */
class ProductoRepository {
  /**
   * @description Lista productos paginados para la grilla del panel, con sus totales.
   * @param {Object} _filtros - pagina, limite, q, categoriaId, estado y orden.
   * @returns {Promise<{filas: Array<Object>, total: number}>} Filas crudas y total.
   */
  async listar(_filtros) {
    throw new Error("Metodo listar no implementado");
  }

  /**
   * @description Busca un producto por id con su categoría, todas sus variantes
   * (activas e inactivas) y todas sus imágenes.
   * @param {number} _id - Id del producto.
   * @returns {Promise<Object|null>} Producto crudo, o null.
   */
  async buscarPorId(_id) {
    throw new Error("Metodo buscarPorId no implementado");
  }

  /**
   * @description Indica si un slug ya está en uso por otro producto.
   * @param {string} _slug - Slug a verificar.
   * @param {number} [_excluirId] - Id a ignorar, para cuando se edita el propio producto.
   * @returns {Promise<boolean>} true si el slug está tomado.
   */
  async existeSlug(_slug, _excluirId) {
    throw new Error("Metodo existeSlug no implementado");
  }

  /**
   * @description Indica si existe una categoría activa o inactiva con ese id.
   * @param {number} _categoriaId - Id de la categoría.
   * @returns {Promise<boolean>} true si existe.
   */
  async existeCategoria(_categoriaId) {
    throw new Error("Metodo existeCategoria no implementado");
  }

  /**
   * @description Indica si una categoría tiene categorías hijas.
   * @param {number} _categoriaId - Id de la categoría.
   * @returns {Promise<boolean>} true si tiene al menos una.
   */
  async categoriaTieneHijas(_categoriaId) {
    throw new Error("Metodo categoriaTieneHijas no implementado");
  }

  /**
   * @description Crea un producto con sus variantes en una sola transacción:
   * el esquema exige al menos una variante, así que un producto sin ellas
   * quedaría inválido.
   * @param {Object} _producto - Datos del producto.
   * @param {Array<Object>} _variantes - Variantes a crear.
   * @returns {Promise<Object>} Producto creado.
   */
  async crearConVariantes(_producto, _variantes) {
    throw new Error("Metodo crearConVariantes no implementado");
  }

  /**
   * @description Actualiza los campos indicados de un producto.
   * @param {number} _id - Id del producto.
   * @param {Object} _cambios - Campos a modificar.
   * @returns {Promise<void>}
   */
  async actualizar(_id, _cambios) {
    throw new Error("Metodo actualizar no implementado");
  }

  /**
   * @description Agrega una variante a un producto existente.
   * @param {number} _productoId - Id del producto.
   * @param {Object} _datos - Datos de la variante.
   * @returns {Promise<Object>} Variante creada.
   */
  async crearVariante(_productoId, _datos) {
    throw new Error("Metodo crearVariante no implementado");
  }

  /**
   * @description Actualiza una variante.
   * @param {number} _varianteId - Id de la variante.
   * @param {Object} _cambios - Campos a modificar.
   * @returns {Promise<void>}
   */
  async actualizarVariante(_varianteId, _cambios) {
    throw new Error("Metodo actualizarVariante no implementado");
  }

  /**
   * @description Indica si un SKU ya está en uso por otra variante.
   * @param {string} _sku - SKU a verificar.
   * @param {number} [_excluirVarianteId] - Id de variante a ignorar.
   * @returns {Promise<boolean>} true si el SKU está tomado.
   */
  async existeSku(_sku, _excluirVarianteId) {
    throw new Error("Metodo existeSku no implementado");
  }

  /**
   * @description Indica si alguna variante del producto figura en un pedido.
   * @param {number} _productoId - Id del producto.
   * @returns {Promise<boolean>} true si tiene ventas registradas.
   */
  async tieneVentas(_productoId) {
    throw new Error("Metodo tieneVentas no implementado");
  }

  /**
   * @description Borra un producto con sus variantes e imágenes.
   * @param {number} _productoId - Id del producto.
   * @returns {Promise<void>}
   */
  async borrar(_productoId) {
    throw new Error("Metodo borrar no implementado");
  }
}

module.exports = ProductoRepository;
