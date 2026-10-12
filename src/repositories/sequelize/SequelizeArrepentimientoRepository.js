const { ArrepentimientoRepository } = require("../ArrepentimientoRepository");

/**
 * @description Implementación en Sequelize del repositorio de arrepentimientos.
 */
class SequelizeArrepentimientoRepository extends ArrepentimientoRepository {
  /**
   * @description Instancia el repositorio inyectando los modelos.
   * @param {Object} models - Diccionario con los modelos y la instancia de sequelize.
   */
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * @description Indica si un código de trámite ya está en uso.
   * @param {string} codigo - Código a verificar.
   * @returns {Promise<boolean>} true si existe.
   */
  async existeCodigo(codigo) {
    return (await this.models.Arrepentimiento.count({ where: { codigo } })) > 0;
  }

  /**
   * @description Guarda la solicitud y encola sus mails en una sola transacción: si
   * falla el encolado, la solicitud tampoco queda, y la clienta puede volver a
   * enviarla. Nunca queda un trámite sin su mail con el código.
   * @param {Object} arrepentimiento - Solicitud normalizada, con su código.
   * @param {Array<{tipo: string, destinatario: string, datos: Object}>} emails - Mails a encolar.
   * @returns {Promise<{codigo: string, creadoEn: Date}>} Solicitud guardada.
   */
  async registrar(arrepentimiento, emails) {
    const resultado = await this.models.sequelize.transaction(async (transaction) => {
      const creado = await this.models.Arrepentimiento.create(arrepentimiento, { transaction });
      const ahora = new Date();
      await this.models.EmailPendiente.bulkCreate(
        emails.map((e) => ({ ...e, pedidoId: null, enviarDesde: ahora })),
        { transaction }
      );
      return { codigo: creado.codigo, creadoEn: creado.creadoEn };
    });
    return resultado;
  }
}

module.exports = SequelizeArrepentimientoRepository;