const UsuarioRepository = require("../UsuarioRepository");

/**
 * @description Implementación en Sequelize del repositorio de usuarios.
 */
class SequelizeUsuarioRepository extends UsuarioRepository {
  /**
   * @description Instancia el repositorio inyectando los modelos.
   * @param {Object} models - Diccionario con los modelos de Sequelize.
   */
  constructor(models) {
    super();
    this.models = models;
  }

  /**
   * @description Busca un usuario por mail, incluyendo el hash de la contraseña.
   * @param {string} email - Mail ya normalizado a minúsculas.
   * @returns {Promise<Object|null>} Usuario con su passwordHash, o null.
   */
  async buscarPorEmail(email) {
    const usuario = await this.models.Usuario.findOne({ where: { email } });
    return usuario ? usuario.toJSON() : null;
  }

  /**
   * @description Busca un usuario por id, sin el hash de la contraseña.
   * @param {number} id - Id del usuario.
   * @returns {Promise<Object|null>} Usuario sin passwordHash, o null.
   */
  async buscarPorId(id) {
    const usuario = await this.models.Usuario.findByPk(id, {
      attributes: { exclude: ["passwordHash"] },
    });
    return usuario ? usuario.toJSON() : null;
  }

  /**
   * @description Registra la fecha del último ingreso del usuario.
   * @param {number} id - Id del usuario.
   * @returns {Promise<void>}
   */
  async registrarAcceso(id) {
    await this.models.Usuario.update({ ultimoAcceso: new Date() }, { where: { id } });
  }
}

module.exports = SequelizeUsuarioRepository;
