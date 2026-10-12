const { matchedData } = require("express-validator");

const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador público del botón de arrepentimiento.
 */
class ArrepentimientoController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {Object} servicio - Instancia de ArrepentimientoService.
   */
  constructor(servicio) {
    this.servicio = servicio;
  }

  /**
   * @description Registra una solicitud y devuelve el código de trámite.
   * @param {import("express").Request} req - Request con la solicitud en el cuerpo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  registrar = async (req, res) => {
    try {
      const { pedidoNumero, nombre, email, telefono, motivo } = req.body;
      res
        .status(201)
        .json(await this.servicio.registrar({ pedidoNumero, nombre, email, telefono, motivo }));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Lista solicitudes para el panel.
   * @param {import("express").Request} req - Request con estado, pagina y limite en la query.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  listar = async (req, res) => {
    try {
      const { estado, pagina, limite } = matchedData(req, { locations: ["query"] });
      res.status(200).json(await this.servicio.listar({ estado, pagina, limite }));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = ArrepentimientoController;
