const express = require("express");

const db = require("../models");
const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const { PedidoEstadoService } = require("../services/PedidoEstadoService");
const { PagoWebhookService } = require("../services/PagoWebhookService");
const { MercadoPagoProcesador } = require("../pagos/MercadoPagoProcesador");
const WebhookController = require("../controllers/WebhookController");

const router = express.Router();

const pedidoRepository = new SequelizePedidoRepository(db);
const controller = new WebhookController(
  new PagoWebhookService({
    procesadorPagos: new MercadoPagoProcesador(),
    pedidoRepository,
    pedidoEstadoService: new PedidoEstadoService(pedidoRepository),
  })
);

/**
 * @openapi
 * /webhooks/mercadopago:
 *   post:
 *     tags: [Webhooks]
 *     summary: Aviso de Mercado Pago
 *     description: >
 *       Lo llama Mercado Pago, no el frontend. Verifica la firma (x-signature y
 *       x-request-id con MP_WEBHOOK_SECRET), consulta el pago en Mercado Pago y, si
 *       corresponde, mueve el estado de pago del pedido. Es idempotente: el mismo
 *       aviso puede llegar varias veces.
 *     parameters:
 *       - name: data.id
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: type
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           example: payment
 *     responses:
 *       200:
 *         description: Aviso recibido. Se procese o no, no hace falta reintentarlo.
 *       401:
 *         description: Firma inválida.
 *       500:
 *         description: Falla pasajera (Mercado Pago no respondió). Mercado Pago reintenta.
 *       503:
 *         description: Falta configurar MP_WEBHOOK_SECRET.
 */
router.post("/webhooks/mercadopago", controller.mercadoPago);

module.exports = router;
