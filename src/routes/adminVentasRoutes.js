const express = require("express");

const db = require("../models");
const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const { CheckoutService } = require("../services/CheckoutService");
const VentaPanelController = require("../controllers/VentaPanelController");
const { proteger } = require("../middlewares/proteger");
const { validarVentaPanel } = require("../validators/ventaPanel");
const { PERMISOS } = require("../config/permisos");
const { configEfectivo } = require("../config/efectivo");
const { configTransferenciaEnPanel } = require("../config/transferencia");

const router = express.Router();

// El servicio del panel, con su propia configuración. Cada medio se habilita por la
// suya: un descuento inválido deshabilita el medio (503), no se cobra sin descuento.
const controller = new VentaPanelController(
  new CheckoutService(new SequelizePedidoRepository(db), {
    umbralEnvioGratis: process.env.ENVIO_GRATIS_DESDE || null,
    descuentoEfectivo: configEfectivo.descuento,
    descuentoTransferencia: configTransferenciaEnPanel.descuento,
    mediosDisponibles: {
      efectivo: configEfectivo.habilitado,
      transferencia: configTransferenciaEnPanel.habilitada,
    },
  })
);

/**
 * @openapi
 * /admin/ventas:
 *   post:
 *     tags: [Admin - Ventas]
 *     summary: Registrar una venta hecha fuera de la tienda
 *     description: >
 *       Solo el admin (VENTAS_REGISTRAR). Crea un pedido con canal panel, con el
 *       mismo stock y el mismo historial que la tienda. El total lo calcula la API.
 *       En efectivo con cobradoEnEfectivo true, el pago nace aprobado; si no, queda
 *       pendiente, sin vencimiento. La transferencia se aprueba después con
 *       pago-confirmado.
 *
 *
 *       Es idempotente: cada venta lleva un UUID en Idempotency-Key. Repetir la
 *       misma venta con la misma clave devuelve la original (200), sin descontar
 *       stock de nuevo. La misma clave con otra venta es CLAVE_REUTILIZADA.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         description: Un UUID por venta. El panel lo genera una vez y lo repite en cada reintento.
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VentaPanelEntrada'
 *     responses:
 *       201:
 *         description: Venta registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VentaPanelResultado'
 *       200:
 *         description: Reintento. Devuelve la venta original, con su estado actual
 *         headers:
 *           Idempotent-Replayed:
 *             description: Siempre true en un reintento.
 *             schema:
 *               type: string
 *               enum: ["true"]
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VentaPanelResultado'
 *       400:
 *         $ref: '#/components/responses/DatosInvalidos'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       409:
 *         description: >
 *           CLAVE_REUTILIZADA (la clave ya se usó con otra venta), TOTAL_CAMBIO,
 *           CARRITO_DESACTUALIZADO o STOCK_INSUFICIENTE.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: MEDIO_PAGO_NO_DISPONIBLE (el medio está deshabilitado por su configuración).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/admin/ventas",
  proteger(PERMISOS.VENTAS_REGISTRAR),
  validarVentaPanel,
  controller.registrar
);

module.exports = router;
