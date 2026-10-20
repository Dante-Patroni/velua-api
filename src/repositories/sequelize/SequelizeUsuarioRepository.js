const { literal } = require("sequelize");
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

  /**
 * @description Busca lo mínimo para validar una sesión en cada request.
 * Nunca trae el hash de la contraseña.
 * @param {number} id - Id del usuario.
 * @returns {Promise<Object|null>} id, rol, activo y versionSesion, o null.
 */
  async buscarSesion(id) {
    const usuario = await this.models.Usuario.findByPk(id, {
      attributes: ["id", "rol", "activo", "versionSesion"],
    });
    return usuario ? usuario.toJSON() : null;
  }

  /**
   * @description Busca un usuario por id con el hash de la contraseña.
   * Solo para verificar la contraseña actual antes de cambiarla.
   * @param {number} id - Id del usuario.
   * @returns {Promise<Object|null>} id, email, activo y passwordHash, o null.
   */
  async buscarConHash(id) {
    const usuario = await this.models.Usuario.findByPk(id, {
      attributes: ["id", "email", "activo", "passwordHash"],
    });
    return usuario ? usuario.toJSON() : null;
  }

  /**
   * @description Guarda el hash nuevo e incrementa version_sesion en un solo UPDATE.
   * El incremento lo hace la base, así no hay carrera entre leer y escribir.
   * @param {number} id - Id del usuario.
   * @param {string} passwordHash - Hash bcrypt de la contraseña nueva.
   * @returns {Promise<void>}
   * @throws {Error} NO_ENCONTRADO si el usuario no existe.
   */
  async cambiarContrasena(id, passwordHash) {
    const [filas] = await this.models.Usuario.update(
      { passwordHash, versionSesion: literal("version_sesion + 1") },
      { where: { id } }
    );
    if (filas === 0) {
      throw new Error("NO_ENCONTRADO");
    }
  }
}

module.exports = SequelizeUsuarioRepository;
