const ImagenRepository = require("../ImagenRepository");

/**
 * @description Implementación en Sequelize del repositorio de imágenes.
 */
class SequelizeImagenRepository extends ImagenRepository {
  /**
   * @description Instancia el repositorio inyectando los modelos.
   * @param {Object} models - Diccionario con los modelos y la instancia de sequelize.
   */
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * @description Indica si existe un producto con ese id.
   * @param {number} productoId - Id del producto.
   * @returns {Promise<boolean>} true si existe.
   */
  async existeProducto(productoId) {
    return (await this.models.Producto.count({ where: { id: productoId } })) > 0;
  }

  /**
   * @description Lista las imágenes de un producto, ordenadas.
   * @param {number} productoId - Id del producto.
   * @returns {Promise<Array<Object>>} Imágenes crudas.
   */
  async listarDeProducto(productoId) {
    const imagenes = await this.models.ImagenProducto.findAll({
      where: { productoId },
      order: [
        ["orden", "ASC"],
        ["id", "ASC"],
      ],
    });
    return imagenes.map((i) => i.toJSON());
  }

  /**
   * @description Busca una imagen por id.
   * @param {number} imagenId - Id de la imagen.
   * @returns {Promise<Object|null>} Imagen cruda, o null.
   */
  async buscarPorId(imagenId) {
    const imagen = await this.models.ImagenProducto.findByPk(imagenId);
    return imagen ? imagen.toJSON() : null;
  }

  /**
   * @description Devuelve el próximo valor de orden para un producto.
   * @param {number} productoId - Id del producto.
   * @returns {Promise<number>} Mayor orden existente más uno.
   */
  async siguienteOrden(productoId) {
    const maximo = await this.models.ImagenProducto.max("orden", { where: { productoId } });
    return maximo === null || maximo === undefined ? 0 : Number(maximo) + 1;
  }

  /**
   * @description Crea el registro de una imagen ya subida.
   * @param {Object} datos - productoId, url, publicId, alt y orden.
   * @returns {Promise<Object>} Imagen creada.
   */
  async crear(datos) {
    const imagen = await this.models.ImagenProducto.create(datos);
    return imagen.toJSON();
  }

  /**
   * @description Actualiza los campos indicados de una imagen.
   * @param {number} imagenId - Id de la imagen.
   * @param {Object} cambios - Campos a modificar.
   * @returns {Promise<void>}
   */
  async actualizar(imagenId, cambios) {
    await this.models.ImagenProducto.update(cambios, { where: { id: imagenId } });
  }

  /**
   * @description Borra el registro de una imagen.
   * @param {number} imagenId - Id de la imagen.
   * @returns {Promise<void>}
   */
  async borrar(imagenId) {
    await this.models.ImagenProducto.destroy({ where: { id: imagenId } });
  }

  /**
   * @description Asigna el orden según la posición en el arreglo, en una transacción:
   * si falla una actualización, no queda la galería a medio reordenar.
   * @param {Array<number>} idsEnOrden - Ids de todas las imágenes del producto.
   * @returns {Promise<void>}
   */
  reordenar(idsEnOrden) {
    return this.models.sequelize.transaction(async (transaction) => {
      for (const [posicion, id] of idsEnOrden.entries()) {
        await this.models.ImagenProducto.update(
          { orden: posicion },
          { where: { id }, transaction }
        );
      }
    });
  }
}

module.exports = SequelizeImagenRepository;
