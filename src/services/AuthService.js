const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { permisosDeRol } = require("../config/permisos");
const { motivoDeRechazo, MENSAJES_RECHAZO } = require("./politicaContrasena");

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
   * @throws {Error} CREDENCIALES_INVALIDAS, USUARIO_INACTIVO, DATOS_DE_SESION_INCOMPLETOS
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

    // Se firma antes de registrar el acceso: si no se puede emitir un token
    // válido, no hubo acceso y no se registra.
    const token = this.#firmarToken(usuario);
    await this.usuarioRepository.registrarAcceso(usuario.id);

    return { token, usuario: this.#datosPublicos(usuario, permisosDeRol(usuario.rol)) };
  }

  /**
   * @description Cambia la contraseña de la usuaria de la sesión. Exige la actual,
   * aplica la política a la nueva e invalida todas las sesiones anteriores.
   * @param {number} id - Id de la sesión actual.
   * @param {string} contrasenaActual - Contraseña actual, para confirmar que es ella.
   * @param {string} contrasenaNueva - Contraseña nueva.
   * @returns {Promise<{token: string}>} Token nuevo, con la versión de sesión nueva.
   * @throws {Error} NO_AUTORIZADO, USUARIO_INACTIVO, CONTRASENA_ACTUAL_INCORRECTA, DATOS_INVALIDOS
   */
  async cambiarContrasena(id, contrasenaActual, contrasenaNueva) {
    const usuario = await this.usuarioRepository.buscarConHash(id);
    if (!usuario) {
      throw new Error("NO_AUTORIZADO");
    }
    if (!usuario.activo) {
      throw new Error("USUARIO_INACTIVO");
    }

    // Primero la actual: con una sesión robada no se llega a la política.
    const coincide = await bcrypt.compare(String(contrasenaActual), usuario.passwordHash);
    if (!coincide) {
      const error = new Error("CONTRASENA_ACTUAL_INCORRECTA");
      error.details = { contrasenaActual: "La contraseña actual no es correcta." };
      throw error;
    }

    const motivo = motivoDeRechazo(contrasenaNueva, {
      actual: contrasenaActual,
      email: usuario.email,
    });
    if (motivo) {
      const error = new Error("DATOS_INVALIDOS");
      error.details = { contrasenaNueva: MENSAJES_RECHAZO[motivo] };
      throw error;
    }

    const hash = await bcrypt.hash(contrasenaNueva, COSTO_BCRYPT);
    await this.usuarioRepository.cambiarContrasena(usuario.id, hash);

    // La versión nueva se lee de la base, que es quien la incrementó.
    const sesion = await this.usuarioRepository.buscarSesion(usuario.id);
    if (!sesion) {
      throw new Error("NO_AUTORIZADO");
    }

    return { token: this.#firmarToken(sesion) };
  }

  /**
   * @description Firma el token de sesión. Lo usan el login y el cambio de contraseña.
   * @param {Object} usuario - Necesita id, rol y versionSesion.
   * @returns {string} Token firmado.
   * @throws {Error} DATOS_DE_SESION_INCOMPLETOS si falta la versión de sesión.
   */
  #firmarToken(usuario) {
    // Sin la versión, el token saldría sin sv y el middleware lo rechazaría siempre.
    if (!Number.isInteger(usuario.versionSesion)) {
      throw new Error("DATOS_DE_SESION_INCOMPLETOS");
    }
    const permisos = permisosDeRol(usuario.rol);
    return jwt.sign(
      { id: usuario.id, rol: usuario.rol, permisos, sv: usuario.versionSesion },
      this.jwtSecret,
      { expiresIn: this.duracion }
    );
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
