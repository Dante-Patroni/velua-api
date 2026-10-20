/**
 * @description Interfaz del repositorio de usuarios del panel.
 */
class UsuarioRepository {
  /**
   * @description Busca un usuario por mail, incluyendo el hash de la contraseña.
   * @param {string} _email - Mail ya normalizado a minúsculas.
   * @returns {Promise<Object|null>} Usuario con su passwordHash, o null.
   */
  async buscarPorEmail(_email) {
    throw new Error("Metodo buscarPorEmail no implementado");
  }

  /**
   * @description Busca un usuario por id, sin el hash de la contraseña.
   * @param {number} _id - Id del usuario.
   * @returns {Promise<Object|null>} Usuario sin passwordHash, o null.
   */
  async buscarPorId(_id) {
    throw new Error("Metodo buscarPorId no implementado");
  }

  /**
   * @description Registra la fecha del último ingreso del usuario.
   * @param {number} _id - Id del usuario.
   * @returns {Promise<void>}
   */
  async registrarAcceso(_id) {
    throw new Error("Metodo registrarAcceso no implementado");
  }

    /**
   * @description Busca lo mínimo para validar una sesión en cada request.
   * Nunca trae el hash de la contraseña.
   * @param {number} _id - Id del usuario.
   * @returns {Promise<Object|null>} id, rol, activo y versionSesion, o null.
   */
  async buscarSesion(_id) {
    throw new Error("Metodo buscarSesion no implementado");
  }

  /**
   * @description Busca un usuario por id con el hash de la contraseña.
   * Solo para verificar la contraseña actual antes de cambiarla.
   * @param {number} _id - Id del usuario.
   * @returns {Promise<Object|null>} id, email, activo y passwordHash, o null.
   */
  async buscarConHash(_id) {
    throw new Error("Metodo buscarConHash no implementado");
  }

  /**
   * @description Guarda el hash nuevo e incrementa version_sesion en un solo UPDATE.
   * Invalida todos los tokens emitidos antes del cambio.
   * @param {number} _id - Id del usuario.
   * @param {string} _passwordHash - Hash bcrypt de la contraseña nueva.
   * @returns {Promise<void>}
   * @throws {Error} NO_ENCONTRADO si el usuario no existe.
   */
  async cambiarContrasena(_id, _passwordHash) {
    throw new Error("Metodo cambiarContrasena no implementado");
  }
}

module.exports = UsuarioRepository;
