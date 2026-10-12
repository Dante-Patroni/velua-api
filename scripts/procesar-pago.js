/**
 * Procesa a mano un pago de Mercado Pago, con la misma lógica que el webhook pero
 * sin la verificación de firma.
 *
 * Sirve si un aviso se perdió (la API estaba caída, el túnel cerrado) o para probar
 * con un pago real. Consulta el pago en Mercado Pago, que es la fuente de verdad, y
 * es idempotente: correrlo dos veces no hace nada la segunda.
 *
 *   node scripts/procesar-pago.js <id del pago>
 */
require("dotenv").config();

const db = require("../src/models");
const SequelizePedidoRepository = require("../src/repositories/sequelize/SequelizePedidoRepository");
const { PedidoEstadoService } = require("../src/services/PedidoEstadoService");
const { PagoWebhookService } = require("../src/services/PagoWebhookService");
const { MercadoPagoProcesador } = require("../src/pagos/MercadoPagoProcesador");

(async () => {
  const pagoId = process.argv[2];
  if (!pagoId) {
    // eslint-disable-next-line no-console
    console.error("Uso: node scripts/procesar-pago.js <id del pago>");
    process.exitCode = 1;
    return;
  }

  const pedidoRepository = new SequelizePedidoRepository(db);
  const servicio = new PagoWebhookService({
    procesadorPagos: new MercadoPagoProcesador(),
    pedidoRepository,
    pedidoEstadoService: new PedidoEstadoService(pedidoRepository),
  });

  try {
    const resultado = await servicio.procesarNotificacion(pagoId);
    // eslint-disable-next-line no-console
    console.log("Resultado:", resultado);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error:", error.message, error.cause ?? "");
    process.exitCode = 1;
  } finally {
    await db.sequelize.close();
  }
})();
