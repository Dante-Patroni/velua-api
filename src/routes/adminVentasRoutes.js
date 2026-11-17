const express = require("express");

const db = require("../models");
const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const SequelizeCotizacionRepository = require("../repositories/sequelize/SequelizeCotizacionRepository");
const { CheckoutService } = require("../services/CheckoutService");
const { CotizacionPanelService } = require("../services/CotizacionPanelService");
const { Cotizador } = require("../services/cotizador");
const VentaPanelController = require("../controllers/VentaPanelController");
const { proteger } = require("../middlewares/proteger");
const { validarVentaPanel, validarCotizacionPanel } = require("../validators/ventaPanel");
const { PERMISOS } = require("../config/permisos");
const { configVentaPanel } = require("../config/ventaPanel");

const router = express.Router();

// La venta y su cotización, con la misma configuración (config/ventaPanel.js): si
// fueran dos, la pantalla podría mostrar un total y la venta rechazarlo. Cada medio
// se habilita por la suya: un descuento inválido deshabilita el medio (503), no se
// cobra sin descuento.
const controller = new VentaPanelController(
  new CheckoutService(new SequelizePedidoRepository(db), configVentaPanel),
  new CotizacionPanelService(
    new Cotizador(new SequelizeCotizacionRepository(db), configVentaPanel),
    configVentaPanel
  )
);

/**
 * @openapi
 * /admin/ventas/cotizacion:
 *   post:
 *     tags: [Admin - Ventas]
 *     summary: Cotizar una venta del panel
 *     description: >
 *       Solo el admin (VENTAS_REGISTRAR). Calcula el total de una venta del panel
 *       con efectivo y transferencia, con el descuento y el envío de cada medio.
 *       **No crea ni reserva nada**: el stock se verifica al registrar la venta.
 *
 *
 *       El total que el panel manda después como totalEsperado es
 *       mediosPago[medioElegido].total. totales.total sin medio de pago no lleva
 *       descuento: no es el total de ningún medio.
 *
 *
 *       Sin medioPago, cada medio informa si está disponible. Con un medioPago
 *       deshabilitado por su configuración, 503.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VentaCotizacionEntrada'
 *     responses:
 *       200:
 *         description: Venta cotizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VentaCotizacion'
 *       400:
 *         description: >
 *           DATOS_INVALIDOS (con el campo), CARRITO_SIN_ITEMS_VALIDOS o
 *           ZONA_INVALIDA.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/NoAutorizado'
 *       403:
 *         $ref: '#/components/responses/SinPermiso'
 *       503:
 *         description: MEDIO_PAGO_NO_DISPONIBLE (el medio pedido está deshabilitado por su configuración).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/admin/ventas/cotizacion",
  proteger(PERMISOS.VENTAS_REGISTRAR),
  validarCotizacionPanel,
  controller.cotizar
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
