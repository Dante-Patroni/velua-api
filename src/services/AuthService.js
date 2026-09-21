const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { permisosDeRol } = require("../config/permisos");

/**
 * @description Costo de bcrypt. Tiene que coincidir con el que usa el seed,
 * si no los tiempos de comparación delatan qué usuarios existen.
 */
const COSTO_BCRYPT = 12;

/**
 * @description Hash de relleno para comparar cuando el usuario no existe.
 * Hace que un mail inexistente tarde lo mismo que uno con contraseña incorrecta.
 */
const HASH_RELLENO = bcrypt.hashSync("relleno-que-nunca-coincide", COSTO_BCRYPT);

/**
 * @description Servicio de autenticación del panel de administración.
 */
class AuthService {
  /**
   * @description Instancia el servicio.
   * @param {Object} usuarioRepository - Implementación de UsuarioRepository.
   * @param {Object} opciones - Configuración.
   * @param {string} opciones.jwtSecret - Secreto para firmar los tokens.
   * @param {string} [opciones.duracion] - Vida del token, formato de jsonwebtoken.
   */
  constructor(usuarioRepository, { jwtSecret, duracion = "8h" }) {
    this.usuarioRepository = usuarioRepository;
    this.jwtSecret = jwtSecret;
    this.duracion = duracion;
  }

  /**
   * @description Verifica credenciales y emite un token de sesión.
   * @param {string} email - Mail ingresado.
   * @param {string} password - Contraseña ingresada.
   * @returns {Promise<{token: string, usuario: Object}>} Token y datos públicos del usuario.
   * @throws {Error} CREDENCIALES_INVALIDAS, USUARIO_INACTIVO
   */
  async login(email, password) {
    const emailNormalizado = String(email).trim().toLowerCase();
    const usuario = await this.usuarioRepository.buscarPorEmail(emailNormalizado);

    const coincide = await bcrypt.compare(password, usuario ? usuario.passwordHash : HASH_RELLENO);

    if (!usuario || !coincide) {
      throw new Error("CREDENCIALES_INVALIDAS");
    }

    if (!usuario.activo) {
      throw new Error("USUARIO_INACTIVO");
    }

    await this.usuarioRepository.registrarAcceso(usuario.id);

    const permisos = permisosDeRol(usuario.rol);
    const token = jwt.sign({ id: usuario.id, rol: usuario.rol, permisos }, this.jwtSecret, {
      expiresIn: this.duracion,
    });

    return { token, usuario: this.#datosPublicos(usuario, permisos) };
  }

  /**
   * @description Devuelve el usuario de la sesión actual, verificando que siga activo.
   * @param {number} id - Id que viene en el token.
   * @returns {Promise<Object>} Datos públicos del usuario.
   * @throws {Error} NO_AUTORIZADO, USUARIO_INACTIVO
   */
  async obtenerUsuarioActual(id) {
    const usuario = await this.usuarioRepository.buscarPorId(id);

    if (!usuario) {
      throw new Error("NO_AUTORIZADO");
    }
    if (!usuario.activo) {
      throw new Error("USUARIO_INACTIVO");
    }

    return this.#datosPublicos(usuario, permisosDeRol(usuario.rol));
  }

  /**
   * @description Recorta el usuario a lo que se puede exponer.
   * @param {Object} usuario - Usuario del repositorio.
   * @param {string[]} permisos - Permisos calculados del rol.
   * @returns {Object} Id, nombre, mail, rol y permisos.
   */
  #datosPublicos(usuario, permisos) {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      permisos,
    };
  }
}

module.exports = { AuthService, COSTO_BCRYPT };
