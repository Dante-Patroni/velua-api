const { Op, literal } = require("sequelize");
const ProductoRepository = require("../ProductoRepository");

/**
 * @description Subconsultas que resumen las variantes y las imágenes de cada
 * producto. Se hacen así y no con includes porque, al combinar `limit` con
 * relaciones de muchos, Sequelize parte la consulta y los totales se rompen.
 */
const RESUMEN = {
  cantidadVariantes: literal(
    "(SELECT COUNT(*) FROM variantes v WHERE v.producto_id = `Producto`.`id` AND v.activa = 1)"
  ),
  precioDesde: literal(
    "(SELECT MIN(v.precio) FROM variantes v WHERE v.producto_id = `Producto`.`id` AND v.activa = 1)"
  ),
  stockTotal: literal(
    "(SELECT COALESCE(SUM(v.stock), 0) FROM variantes v WHERE v.producto_id = `Producto`.`id` AND v.activa = 1)"
  ),
  cantidadImagenes: literal(
    "(SELECT COUNT(*) FROM imagenes_producto i WHERE i.producto_id = `Producto`.`id`)"
  ),
};

const ATRIBUTOS_LISTADO = [
  "id",
  "nombre",
  "slug",
  "descripcionCorta",
  "activo",
  "destacado",
  "creado_en",
  [RESUMEN.cantidadVariantes, "cantidadVariantes"],
  [RESUMEN.precioDesde, "precioDesde"],
  [RESUMEN.stockTotal, "stockTotal"],
  [RESUMEN.cantidadImagenes, "cantidadImagenes"],
];

const ORDENES = {
  recientes: [["creado_en", "DESC"]],
  nombre: [["nombre", "ASC"]],
  stock: [[RESUMEN.stockTotal, "ASC"]],
};

/**
 * @description Implementación en Sequelize del repositorio de productos del panel.
 */
class SequelizeProductoRepository extends ProductoRepository {
  /**
   * @description Instancia el repositorio inyectando los modelos.
   * @param {Object} models - Diccionario con los modelos y la instancia de sequelize.
   */
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * @description Lista productos paginados para la grilla del panel.
   * @param {Object} filtros - pagina, limite, q, categoriaId, estado y orden.
   * @returns {Promise<{filas: Array<Object>, total: number}>} Filas crudas y total.
   */
  async listar(filtros = {}) {
    const limite = parseInt(filtros.limite, 10) || 20;
    const offset = ((parseInt(filtros.pagina, 10) || 1) - 1) * limite;

    const where = {};
    if (filtros.estado === "activos") where.activo = true;
    if (filtros.estado === "inactivos") where.activo = false;
    if (filtros.categoriaId) where.categoriaId = filtros.categoriaId;
    if (filtros.q) {
      where[Op.or] = [
        { nombre: { [Op.like]: `%${filtros.q}%` } },
        { slug: { [Op.like]: `%${filtros.q}%` } },
      ];
    }

    const { rows, count } = await this.models.Producto.findAndCountAll({
      where,
      attributes: ATRIBUTOS_LISTADO,
      include: [
        {
          model: this.models.Categoria,
          as: "categoria",
          attributes: ["id", "nombre", "slug"],
        },
      ],
      limit: limite,
      offset,
      order: ORDENES[filtros.orden] || ORDENES.recientes,
    });

    return { filas: rows.map((r) => r.toJSON()), total: count };
  }

  /**
   * @description Busca un producto por id con su categoría, todas sus variantes
   * y todas sus imágenes, ordenadas.
   * @param {number} id - Id del producto.
   * @returns {Promise<Object|null>} Producto crudo, o null.
   */
  async buscarPorId(id) {
    const producto = await this.models.Producto.findByPk(id, {
      include: [
        {
          model: this.models.Categoria,
          as: "categoria",
          attributes: ["id", "nombre", "slug"],
        },
        {
          model: this.models.Variante,
          as: "variantes",
          required: false,
        },
        {
          model: this.models.ImagenProducto,
          as: "imagenes",
          required: false,
        },
      ],
      order: [
        [{ model: this.models.Variante, as: "variantes" }, "id", "ASC"],
        [{ model: this.models.ImagenProducto, as: "imagenes" }, "orden", "ASC"],
      ],
    });

    return producto ? producto.toJSON() : null;
  }

