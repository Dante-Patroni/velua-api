const { firmaValida } = require("../pagos/firmaMercadoPago");

/**
 * @description Recibe los avisos de Mercado Pago.
 *
 * Hace lo mínimo: verifica la firma, filtra los avisos que no son de pagos y
 * delega. Responde 200 en todo lo que no tiene sentido reintentar, y 500 solo si
 * la falla es pasajera, para que Mercado Pago vuelva a avisar.
 */
class WebhookController {
  /**
   * @description Instancia el controlador.
   * @param {Object} pagoWebhookService - Instancia de PagoWebhookService.
   * @param {Object} [opciones] - Configuración.
   * @param {string} [opciones.secreto] - Por defecto, MP_WEBHOOK_SECRET.
   * @param {{info: Function, error: Function}} [opciones.logger] - Por defecto, la consola.
   */
  constructor(
    pagoWebhookService,
    { secreto = process.env.MP_WEBHOOK_SECRET, logger = console } = {}
  ) {
    this.servicio = pagoWebhookService;
    this.secreto = secreto;
    this.logger = logger;
  }

  /**
   * @description Procesa un aviso de Mercado Pago.
   * @param {import("express").Request} req - Request con data.id y type en la URL.
   * @param {import("express").Response} res - Response de Express.
   * @returns {Promise<void>}
   */
  mercadoPago = async (req, res) => {
    if (!this.secreto) {
      this.logger.error("[webhook] falta MP_WEBHOOK_SECRET: no se puede verificar ningún aviso");
      res.sendStatus(503);
      return;
    }

    const dataId = req.query["data.id"];
    const valida = firmaValida({
      encabezadoFirma: req.get("x-signature"),
      requestId: req.get("x-request-id"),
      dataId,
      secreto: this.secreto,
    });
    if (!valida) {
      res.sendStatus(401);
      return;
    }

    // Mercado Pago también avisa de órdenes y otros recursos: solo interesan los pagos
    if (req.query.type !== "payment" || !dataId) {
      res.sendStatus(200);
      return;
    }

    try {
      const r = await this.servicio.procesarNotificacion(String(dataId));
      this.logger.info(
        `[webhook] pago ${dataId}: ${r.procesado ? `${r.numero} actualizado` : r.motivo}`
      );
      res.sendStatus(200);
    } catch (error) {
      this.logger.error(`[webhook] pago ${dataId}: ${error.message}`, error.cause ?? "");
      res.sendStatus(500);
    }
  };
}

module.exports = WebhookController;
