const { Op, literal } = require("sequelize");
const CatalogoRepository = require("../CatalogoRepository");

/**
 * @description Condición que exige que la categoría padre, si existe, esté activa.
 *
 * Desactivar una categoría oculta todo lo que cuelga de ella: sus productos y
 * también sus hijas, con los productos de cada una. Sin esta condición, apagar
 * "Jabones" dejaría visibles sus tres colecciones.
 *
 * @param {string} alias - Alias de la tabla de categorías en la consulta.
 * @returns {Object} Literal de Sequelize para usar dentro de un where.
 */
const padreActivo = (alias) =>
  literal(
    `(\`${alias}\`.\`padre_id\` IS NULL OR EXISTS (` +
      `SELECT 1 FROM categorias p WHERE p.id = \`${alias}\`.\`padre_id\` AND p.activa = 1))`
  );

/** Campos de la categoría que necesita el catálogo. */
const ATRIBUTOS_CATEGORIA = ["id", "padreId", "nombre", "slug", "descripcion", "imagenUrl"];

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
   * @description Lista las categorías visibles, ordenadas por la columna 'orden'.
   * Devuelve la lista plana, con padreId: el árbol lo arma el servicio.
   * @returns {Promise<Array<Object>>} Lista de objetos crudos de categorías.
   */
  async listarCategorias() {
    const categorias = await this.models.Categoria.findAll({
      where: { activa: true, [Op.and]: [padreActivo("Categoria")] },
      order: [
        ["orden", "ASC"],
        ["nombre", "ASC"],
      ],
      attributes: ATRIBUTOS_CATEGORIA,
    });
    return categorias.map((cat) => cat.toJSON());
  }

  /**
   * @description Lista productos con sus relaciones activas, sin formatear para la API.
   *
   * Si se filtra por una categoría que tiene hijas, entran los productos de
   * todas ellas: la página de "Jabones" muestra los de sus tres colecciones.
   *
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
      where: { activa: true, [Op.and]: [padreActivo("categoria")] },
      attributes: [...ATRIBUTOS_CATEGORIA, "orden"],
    };

    if (filtros.categoria) {
      const ids = await this.#idsDeCategoria(filtros.categoria);
      if (ids.length === 0) {
        return { filas: [], total: 0 };
      }
      includeCategoria.where.id = { [Op.in]: ids };
    }

    const precioMinimo = literal(
      "(SELECT MIN(v.precio) FROM variantes v " +
        "WHERE v.producto_id = Producto.id AND v.activa = 1)"
    );

    const ordenCategoria = literal(
      "(SELECT c.orden FROM categorias c WHERE c.id = `Producto`.`categoria_id`)"
    );

    const ordenes = {
      precio_asc: [[precioMinimo, "ASC"]],
      precio_desc: [[precioMinimo, "DESC"]],
      defecto: [
        [ordenCategoria, "ASC"],
        ["nombre", "ASC"],
      ],
    };

    // mas_vendidos todavia no esta implementado: cae al orden por defecto
    const orden = ordenes[filtros.orden] || ordenes.defecto;

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
      order: [...orden, [{ model: this.models.ImagenProducto, as: "imagenes" }, "orden", "ASC"]],
    });

    return {
      filas: rows.map((r) => r.toJSON()),
      total: count,
    };
  }

  /**
   * @description Obtiene el producto y sus relaciones activas por slug, devolviendo datos crudos.
   *
   * Un producto cuya categoría (o la categoría padre) está desactivada no se
   * muestra, aunque él siga activo: es la misma regla que la grilla.
   *
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
          where: { activa: true, [Op.and]: [padreActivo("categoria")] },
          attributes: ATRIBUTOS_CATEGORIA,
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

  /**
   * @description Ids de las categorías que abarca un slug: la categoría misma y,
   * si tiene hijas, todas sus hijas activas. Si el slug no existe o está
   * desactivado, devuelve una lista vacía.
   * @param {string} slug - Slug de la categoría.
   * @returns {Promise<number[]>} Ids de las categorías.
   */
  async #idsDeCategoria(slug) {
    const filas = await this.models.sequelize.query(
      `SELECT c.id
         FROM categorias c
         JOIN categorias base ON base.slug = :slug AND base.activa = 1
        WHERE c.activa = 1 AND (c.id = base.id OR c.padre_id = base.id)`,
      { replacements: { slug }, type: this.models.sequelize.QueryTypes.SELECT }
    );
    return filas.map((f) => f.id);
  }
}

module.exports = SequelizeCatalogoRepository;
