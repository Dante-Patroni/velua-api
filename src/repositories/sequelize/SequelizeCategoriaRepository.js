const { Op, literal } = require("sequelize");
const CategoriaRepository = require("../CategoriaRepository");

/**
 * @description Subconsulta que cuenta los productos activos de cada categoría.
 * Es lo que permite avisar, antes de desactivar una categoría, cuántos
 * productos van a desaparecer de la tienda.
 */
const CANTIDAD_PRODUCTOS = literal(
  "(SELECT COUNT(*) FROM productos p WHERE p.categoria_id = `Categoria`.`id` AND p.activo = 1)"
);

/**
 * @description Subconsulta que cuenta las categorías hijas. El panel la usa para
 * saber si una categoría puede recibir productos o ir debajo de otra.
 */
const CANTIDAD_HIJAS = literal(
  "(SELECT COUNT(*) FROM categorias h WHERE h.padre_id = `Categoria`.`id`)"
);

const ATRIBUTOS = [
  "id",
  "nombre",
  "slug",
  "descripcion",
  "imagenUrl",
  "imagenPublicId",
  "padreId",
  "orden",
  "activa",
  [CANTIDAD_PRODUCTOS, "cantidadProductos"],
  [CANTIDAD_HIJAS, "cantidadHijas"],
];

/**
 * @description Implementación en Sequelize del repositorio de categorías del panel.
 */
class SequelizeCategoriaRepository extends CategoriaRepository {
  /**
   * @description Instancia el repositorio inyectando los modelos.
   * @param {Object} models - Diccionario con los modelos y la instancia de sequelize.
   */
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * @description Lista todas las categorías, activas e inactivas, ordenadas por su campo orden.
   * @returns {Promise<Array<Object>>} Categorías crudas con cantidadProductos.
   */
  async listarTodas() {
    const categorias = await this.models.Categoria.findAll({
      attributes: ATRIBUTOS,
      order: [
        ["orden", "ASC"],
        ["nombre", "ASC"],
      ],
    });
    return categorias.map((c) => c.toJSON());
  }

  /**
   * @description Busca una categoría por id, esté activa o no.
   * @param {number} id - Id de la categoría.
   * @returns {Promise<Object|null>} Categoría cruda con cantidadProductos, o null.
   */
  async buscarPorId(id) {
    const categoria = await this.models.Categoria.findByPk(id, { attributes: ATRIBUTOS });
    return categoria ? categoria.toJSON() : null;
  }

  /**
   * @description Indica si un slug ya está en uso por otra categoría.
   * @param {string} slug - Slug a verificar.
   * @param {number} [excluirId] - Id a ignorar, para cuando se edita la propia categoría.
   * @returns {Promise<boolean>} true si el slug está tomado.
   */
  async existeSlug(slug, excluirId) {
    const where = { slug };
    if (excluirId) {
      where.id = { [Op.ne]: excluirId };
    }
    const cantidad = await this.models.Categoria.count({ where });
    return cantidad > 0;
  }

  /**
   * @description Indica si una categoría tiene productos, publicados o no. Cuenta
   * también los despublicados: siguen perteneciendo a la categoría.
   * @param {number} id - Id de la categoría.
   * @returns {Promise<boolean>} true si tiene al menos uno.
   */
  async tieneProductos(id) {
    const filas = await this.models.sequelize.query(
      "SELECT 1 FROM productos WHERE categoria_id = :id LIMIT 1",
      { replacements: { id }, type: this.models.sequelize.QueryTypes.SELECT }
    );
    return filas.length > 0;
  }

  /**
   * @description Devuelve el próximo valor de orden disponible.
   * @returns {Promise<number>} Mayor orden existente más uno.
   */
  async siguienteOrden() {
    const maximo = await this.models.Categoria.max("orden");
    return (Number(maximo) || 0) + 1;
  }

  /**
   * @description Crea una categoría.
   * @param {Object} datos - Nombre, slug, descripción, imagenUrl, orden y activa.
   * @returns {Promise<Object>} Categoría creada.
   */
  async crear(datos) {
    const categoria = await this.models.Categoria.create(datos);
    return categoria.toJSON();
  }

  /**
   * @description Actualiza los campos indicados de una categoría.
   * @param {number} id - Id de la categoría.
   * @param {Object} cambios - Campos a modificar.
   * @returns {Promise<void>}
   */
  async actualizar(id, cambios) {
    await this.models.Categoria.update(cambios, { where: { id } });
  }

  /**
   * @description Asigna el orden según la posición en el arreglo, todo en una transacción:
   * si falla una actualización, no queda el menú a medio reordenar.
   * @param {number[]} idsEnOrden - Ids de todas las categorías, en el orden deseado.
   * @returns {Promise<void>}
   */
  async reordenar(idsEnOrden) {
    await this.models.sequelize.transaction(async (transaction) => {
      for (const [posicion, id] of idsEnOrden.entries()) {
        await this.models.Categoria.update({ orden: posicion + 1 }, { where: { id }, transaction });
      }
    });
  }
}

module.exports = SequelizeCategoriaRepository;
