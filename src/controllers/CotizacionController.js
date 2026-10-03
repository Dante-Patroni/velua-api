const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador público de cotización del carrito.
 */
class CotizacionController {
  /**
   * @description Inicializa el controlador inyectando el cotizador.
   * @param {Object} cotizador - Instancia de Cotizador.
   */
  constructor(cotizador) {
    this.cotizador = cotizador;
  }

  /**
   * @description Cotiza un carrito. No crea ni reserva nada.
   * @param {import("express").Request} req - Request con el carrito en el cuerpo.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  cotizar = async (req, res) => {
    try {
      const { items, zonaEnvioId, medioPago } = req.body;
      res.status(200).json(await this.cotizador.cotizar({ items, zonaEnvioId, medioPago }));
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };

  /**
   * @description Lista las zonas de envío activas.
   * @param {import("express").Request} req - Request de Express.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  listarZonas = async (req, res) => {
    try {
      res.status(200).json({ datos: await this.cotizador.listarZonasEnvio() });
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = CotizacionController;
