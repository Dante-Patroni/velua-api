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
}

module.exports = UsuarioRepository;
