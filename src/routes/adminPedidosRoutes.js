const express = require("express");
const { param, query } = require("express-validator");

const db = require("../models");
const SequelizePedidoRepository = require("../repositories/sequelize/SequelizePedidoRepository");
const { PedidoAdminService } = require("../services/PedidoAdminService");
const PedidoAdminController = require("../controllers/PedidoAdminController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { soloPermisos } = require("../middlewares/roleMiddleware");
const { manejarErroresValidacion } = require("../middlewares/validacion");
const { PERMISOS } = require("../config/permisos");
const { TRANSICIONES_PAGO, TRANSICIONES_PREPARACION } = require("../services/transicionesPedido");

const router = express.Router();

const controller = new PedidoAdminController(
  new PedidoAdminService(new SequelizePedidoRepository(db))
);

/** Máximo de pedidos por página: nadie puede pedir todos los pedidos de una vez. */
const LIMITE_MAXIMO = 50;

const validarListado = [
  query("estadoPago")
    .optional()
    .isIn(Object.keys(TRANSICIONES_PAGO))
    .withMessage("Estado de pago no reconocido"),
  query("estadoPedido")
    .optional()
    .isIn(Object.keys(TRANSICIONES_PREPARACION))
    .withMessage("Estado de preparación no reconocido"),
  query("pagina").optional().isInt({ min: 1, max: 10000 }).withMessage("Página inválida").toInt(),
  query("limite")
    .optional()
    .isInt({ min: 1, max: LIMITE_MAXIMO })
    .withMessage(`El límite va de 1 a ${LIMITE_MAXIMO}`)
    .toInt(),
  manejarErroresValidacion,
];

const validarId = [
  param("id").isInt({ min: 1 }).withMessage("Id inválido").toInt(),
  manejarErroresValidacion,
];
/**
 * @openapi
 * /admin/pedidos:
 *   get:
 *     tags: [Admin - Pedidos]
 *     summary: Listar los pedidos
 *     description: >
 *       Del más nuevo al más viejo. La lista muestra solo lo necesario para
 *       ubicar un pedido: los datos de contacto y la dirección van en el detalle.
 *       Máximo 50 por página.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: estadoPago
 *         schema:
 *           type: string
 *           enum: [pendiente, aprobado, rechazado, cancelado, devuelto]
 *       - in: query
 *         name: estadoPedido
 *         schema:
 *           type: string
 *           enum: [nuevo, en_preparacion, enviado, entregado, cancelado]
 *       - $ref: '#/components/parameters/Pagina'
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: Página de pedidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [datos, meta]
 *               properties:
 *                 datos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required: [id, numero, creadoEn, clienteNombre, total, medioPago, estadoPago, estadoPedido, metodoEntrega, expiraEn]
 *                     properties:
 *                       id: { type: integer }
 *                       numero: { type: string }
 *                       creadoEn: { type: string, format: date-time }
 *                       clienteNombre: { type: string }
 *                       total: { type: string }
 *                       medioPago: { type: string, enum: [mercadopago, transferencia] }
 *                       estadoPago: { type: string }
 *                       estadoPedido: { type: string }
 *                       metodoEntrega: { type: string, enum: [envio, retiro] }
 *                       expiraEn: { type: [string, "null"], format: date-time }
 *                 meta:
 *                   $ref: '#/components/schemas/Meta'
 *       400:
 *         description: DATOS_INVALIDOS (filtro o paginación fuera de rango)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Sin sesión, vencida o revocada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Sin permiso de ver pedidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/admin/pedidos",
  authMiddleware,
  soloPermisos(PERMISOS.PEDIDOS_VER),
  validarListado,
  controller.listar
);

/**
 * @openapi
 * /admin/pedidos/{id}:
 *   get:
 *     tags: [Admin - Pedidos]
 *     summary: Detalle de un pedido
 *     description: >
 *       Contacto, entrega, totales con sus descuentos, pago, ítems e historial de
 *       eventos. No incluye datos internos del procesador de pagos.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdRuta'
 *     responses:
 *       200:
 *         description: El pedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [id, numero, creadoEn, clienteNombre, total, medioPago, estadoPago, estadoPedido, metodoEntrega, expiraEn, cliente, entrega, totales, pago, items, eventos]
 *               properties:
 *                 id: { type: integer }
 *                 numero: { type: string }
 *                 creadoEn: { type: string, format: date-time }
 *                 clienteNombre: { type: string }
 *                 total: { type: string }
 *                 medioPago: { type: string, enum: [mercadopago, transferencia] }
 *                 estadoPago: { type: string }
 *                 estadoPedido: { type: string }
 *                 metodoEntrega: { type: string, enum: [envio, retiro] }
 *                 expiraEn: { type: [string, "null"], format: date-time }
 *                 cliente:
 *                   type: object
 *                   properties:
 *                     nombre: { type: string }
 *                     email: { type: string }
 *                     telefono: { type: string }
 *                     documento: { type: [string, "null"] }
 *                 entrega:
 *                   type: object
 *                   properties:
 *                     metodo: { type: string, enum: [envio, retiro] }
 *                     zona: { type: [string, "null"] }
 *                     direccion:
 *                       type: [object, "null"]
 *                       properties:
 *                         calle: { type: string }
 *                         numero: { type: string }
 *                         extra: { type: [string, "null"] }
 *                         ciudad: { type: string }
 *                         provincia: { type: string }
 *                         cp: { type: string }
 *                     seguimiento: { type: [string, "null"] }
 *                 totales:
 *                   type: object
 *                   properties:
 *                     subtotal: { type: string }
 *                     descuentoCupon: { type: string }
 *                     ajusteMedioPago: { type: string, description: Descuento por medio de pago (se resta). }
 *                     costoEnvio: { type: string }
 *                     total: { type: string }
 *                 pago:
 *                   type: object
 *                   properties:
 *                     pagoId: { type: [string, "null"] }
 *                     metodo: { type: [string, "null"] }
 *                     comprobanteInformadoEn: { type: [string, "null"], format: date-time }
 *                 notasCliente: { type: [string, "null"] }
 *                 notasInternas: { type: [string, "null"] }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       producto: { type: string }
 *                       variante: { type: string }
 *                       sku: { type: [string, "null"] }
 *                       precioUnitario: { type: string }
 *                       cantidad: { type: integer }
 *                       subtotal: { type: string }
 *                 eventos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       campo: { type: string, enum: [pago, preparacion, aviso] }
 *                       estadoAnterior: { type: [string, "null"] }
 *                       estadoNuevo: { type: string }
 *                       origen: { type: string }
 *                       usuarioId: { type: [integer, "null"] }
 *                       detalle: { type: [string, "null"] }
 *                       creadoEn: { type: string, format: date-time }
 *       400:
 *         description: DATOS_INVALIDOS (id mal formado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Sin sesión, vencida o revocada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Sin permiso de ver pedidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: NO_ENCONTRADO
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/admin/pedidos/:id",
  authMiddleware,
  soloPermisos(PERMISOS.PEDIDOS_VER),
  validarId,
  controller.detalle
);

module.exports = router;
