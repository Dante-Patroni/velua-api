const { Op } = require("sequelize");
const CotizacionRepository = require("../CotizacionRepository");

/**
 * @description Implementación en Sequelize del repositorio de cotización.
 */
class SequelizeCotizacionRepository extends CotizacionRepository {
  /**
   * @description Instancia el repositorio inyectando los modelos.
   * @param {Object} models - Diccionario con los modelos de Sequelize.
   */
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * @description Busca varias variantes de una sola vez.
   *
   * No filtra por activa ni por stock: trae lo que hay y el servicio decide qué
   * hacer. Si filtrara acá, una variante desactivada y una inexistente se verían
   * igual desde afuera, y los mensajes para quien compra tienen que ser
   * distintos.
   *
   * @param {number[]} ids - Ids de las variantes.
   * @returns {Promise<Array<Object>>} Variantes encontradas, con su producto.
   */
  async buscarVariantes(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return [];
    }

    const variantes = await this.models.Variante.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "nombre", "precio", "stock", "activa", "productoId"],
      include: [
        {
          model: this.models.Producto,
          as: "producto",
          attributes: ["id", "nombre", "slug", "activo"],
        },
      ],
    });

    return variantes.map((v) => v.toJSON());
  }

  /**
   * @description Busca una zona de envío activa por id.
   * @param {number} id - Id de la zona.
   * @returns {Promise<Object|null>} Zona cruda, o null si no existe o está inactiva.
   */
  async buscarZonaEnvio(id) {
    const zona = await this.models.ZonaEnvio.findOne({
      where: { id, activa: true },
    });
    return zona ? zona.toJSON() : null;
  }

  /**
   * @description Lista las zonas de envío activas.
   * @returns {Promise<Array<Object>>} Zonas ordenadas por su campo orden.
   */
  async listarZonasEnvio() {
    const zonas = await this.models.ZonaEnvio.findAll({
      where: { activa: true },
      order: [
        ["orden", "ASC"],
        ["nombre", "ASC"],
      ],
    });
    return zonas.map((z) => z.toJSON());
  }
}

module.exports = SequelizeCotizacionRepository;
