const { Op } = require("sequelize");
const CatalogoRepository = require("./CatalogoRepository");

/**
 * @description Implementación en Sequelize de la interfaz CatalogoRepository.
 */
class SequelizeCatalogoRepository extends CatalogoRepository {
  /**
   * @description Instancia el repositorio inyectando los modelos de Sequelize.
   * @param {Object} models - Diccionario con los modelos instanciados.
   */
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * @description Lista las categorías activas ordenadas por la columna 'orden'.
   * @returns {Promise<Array<Object>>} Lista de objetos crudos de categorías.
   */
  async listarCategorias() {
    const categorias = await this.models.Categoria.findAll({
      where: { activa: true },
      order: [["orden", "ASC"]],
      attributes: ["id", "nombre", "slug", "descripcion", "imagenUrl"],
    });
    return categorias.map((cat) => cat.toJSON());
  }

  /**
   * @description Lista productos con sus relaciones activas, sin formatear para la API.
   * @param {Object} filtros - Opciones (pagina, limite, categoria, destacados, q).
   * @returns {Promise<{ filas: Array<Object>, total: number }>} Filas y total para la paginación.
   */
  async listarProductos(filtros = {}) {
    const limite = parseInt(filtros.limite, 10) || 20;
    const offset = ((parseInt(filtros.pagina, 10) || 1) - 1) * limite;

    const whereProducto = { activo: true };
    if (filtros.destacados) {
      whereProducto.destacado = true;
    }
    if (filtros.q) {
      whereProducto[Op.or] = [
        { nombre: { [Op.like]: `%${filtros.q}%` } },
        { descripcionCorta: { [Op.like]: `%${filtros.q}%` } },
      ];
    }

    const includeCategoria = {
      model: this.models.Categoria,
      as: "categoria",
      where: { activa: true },
      attributes: ["id", "nombre", "slug", "descripcion", "imagenUrl"],
    };

    if (filtros.categoria) {
      includeCategoria.where.slug = filtros.categoria;
    }

    const { rows, count } = await this.models.Producto.findAndCountAll({
      where: whereProducto,
      distinct: true,
      limit: limite,
      offset: offset,
      include: [
        includeCategoria,
        {
          model: this.models.Variante,
          as: "variantes",
          where: { activa: true },
          required: false,
        },
        {
          model: this.models.ImagenProducto,
          as: "imagenes",
          required: false,
          attributes: ["url", "alt", "orden"],
        },
      ],
      order: [
        [{ model: this.models.Categoria, as: "categoria" }, "orden", "ASC"],
        ["nombre", "ASC"],
        [{ model: this.models.ImagenProducto, as: "imagenes" }, "orden", "ASC"],
      ],
    });

    return {
      filas: rows.map((r) => r.toJSON()),
      total: count,
    };
  }

  /**
   * @description Obtiene el producto y sus relaciones activas por slug, devolviendo datos crudos.
   * @param {string} slug - Slug identificador del producto.
   * @returns {Promise<Object|null>} Objeto de base de datos convertido a JSON o null.
   */
  async obtenerProductoPorSlug(slug) {
    const producto = await this.models.Producto.findOne({
      where: { slug, activo: true },
      include: [
        {
          model: this.models.Categoria,
          as: "categoria",
          attributes: ["id", "nombre", "slug", "descripcion", "imagenUrl"],
        },
        {
          model: this.models.Variante,
          as: "variantes",
          where: { activa: true },
          required: false,
          attributes: ["id", "nombre", "sku", "precio", "precioAnterior", "stock"],
        },
        {
          model: this.models.ImagenProducto,
          as: "imagenes",
          required: false,
          attributes: ["url", "alt", "orden"],
        },
      ],
      order: [[{ model: this.models.ImagenProducto, as: "imagenes" }, "orden", "ASC"]],
    });

    return producto ? producto.toJSON() : null;
  }
}

module.exports = SequelizeCatalogoRepository;
