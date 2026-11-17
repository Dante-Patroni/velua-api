const { matchedData } = require("express-validator");

const { manejarErrorHttp } = require("../middlewares/errorMapper");

/**
 * @description Controlador de las ventas que la dueña registra desde el panel.
 */
class VentaPanelController {
  /**
   * @description Inicializa el controlador inyectando el servicio.
   * @param {Object} checkoutService - Instancia de CheckoutService con la
   *   configuración del panel.
   */
  constructor(checkoutService) {
    this.servicio = checkoutService;
  }

  /**
   * @description Registra una venta del panel. El cuerpo se lee con matchedData
   * (solo lo validado), el usuario sale de la sesión y la clave del encabezado
   * Idempotency-Key.
   *
   * - Venta nueva: 201.
   * - Reintento con la misma clave y la misma venta: 200 con la venta original (en
   *   su estado actual) y el encabezado Idempotent-Replayed, para que el panel y los
   *   logs distingan una venta nueva de un reintento.
   *
   * @param {import("express").Request} req - Request validada.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  registrar = async (req, res) => {
    try {
      const datos = matchedData(req, { locations: ["body"] });
      const { creada, venta } = await this.servicio.registrarVentaDelPanel(datos, {
        usuarioId: req.usuario.id,
        claveVenta: req.get("Idempotency-Key"),
      });
      if (!creada) res.set("Idempotent-Replayed", "true");
      res.status(creada ? 201 : 200).json(venta);
    } catch (error) {
      manejarErrorHttp(error, res);
    }
  };
}

module.exports = VentaPanelController;
