const { manejarErrorHttp } = require("../middlewares/errorMapper");
const { COOKIE_SESION } = require("../middlewares/authMiddleware");

const OCHO_HORAS_MS = 8 * 60 * 60 * 1000;

/**
 * @description Opciones de la cookie de sesión. Las mismas se usan para
 * emitirla y para borrarla: si no coinciden, el navegador no la borra.
 *
 * En producción lleva `domain` con un punto adelante, para que valga en todo el
 * dominio y no solo en el subdominio que la emite. El panel vive en
 * veluanature.com.ar y la API en api.veluanature.com.ar: sin esto, el navegador
 * guardaría la cookie para la API y no la mandaría desde el panel.
 *
 * En desarrollo no se declara: `localhost` no admite dominios con punto.
 *
 * @returns {Object} Opciones para res.cookie y res.clearCookie.
 */
const opcionesCookie = () => {
  const opciones = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v1",
  };

  if (process.env.COOKIE_DOMINIO) {
    opciones.domain = process.env.COOKIE_DOMINIO;
  }

  return opciones;
};

/**
 * @description Controlador de autenticación del panel.
 */
class AuthController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {Object} authService - Instancia de AuthService.
   */
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * @description Verifica credenciales y deja la sesión en una cookie httpOnly.
   * @param {import("express").Request} req - Request con email y password en el cuerpo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  login = async (req, res) => {
    try {
      const { email, password } = req.body;
      const { token, usuario } = await this.authService.login(email, password);

      res.cookie(COOKIE_SESION, token, { ...opcionesCookie(), maxAge: OCHO_HORAS_MS });
      res.status(200).json(usuario);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Cierra la sesión borrando la cookie.
   * @param {import("express").Request} req - Request de Express.
   * @param {import("express").Response} res - Response de Express.
   * @returns {void}
   */
  logout = (req, res) => {
    res.clearCookie(COOKIE_SESION, opcionesCookie());
    res.status(204).end();
  };

  /**
   * @description Devuelve el usuario de la sesión actual.
   * @param {import("express").Request} req - Request con req.usuario cargado por authMiddleware.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  yo = async (req, res) => {
    try {
      const usuario = await this.authService.obtenerUsuarioActual(req.usuario.id);
      res.status(200).json(usuario);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = AuthController;