  /**
   * @description Indica si un slug ya está en uso por otro producto.
   * @param {string} slug - Slug a verificar.
   * @param {number} [excluirId] - Id a ignorar.
   * @returns {Promise<boolean>} true si el slug está tomado.
   */
  async existeSlug(slug, excluirId) {
    const where = { slug };
    if (excluirId) {
      where.id = { [Op.ne]: excluirId };
    }
    return (await this.models.Producto.count({ where })) > 0;
  }

  /**
   * @description Indica si existe una categoría con ese id, activa o no.
   * @param {number} categoriaId - Id de la categoría.
   * @returns {Promise<boolean>} true si existe.
   */
  async existeCategoria(categoriaId) {
    return (await this.models.Categoria.count({ where: { id: categoriaId } })) > 0;
  }

  /**
   * @description Crea un producto con sus variantes en una transacción.
   * Si falla una variante, no queda el producto suelto sin nada que vender.
   * @param {Object} producto - Datos del producto.
   * @param {Array<Object>} variantes - Variantes a crear.
   * @returns {Promise<Object>} Producto creado.
   */
  crearConVariantes(producto, variantes) {
    return this.models.sequelize.transaction(async (transaction) => {
      const creado = await this.models.Producto.create(producto, { transaction });

      await this.models.Variante.bulkCreate(
        variantes.map((v) => ({ ...v, productoId: creado.id })),
        { transaction, validate: true }
      );

      return creado.toJSON();
    });
  }

  /**
   * @description Actualiza los campos indicados de un producto.
   * @param {number} id - Id del producto.
   * @param {Object} cambios - Campos a modificar.
   * @returns {Promise<void>}
   */
  async actualizar(id, cambios) {
    await this.models.Producto.update(cambios, { where: { id } });
  }

  /**
   * @description Agrega una variante a un producto existente.
   * @param {number} productoId - Id del producto.
   * @param {Object} datos - Datos de la variante.
   * @returns {Promise<Object>} Variante creada.
   */
  async crearVariante(productoId, datos) {
    const variante = await this.models.Variante.create({ ...datos, productoId });
    return variante.toJSON();
  }

  /**
   * @description Actualiza una variante.
   * @param {number} varianteId - Id de la variante.
   * @param {Object} cambios - Campos a modificar.
   * @returns {Promise<void>}
   */
  async actualizarVariante(varianteId, cambios) {
    await this.models.Variante.update(cambios, { where: { id: varianteId } });
  }

  /**
   * @description Indica si un SKU ya está en uso por otra variante.
   * @param {string} sku - SKU a verificar.
   * @param {number} [excluirVarianteId] - Id de variante a ignorar.
   * @returns {Promise<boolean>} true si el SKU está tomado.
   */
  async existeSku(sku, excluirVarianteId) {
    const where = { sku };
    if (excluirVarianteId) {
      where.id = { [Op.ne]: excluirVarianteId };
    }
    return (await this.models.Variante.count({ where })) > 0;
  }

  /**
   * @description Indica si alguna variante del producto figura en un pedido.
   * Se consulta por las variantes y no por el producto porque `pedido_items`
   * referencia la variante, no el producto.
   * @param {number} productoId - Id del producto.
   * @returns {Promise<boolean>} true si tiene ventas registradas.
   */
  async tieneVentas(productoId) {
    const [fila] = await this.models.sequelize.query(
      `SELECT COUNT(*) AS cantidad
         FROM pedido_items pi
         JOIN variantes v ON v.id = pi.variante_id
        WHERE v.producto_id = :productoId`,
      {
        replacements: { productoId },
        type: this.models.sequelize.QueryTypes.SELECT,
      }
    );
    return Number(fila.cantidad) > 0;
  }

  /**
   * @description Borra un producto. Las variantes y las imágenes se van con él
   * por la clave foránea en cascada; los archivos remotos los borra el service
   * antes de llamar acá.
   * @param {number} productoId - Id del producto.
   * @returns {Promise<void>}
   */
  async borrar(productoId) {
    await this.models.Producto.destroy({ where: { id: productoId } });
  }
}

module.exports = SequelizeProductoRepository;
